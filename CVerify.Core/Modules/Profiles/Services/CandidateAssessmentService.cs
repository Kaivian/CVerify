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
            CvId = userId, // Default to UserId representing the candidate's active CV
            Status = "Queued",
            PipelineVersion = "2.1.0",
            AssessmentSchemaVersion = "1.1.0",
            PromptVersion = "v2.1.0",
            ModelVersion = "gemini-1.5-flash",
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

    public async Task<CandidateAssessmentDetailResponse?> GetLatestPublicAssessmentAsync(string username, CancellationToken cancellationToken = default)
    {
        var profile = await _context.UserProfiles
            .FirstOrDefaultAsync(up => up.Username == username && up.DeletedAt == null && up.ProfileVisibility == "public", cancellationToken);

        if (profile == null) return null;

        var assessment = await _context.CandidateAssessments
            .Include(ca => ca.Artifacts)
            .Where(ca => ca.UserId == profile.UserId && ca.Status == "Completed")
            .OrderByDescending(ca => ca.CompletedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        if (assessment == null) return null;

        var response = MapToResponse(assessment);
        var publicArtifactTypes = new[] { "CandidateProfile", "SkillsList", "Maturity", "Recommendations", "StrengthsGaps" };
        var artifacts = assessment.Artifacts
            .Where(a => publicArtifactTypes.Contains(a.ArtifactType))
            .Select(a => new CandidateAssessmentArtifactDto(
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

            // Limit to top 5 repos
            var selectedJobIds = jobIds.Take(5).ToList();

            // Run parallel Repository Assessments
            var repoAssessmentTasks = selectedJobIds.Select(async jid =>
            {
                var aJob = await _context.AnalysisJobs
                    .Include(j => j.Repository)
                    .FirstOrDefaultAsync(j => j.Id == Guid.Parse(jid), cancellationToken);
                
                if (aJob == null) return null;

                var existingAssess = await _context.RepositoryAssessments
                    .FirstOrDefaultAsync(ra => ra.AnalysisJobId == aJob.Id && ra.Status == "Completed", cancellationToken);

                if (existingAssess != null)
                {
                    return new
                    {
                        repositoryId = existingAssess.RepositoryId,
                        repositoryName = aJob.Repository.Name,
                        verifiedCommitSha = existingAssess.CommitSha,
                        overallScore = existingAssess.OverallScore,
                        techStack = string.IsNullOrEmpty(existingAssess.TechStack) ? null : JsonSerializer.Deserialize<object>(existingAssess.TechStack),
                        patterns = string.IsNullOrEmpty(existingAssess.Patterns) ? null : JsonSerializer.Deserialize<object>(existingAssess.Patterns),
                        qualityMetrics = string.IsNullOrEmpty(existingAssess.QualityMetrics) ? null : JsonSerializer.Deserialize<object>(existingAssess.QualityMetrics),
                        jsonData = string.IsNullOrEmpty(existingAssess.JsonData) ? null : JsonSerializer.Deserialize<object>(existingAssess.JsonData)
                    };
                }

                var newAssess = new RepositoryAssessment
                {
                    Id = Guid.CreateVersion7(),
                    RepositoryId = aJob.RepositoryId,
                    AnalysisJobId = aJob.Id,
                    CommitSha = aJob.CommitSha ?? "unknown",
                    Status = "Running",
                    ModelVersion = "gemini-1.5-flash",
                    PromptVersion = "v2.1.0",
                    AssessmentSchemaVersion = "1.1.0",
                    PipelineVersion = "2.1.0",
                    CreatedAtUtc = DateTimeOffset.UtcNow
                };

                _context.RepositoryAssessments.Add(newAssess);
                await _context.SaveChangesAsync(cancellationToken);

                try
                {
                    var repoPayload = new
                    {
                        jobId = aJob.Id.ToString(),
                        repositoryId = aJob.RepositoryId.ToString()
                    };

                    var repoPayloadJson = JsonSerializer.Serialize(repoPayload);
                    var repoPath = "/api/v1/repository/assess";

                    var httpClient = _httpClientFactory.CreateClient("AiServiceClient");
                    var requestMessage = new HttpRequestMessage(HttpMethod.Post, repoPath)
                    {
                        Content = new StringContent(repoPayloadJson, Encoding.UTF8, "application/json")
                    };

                    var (sig, ts, non) = _hmacService.CreateSignatureHeaders("POST", repoPath, repoPayloadJson);
                    requestMessage.Headers.Add("X-Client-Id", "cverify-core");
                    requestMessage.Headers.Add("X-Timestamp", ts);
                    requestMessage.Headers.Add("X-Nonce", non);
                    requestMessage.Headers.Add("X-Correlation-Id", assessment.Id.ToString());
                    requestMessage.Headers.Add("X-Signature", sig);

                    var response = await httpClient.SendAsync(requestMessage, cancellationToken);
                    if (!response.IsSuccessStatusCode)
                    {
                        var errStr = await response.Content.ReadAsStringAsync(cancellationToken);
                        throw new Exception($"AI repo assess returned {response.StatusCode}: {errStr}");
                    }

                    var responseJson = await response.Content.ReadAsStringAsync(cancellationToken);
                    using var doc = JsonDocument.Parse(responseJson);
                    var root = doc.RootElement;

                    newAssess.Status = "Completed";
                    newAssess.CompletedAtUtc = DateTimeOffset.UtcNow;
                    newAssess.OverallScore = root.TryGetProperty("complexityScore", out var scoreProp) ? scoreProp.GetDouble() : 0.0;
                    
                    if (root.TryGetProperty("primaryLanguages", out var langProp))
                        newAssess.TechStack = JsonSerializer.Serialize(langProp);
                    if (root.TryGetProperty("verifiedPatterns", out var patProp))
                        newAssess.Patterns = JsonSerializer.Serialize(patProp);
                    if (root.TryGetProperty("qualityScore", out var qualProp))
                        newAssess.QualityMetrics = JsonSerializer.Serialize(new { qualityScore = qualProp.GetDouble(), cloneRiskClassification = root.TryGetProperty("cloneRiskClassification", out var crProp) ? crProp.GetString() : "clean" });

                    newAssess.JsonData = responseJson;
                    await _context.SaveChangesAsync(cancellationToken);

                    return new
                    {
                        repositoryId = newAssess.RepositoryId,
                        repositoryName = aJob.Repository.Name,
                        verifiedCommitSha = newAssess.CommitSha,
                        overallScore = newAssess.OverallScore,
                        techStack = string.IsNullOrEmpty(newAssess.TechStack) ? null : JsonSerializer.Deserialize<object>(newAssess.TechStack),
                        patterns = string.IsNullOrEmpty(newAssess.Patterns) ? null : JsonSerializer.Deserialize<object>(newAssess.Patterns),
                        qualityMetrics = string.IsNullOrEmpty(newAssess.QualityMetrics) ? null : JsonSerializer.Deserialize<object>(newAssess.QualityMetrics),
                        jsonData = JsonSerializer.Deserialize<object>(responseJson)
                    };
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error assessing repository {RepoName} for job {JobId}", aJob.Repository.Name, aJob.Id);
                    newAssess.Status = "Failed";
                    await _context.SaveChangesAsync(cancellationToken);
                    return null;
                }
            });

            var repoAssessResults = await Task.WhenAll(repoAssessmentTasks);
            var activeRepoAssessments = repoAssessResults.Where(r => r != null).ToList();

            // Load UserProfile detail
            var userProfile = await _context.UserProfiles
                .Include(up => up.User)
                .FirstOrDefaultAsync(up => up.UserId == assessment.UserId, cancellationToken);

            if (userProfile == null)
            {
                throw new Exception("Candidate user profile not found.");
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

            // Resolve Working Experience (Rich)
            var experiences = await _context.WorkExperiences
                .Include(we => we.Achievements)
                .Include(we => we.Technologies)
                .Include(we => we.Links)
                .Where(we => we.UserId == assessment.UserId && we.DeletedAt == null)
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
                    startDate = exp.StartDate.ToString("yyyy-MM-dd"),
                    endDate = exp.EndDate?.ToString("yyyy-MM-dd"),
                    isCurrentlyWorking = exp.IsCurrentlyWorking,
                    description = exp.Description,
                    durationMonths = Math.Max(months, 1),
                    technologies = exp.Technologies.Select(t => t.Name).ToList(),
                    achievements = exp.Achievements.Select(a => a.Description).ToList(),
                    links = exp.Links.Select(l => l.Url).ToList()
                });
            }

            // Resolve Education
            var educations = await _context.EducationEntries
                .Where(e => e.UserId == assessment.UserId && e.DeletedAt == null)
                .OrderBy(e => e.DisplayOrder)
                .ToListAsync(cancellationToken);

            var educationList = educations.Select(e => new
            {
                schoolName = e.SchoolName,
                degree = e.Degree,
                major = e.Major,
                gpa = e.GPA,
                gpaScale = e.GPAScale,
                startDate = e.StartDate?.ToString("yyyy-MM-dd"),
                endDate = e.EndDate?.ToString("yyyy-MM-dd"),
                isCurrentlyStudying = e.IsCurrentlyStudying,
                description = e.Description
            }).ToList();

            // Resolve Certifications / Academic Achievements
            var achievements = await _context.AcademicAchievements
                .Where(a => a.UserId == assessment.UserId && a.DeletedAt == null)
                .OrderBy(a => a.DisplayOrder)
                .ToListAsync(cancellationToken);

            var achievementsList = achievements.Select(a => new
            {
                title = a.Title,
                issuer = a.Issuer,
                issueDate = a.IssueDate.ToString("yyyy-MM-dd"),
                description = a.Description,
                credentialUrl = a.CredentialUrl
            }).ToList();

            // Resolve Project entries (manual CV projects)
            var projects = await _context.ProjectEntries
                .Include(p => p.Technologies)
                .Include(p => p.Contributions)
                .Include(p => p.RepositoryLinks).ThenInclude(l => l.SourceCodeRepository)
                .Where(p => p.UserId == assessment.UserId && p.DeletedAt == null)
                .OrderBy(p => p.DisplayOrder)
                .ToListAsync(cancellationToken);

            var projectList = projects.Select(proj => new
            {
                name = proj.Name,
                role = proj.Role,
                description = proj.Description,
                startDate = proj.StartDate?.ToString("yyyy-MM-dd"),
                endDate = proj.EndDate?.ToString("yyyy-MM-dd"),
                verificationLevel = proj.VerificationLevel.ToString(),
                verificationStatus = proj.VerificationStatus.ToString(),
                technologies = proj.Technologies.Select(t => t.Name).ToList(),
                contributions = proj.Contributions.Select(c => c.Content).ToList(),
                repositoryLinks = proj.RepositoryLinks.Select(l => new { name = l.SourceCodeRepository.Name, owner = l.SourceCodeRepository.Owner, htmlUrl = l.SourceCodeRepository.HtmlUrl }).ToList()
            }).ToList();

            var payload = new
            {
                cv = new
                {
                    cvId = assessment.CvId ?? assessment.UserId,
                    profile = new
                    {
                        fullName = userProfile.User.FullName,
                        headline = userProfile.Headline,
                        bio = userProfile.Bio,
                        company = userProfile.Company,
                        location = userProfile.Location,
                        socialLinks = userProfile.SocialLinks
                    },
                    skills = cvSkills,
                    experiences = experienceList,
                    educations = educationList,
                    certifications = achievementsList,
                    projects = projectList
                },
                repositoryAssessments = activeRepoAssessments
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
            userProfile = await _context.UserProfiles.FirstOrDefaultAsync(up => up.UserId == assessment.UserId, cancellationToken);
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
            entity.CvId,
            entity.PromptVersion,
            entity.ModelVersion,
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
