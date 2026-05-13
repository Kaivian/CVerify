using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;
using CVerify.API.Modules.Profiles.DTOs;
using CVerify.API.Modules.Profiles.Entities;
using CVerify.API.Modules.Shared.Exceptions;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.Modules.Profiles.Services;

public class CandidateAssessmentService : ICandidateAssessmentService
{
    private readonly ApplicationDbContext _context;
    private readonly ICandidateAssessmentQueue _queue;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IHmacSignatureService _hmacService;
    private readonly IConnectionMultiplexer _redis;
    private readonly ICandidateRepositoryProvider _repositoryProvider;
    private readonly ILogger<CandidateAssessmentService> _logger;

    public CandidateAssessmentService(
        ApplicationDbContext context,
        ICandidateAssessmentQueue queue,
        IHttpClientFactory httpClientFactory,
        IHmacSignatureService hmacService,
        IConnectionMultiplexer redis,
        ICandidateRepositoryProvider repositoryProvider,
        ILogger<CandidateAssessmentService> _logger)
    {
        _context = context;
        _queue = queue;
        _httpClientFactory = httpClientFactory;
        _hmacService = hmacService;
        _redis = redis;
        _repositoryProvider = repositoryProvider;
        this._logger = _logger;
    }

    public async Task<CandidateReadinessDto> GetReadinessStatusAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var profile = await _context.UserProfiles
            .FirstOrDefaultAsync(up => up.UserId == userId, cancellationToken);

        if (profile == null)
        {
            throw new ResourceNotFoundException(ProfileErrorCodes.ProfileNotFound, "Profile not found.");
        }

        var missingFields = new List<string>();

        if (string.IsNullOrWhiteSpace(profile.Headline))
        {
            missingFields.Add("Headline");
        }

        if (string.IsNullOrWhiteSpace(profile.Bio))
        {
            missingFields.Add("Bio");
        }

        var hasSkills = await _context.UserSkills.AnyAsync(us => us.UserId == userId, cancellationToken);
        if (!hasSkills)
        {
            var careerPref = await _context.CareerPreferences.FirstOrDefaultAsync(cp => cp.UserId == userId, cancellationToken);
            if (careerPref?.TargetSkills == null || careerPref.TargetSkills.Count == 0)
            {
                missingFields.Add("Skills");
            }
        }

        var hasEducation = await _context.EducationEntries.AnyAsync(ee => ee.UserId == userId, cancellationToken);
        if (!hasEducation)
        {
            missingFields.Add("Education");
        }

        var hasExperience = await _context.WorkExperiences.AnyAsync(we => we.UserId == userId, cancellationToken);
        if (!hasExperience)
        {
            missingFields.Add("Experiences");
        }

        double completenessScore = (5.0 - missingFields.Count) * 20.0;
        bool isReady = missingFields.Count == 0;

        var latestAssessment = await _context.CandidateAssessments
            .Where(ca => ca.UserId == userId && ca.Status == "Completed")
            .OrderByDescending(ca => ca.CompletedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        var lastRepoAnalysisAt = await _repositoryProvider.GetLastRepositoryAnalysisAtAsync(userId, cancellationToken);

        bool requiresReassessment = latestAssessment == null
            || latestAssessment.CompletedAtUtc < profile.LastProfileUpdateAt
            || latestAssessment.CompletedAtUtc < lastRepoAnalysisAt;

        return new CandidateReadinessDto(
            isReady,
            missingFields,
            completenessScore,
            requiresReassessment,
            latestAssessment?.CompletedAtUtc,
            profile.LastProfileUpdateAt,
            lastRepoAnalysisAt
        );
    }

    public async Task<CandidateAssessmentResponse> TriggerAssessmentAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var profile = await _context.UserProfiles
            .FirstOrDefaultAsync(up => up.UserId == userId, cancellationToken);

        if (profile == null)
        {
            throw new ResourceNotFoundException(ProfileErrorCodes.ProfileNotFound, "Profile not found.");
        }

        // 1. Concurrency Check
        var hasActive = await _context.CandidateAssessments
            .AnyAsync(ca => ca.UserId == userId && (ca.Status == "Queued" || ca.Status == "Running"), cancellationToken);

        if (hasActive)
        {
            throw new BusinessRuleException("ASSESSMENT_ALREADY_ACTIVE", "An assessment is already queued or running for this candidate.");
        }

        // 2. Readiness validation
        var readiness = await GetReadinessStatusAsync(userId, cancellationToken);
        if (!readiness.IsReady)
        {
            throw new BusinessRuleException("PROFILE_INCOMPLETE", "Please complete your biography, headline, skills, education, and work experience before starting the assessment.");
        }

        // 3. Check repo eligibility (need at least one connected completed repo)
        var hasCompletedRepos = await _repositoryProvider.HasCompletedRepositoriesAsync(userId, cancellationToken);

        if (!hasCompletedRepos)
        {
            throw new BusinessRuleException("NO_COMPLETED_REPOS", "No completed repository analysis found. Please connect and analyze at least one repository first.");
        }

        var lastRepoAnalysisAt = await _repositoryProvider.GetLastRepositoryAnalysisAtAsync(userId, cancellationToken);

        // 4. Create new assessment
        var assessment = new CandidateAssessment
        {
            Id = Guid.CreateVersion7(),
            UserId = userId,
            Status = "Queued",
            PipelineVersion = "2.0.0",
            AssessmentSchemaVersion = "1.0.0",
            LastProfileUpdateAt = profile.LastProfileUpdateAt,
            LastRepositoryAnalysisAt = lastRepoAnalysisAt,
            CreatedAtUtc = DateTimeOffset.UtcNow
        };

        _context.CandidateAssessments.Add(assessment);
        await _context.SaveChangesAsync(cancellationToken);

        // 5. Enqueue job
        await _queue.EnqueueAssessmentAsync(assessment.Id);

        return MapToResponse(assessment);
    }

    public async Task<CandidateAssessmentResponse?> GetLatestAssessmentAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var assessment = await _context.CandidateAssessments
            .Where(ca => ca.UserId == userId)
            .OrderByDescending(ca => ca.CreatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        return assessment != null ? MapToResponse(assessment) : null;
    }

    public async Task<List<CandidateAssessmentResponse>> GetAssessmentHistoryAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var list = await _context.CandidateAssessments
            .Where(ca => ca.UserId == userId)
            .OrderByDescending(ca => ca.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        return list.Select(MapToResponse).ToList();
    }

    public async Task<CandidateAssessmentDetailResponse?> GetAssessmentDetailsAsync(Guid userId, Guid assessmentId, CancellationToken cancellationToken = default)
    {
        var assessment = await _context.CandidateAssessments
            .Include(ca => ca.Artifacts)
            .FirstOrDefaultAsync(ca => ca.Id == assessmentId && ca.UserId == userId, cancellationToken);

        if (assessment == null) return null;

        var response = MapToResponse(assessment);
        var artifacts = assessment.Artifacts.Select(a => new CandidateAssessmentArtifactDto(
            a.Id,
            a.ArtifactType,
            a.JsonData,
            a.CreatedAtUtc
        )).ToList();

        return new CandidateAssessmentDetailResponse(response, artifacts);
    }

    public async Task ProcessAssessmentJobAsync(Guid assessmentId, CancellationToken cancellationToken = default)
    {
        var assessment = await _context.CandidateAssessments
            .Include(ca => ca.User)
            .FirstOrDefaultAsync(ca => ca.Id == assessmentId, cancellationToken);

        if (assessment == null)
        {
            _logger.LogError("Assessment {AssessmentId} not found in database.", assessmentId);
            return;
        }

        if (assessment.Status != "Queued")
        {
            _logger.LogWarning("Assessment {AssessmentId} is not in Queued state.", assessmentId);
            return;
        }

        var db = _redis.GetDatabase();
        var lockKey = $"candidate:assessment:lock:{assessment.UserId}";
        var token = Guid.NewGuid().ToString();

        // 10 minutes lock duration to protect long assessment execution
        bool acquired = await db.LockTakeAsync(lockKey, token, TimeSpan.FromMinutes(10));
        if (!acquired)
        {
            _logger.LogWarning("Could not acquire lock for candidate assessment. UserId: {UserId}", assessment.UserId);
            return;
        }

        try
        {
            assessment.Status = "Running";
            await _context.SaveChangesAsync(cancellationToken);

            await PublishProgressAsync(assessment.UserId, "Running", "Initialize", "Starting candidate assessment...", 0.0);

            // Fetch completed repositories job IDs
            var jobIds = await _repositoryProvider.GetCompletedAnalysisJobIdsAsync(assessment.UserId, cancellationToken);

            if (jobIds.Count == 0)
            {
                throw new BusinessRuleException("NO_ANALYZED_REPOS", "No completed repository analysis jobs found for this candidate.");
            }

            // Resolve CV skills
            var cvSkills = await _context.UserSkills
                .Where(us => us.UserId == assessment.UserId)
                .Select(us => us.Skill)
                .ToListAsync(cancellationToken);

            var careerPref = await _context.CareerPreferences
                .FirstOrDefaultAsync(cp => cp.UserId == assessment.UserId, cancellationToken);
            if (careerPref?.TargetSkills != null)
            {
                cvSkills = cvSkills.Concat(careerPref.TargetSkills).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            }

            // Resolve Working Experience
            var experiences = await _context.WorkExperiences
                .Where(we => we.UserId == assessment.UserId)
                .OrderByDescending(we => we.StartDate)
                .ToListAsync(cancellationToken);

            var experienceList = new List<object>();
            foreach (var exp in experiences)
            {
                var endDate = exp.EndDate ?? DateTimeOffset.UtcNow;
                var months = ((endDate.Year - exp.StartDate.Year) * 12) + endDate.Month - exp.StartDate.Month;
                experienceList.Add(new
                {
                    jobTitle = exp.JobTitle,
                    company = exp.Company,
                    isLeadership = exp.IsLeadership,
                    durationMonths = Math.Max(months, 1)
                });
            }

            var payload = new
            {
                jobIds = jobIds,
                cvSkills = cvSkills,
                workingExperience = experienceList
            };

            var payloadJson = JsonSerializer.Serialize(payload);
            var path = "/api/v1/candidate/assess/stream";

            var httpClient = _httpClientFactory.CreateClient("AiServiceClient");
            var requestMessage = new HttpRequestMessage(HttpMethod.Post, path)
            {
                Content = new StringContent(payloadJson, Encoding.UTF8, "application/json")
            };

            var (signature, timestamp, nonce) = _hmacService.CreateSignatureHeaders("POST", path, payloadJson);
            requestMessage.Headers.Add("X-Client-Id", "cverify-core");
            requestMessage.Headers.Add("X-Timestamp", timestamp);
            requestMessage.Headers.Add("X-Nonce", nonce);
            requestMessage.Headers.Add("X-Correlation-Id", assessment.Id.ToString());
            requestMessage.Headers.Add("X-Signature", signature);

            using var response = await httpClient.SendAsync(requestMessage, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                var errorMsg = await response.Content.ReadAsStringAsync(cancellationToken);
                throw new HttpRequestException($"AI service returned status code {response.StatusCode}: {errorMsg}");
            }

            using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var reader = new System.IO.StreamReader(stream);

            string? line;
            while ((line = await reader.ReadLineAsync(cancellationToken)) != null)
            {
                if (string.IsNullOrWhiteSpace(line)) continue;
                if (line.StartsWith("data: "))
                {
                    var eventData = line.Substring(6).Trim();
                    if (eventData == "[DONE]") continue;

                    var progressEvent = JsonSerializer.Deserialize<FastApiProgressEvent>(eventData, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                    if (progressEvent != null)
                    {
                        if (progressEvent.Status == "Failed")
                        {
                            assessment.FailedStage = progressEvent.Step;
                            assessment.FailureReason = progressEvent.Message;
                            throw new Exception($"AI Stream Stage Failed: {progressEvent.Message}");
                        }

                        // Publish progress to Redis channel
                        var redisJson = JsonSerializer.Serialize(progressEvent);
                        await PublishRawProgressAsync(assessment.UserId, redisJson);

                        // If stage completed with artifact, save it to DB
                        if (!string.IsNullOrEmpty(progressEvent.ArtifactType) && !string.IsNullOrEmpty(progressEvent.JsonData))
                        {
                            await SaveOrUpdateArtifactAsync(assessment.Id, progressEvent.ArtifactType, progressEvent.JsonData, cancellationToken);
                        }
                    }
                }
            }

            // Save final values from Composer's CandidateProfile artifact
            var profileArtifact = await _context.CandidateAssessmentArtifacts
                .FirstOrDefaultAsync(a => a.AssessmentId == assessment.Id && a.ArtifactType == "CandidateProfile", cancellationToken);

            if (profileArtifact == null)
            {
                throw new Exception("Final CandidateProfile artifact was not found in the assessment stream.");
            }

            using var doc = JsonDocument.Parse(profileArtifact.JsonData);
            var root = doc.RootElement;

            assessment.OverallScore = root.TryGetProperty("candidateScore", out var scoreProp) ? scoreProp.GetDouble() : 0.0;
            assessment.CareerLevel = root.TryGetProperty("careerLevel", out var lvProp) ? lvProp.GetString() : null;
            assessment.CareerLevelLabel = root.TryGetProperty("careerLevelLabel", out var lvlLabelProp) ? lvlLabelProp.GetString() : null;
            assessment.PrimaryTendency = root.TryGetProperty("primaryTendency", out var tendProp) ? tendProp.GetString() : null;
            assessment.PrimaryWorkingStyle = root.TryGetProperty("primaryWorkingStyle", out var styleProp) ? styleProp.GetString() : null;

            if (root.TryGetProperty("recruiterHeadline", out var headlineProp))
            {
                assessment.SummaryHeadline = headlineProp.GetString();
            }
            if (root.TryGetProperty("fullSummary", out var sumProp))
            {
                assessment.SummaryParagraph = sumProp.GetString();
            }

            assessment.Status = "Completed";
            assessment.CompletedAtUtc = DateTimeOffset.UtcNow;
            assessment.LastAssessmentAt = DateTimeOffset.UtcNow;

            // Touch UserProfile.LastAssessmentAt / Update
            var userProfile = await _context.UserProfiles.FirstOrDefaultAsync(up => up.UserId == assessment.UserId, cancellationToken);
            if (userProfile != null)
            {
                userProfile.UpdatedAt = DateTimeOffset.UtcNow;
            }

            await _context.SaveChangesAsync(cancellationToken);

            // Publish final completion
            await PublishProgressAsync(assessment.UserId, "Completed", "CandidateProfileComposer", "Candidate Assessment completed successfully.", 100.0);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing candidate assessment job {AssessmentId}", assessment.Id);

            assessment.Status = "Failed";
            assessment.FailureReason ??= ex.Message;
            assessment.CompletedAtUtc = DateTimeOffset.UtcNow;
            await _context.SaveChangesAsync(cancellationToken);

            // Publish failure
            await PublishProgressAsync(assessment.UserId, "Failed", assessment.FailedStage ?? "Failed", ex.Message, 100.0);
        }
        finally
        {
            await db.LockReleaseAsync(lockKey, token);
        }
    }

    private async Task SaveOrUpdateArtifactAsync(Guid assessmentId, string artifactType, string jsonData, CancellationToken cancellationToken)
    {
        var existing = await _context.CandidateAssessmentArtifacts
            .FirstOrDefaultAsync(a => a.AssessmentId == assessmentId && a.ArtifactType == artifactType, cancellationToken);

        if (existing != null)
        {
            existing.JsonData = jsonData;
        }
        else
        {
            var artifact = new CandidateAssessmentArtifact
            {
                Id = Guid.CreateVersion7(),
                AssessmentId = assessmentId,
                ArtifactType = artifactType,
                JsonData = jsonData,
                CreatedAtUtc = DateTimeOffset.UtcNow
            };
            _context.CandidateAssessmentArtifacts.Add(artifact);
        }
        await _context.SaveChangesAsync(cancellationToken);
    }

    private async Task PublishProgressAsync(Guid userId, string status, string step, string message, double percentage)
    {
        var progress = new FastApiProgressEvent
        {
            Status = status,
            Step = step,
            Message = message,
            Percentage = percentage
        };
        var json = JsonSerializer.Serialize(progress);
        await PublishRawProgressAsync(userId, json);
    }

    private async Task PublishRawProgressAsync(Guid userId, string rawJson)
    {
        var subscriber = _redis.GetSubscriber();
        var channel = $"candidate:assessment:progress:{userId}";
        await subscriber.PublishAsync(channel, rawJson);
    }

    private static CandidateAssessmentResponse MapToResponse(CandidateAssessment entity)
    {
        return new CandidateAssessmentResponse(
            entity.Id,
            entity.UserId,
            entity.Status,
            entity.OverallScore,
            entity.CareerLevel,
            entity.CareerLevelLabel,
            entity.PrimaryTendency,
            entity.PrimaryWorkingStyle,
            entity.SummaryHeadline,
            entity.SummaryParagraph,
            entity.PipelineVersion,
            entity.AssessmentSchemaVersion,
            entity.LastProfileUpdateAt,
            entity.LastRepositoryAnalysisAt,
            entity.LastAssessmentAt,
            entity.FailedStage,
            entity.FailureReason,
            entity.CreatedAtUtc,
            entity.CompletedAtUtc
        );
    }

    private class FastApiProgressEvent
    {
        public string Status { get; set; } = null!;
        public string Step { get; set; } = null!;
        public string Message { get; set; } = null!;
        public double Percentage { get; set; }
        public string? ArtifactType { get; set; }
        public string? JsonData { get; set; }
    }
}
