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
using CVerify.API.Modules.Intelligence.Services;

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
    private readonly ICandidateEvaluationService _evaluationService;
    private readonly ISkillTreeValidationService _validationService;
    private readonly IAiStreamingSessionService _streamingSessionService;
    private readonly IAiCancellationManager _cancellationManager;
    private readonly ICandidateRankingProjectionService _rankingProjectionService;

    public CandidateAssessmentService(
        ApplicationDbContext context,
        ICandidateAssessmentQueue queue,
        IHttpClientFactory httpClientFactory,
        IHmacSignatureService hmacService,
        IConnectionMultiplexer redis,
        ICandidateRepositoryProvider repositoryProvider,
        ILogger<CandidateAssessmentService> _logger,
        ICandidateEvaluationService evaluationService,
        ISkillTreeValidationService validationService,
        IAiStreamingSessionService streamingSessionService,
        IAiCancellationManager cancellationManager,
        ICandidateRankingProjectionService rankingProjectionService)
    {
        _context = context;
        _queue = queue;
        _httpClientFactory = httpClientFactory;
        _hmacService = hmacService;
        _redis = redis;
        _repositoryProvider = repositoryProvider;
        this._logger = _logger;
        _evaluationService = evaluationService;
        _validationService = validationService;
        _streamingSessionService = streamingSessionService;
        _cancellationManager = cancellationManager;
        _rankingProjectionService = rankingProjectionService;
    }

    public async Task<CandidateReadinessDto> GetReadinessStatusAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var profile = await _context.UserProfiles
            .FirstOrDefaultAsync(up => up.UserId == userId, cancellationToken);

        var missingFields = new List<MissingFieldDto>();

        var hasCompletedRepos = await _repositoryProvider.HasCompletedRepositoriesAsync(userId, cancellationToken);
        if (!hasCompletedRepos)
        {
            missingFields.Add(new MissingFieldDto(
                "Repositories",
                "CV-Linked Source Code Repositories",
                "At least one analyzed repository that is linked to your CV is required for AI code capability & engineering telemetry evaluation.",
                IsRequired: true
            ));
        }

        if (profile == null || string.IsNullOrWhiteSpace(profile.Headline))
        {
            missingFields.Add(new MissingFieldDto(
                "Headline",
                "Professional Headline",
                "A professional headline helps direct the AI assessment on your targeted career orientation.",
                IsRequired: false
            ));
        }

        if (profile == null || string.IsNullOrWhiteSpace(profile.Bio))
        {
            missingFields.Add(new MissingFieldDto(
                "Bio",
                "Professional Bio / Summary",
                "A brief professional summary contextualizes your technical experience and engineering background.",
                IsRequired: false
            ));
        }

        var hasSkills = profile != null && await _context.UserSkills.AnyAsync(us => us.UserId == userId, cancellationToken);
        bool hasTargetSkills = false;
        if (!hasSkills)
        {
            var careerPref = await _context.CareerPreferences.FirstOrDefaultAsync(cp => cp.UserId == userId, cancellationToken);
            hasTargetSkills = careerPref?.TargetSkills != null && careerPref.TargetSkills.Count > 0;
        }
        if (!hasSkills && !hasTargetSkills)
        {
            missingFields.Add(new MissingFieldDto(
                "Skills",
                "Target Technical Skills",
                "Declaring core skills helps the AI verify and cross-reference your expertise against codebase telemetry.",
                IsRequired: false
            ));
        }

        var hasEducation = await _context.EducationEntries.AnyAsync(ee => ee.UserId == userId, cancellationToken);
        if (!hasEducation)
        {
            missingFields.Add(new MissingFieldDto(
                "Education",
                "Education History",
                "Education history adds credential weight and establishes academic background context.",
                IsRequired: false
            ));
        }

        var hasExperience = await _context.WorkExperiences.AnyAsync(we => we.UserId == userId, cancellationToken);
        if (!hasExperience)
        {
            missingFields.Add(new MissingFieldDto(
                "Experiences",
                "Work Experience History",
                "Work experience is critical to map your codebase telemetry and technical contributions to real-world employment.",
                IsRequired: false
            ));
        }

        double completenessScore = Math.Round((6.0 - missingFields.Count) * 100.0 / 6.0, 1);
        bool isReady = !missingFields.Any(mf => mf.IsRequired);

        var latestAssessment = await _context.CandidateAssessments
            .Where(ca => ca.UserId == userId && ca.Status == "Completed")
            .OrderByDescending(ca => ca.CompletedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        var lastRepoAnalysisAt = await _repositoryProvider.GetLastRepositoryAnalysisAtAsync(userId, cancellationToken);

        bool requiresReassessment = latestAssessment == null
            || (profile != null && latestAssessment.CompletedAtUtc < profile.LastProfileUpdateAt)
            || latestAssessment.CompletedAtUtc < lastRepoAnalysisAt;

        return new CandidateReadinessDto(
            isReady,
            missingFields,
            completenessScore,
            requiresReassessment,
            latestAssessment?.CompletedAtUtc,
            profile?.LastProfileUpdateAt ?? DateTimeOffset.MinValue,
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
            throw new BusinessRuleException("PROFILE_INCOMPLETE", "At least one analyzed repository linked to your CV is required. Please connect, analyze, and link a repository to your CV first.");
        }

        var lastRepoAnalysisAt = await _repositoryProvider.GetLastRepositoryAnalysisAtAsync(userId, cancellationToken);

        var maxVersion = await _context.CandidateAssessments
            .Where(ca => ca.UserId == userId)
            .MaxAsync(ca => (int?)ca.Version, cancellationToken) ?? 0;

        // 4. Create new assessment
        var assessment = new CandidateAssessment
        {
            Id = Guid.CreateVersion7(),
            UserId = userId,
            CvId = userId, // Default to UserId representing the candidate's active CV
            Status = "Queued",
            PipelineVersion = "2.2.0",
            AssessmentSchemaVersion = "1.2.0",
            PromptVersion = "v2.2.0",
            ModelVersion = "claude-haiku-4-5-20251001",
            LastProfileUpdateAt = profile.LastProfileUpdateAt,
            LastRepositoryAnalysisAt = lastRepoAnalysisAt,
            Version = maxVersion + 1,
            CreatedAtUtc = DateTimeOffset.UtcNow
        };

        _context.CandidateAssessments.Add(assessment);
        await _context.SaveChangesAsync(cancellationToken);

        // Create unified AI Streaming Session
        await _streamingSessionService.CreateSessionAsync(
            sessionId: assessment.Id,
            pipelineId: "candidate-assessment",
            userId: userId,
            workspaceId: null,
            modelName: "claude-haiku-4-5-20251001",
            provider: "Google",
            pipelineVersion: "2.2.0",
            expectedOutputsJson: "[\"CandidateProfile\", \"SkillsList\", \"Maturity\", \"Recommendations\", \"StrengthsGaps\", \"SkillTree\", \"ImprovementPlan\"]"
        );

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
        var managerToken = _cancellationManager.Register(assessmentId, cancellationToken);
        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(managerToken);
        linkedCts.CancelAfter(TimeSpan.FromMinutes(10));

        var assessment = await _context.CandidateAssessments
            .Include(ca => ca.User)
            .FirstOrDefaultAsync(ca => ca.Id == assessmentId, linkedCts.Token);

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

            await _streamingSessionService.UpdateSessionStatusAsync(assessment.Id, "Running");
            await _streamingSessionService.AddLogAsync(assessment.Id, "Initialize", "Info", "Orchestrator", "Initiated candidate assessment execution pipeline.");

            await PublishProgressAsync(assessment.UserId, "Running", "Initialize", "Starting candidate assessment...", 0.0);

            const string targetPipelineVersion = "2.2.0";
            const string targetModelVersion = "claude-haiku-4-5-20251001";
            const string targetPromptVersion = "v2.1.0-scoringV2-projectionV2";
            const string targetSchemaVersion = "1.1.0";

            // Query active (non-deleted) project repository links to determine attached repositories
            var attachedLinks = await _context.ProjectRepositoryLinks
                .Include(l => l.ProjectEntry)
                .Include(l => l.SourceCodeRepository)
                .Where(l => l.ProjectEntry.UserId == assessment.UserId && l.ProjectEntry.DeletedAt == null && l.SourceCodeRepository.IsEnabled)
                .ToListAsync(cancellationToken);

            var attachedRepoIds = attachedLinks.Select(l => l.SourceCodeRepositoryId).ToHashSet();

            // Fetch completed repositories job IDs
            var jobIds = await _repositoryProvider.GetCompletedAnalysisJobIdsAsync(assessment.UserId, cancellationToken);

            var cvJobs = new List<CVerify.API.Modules.SourceCode.Entities.AnalysisJob>();

            foreach (var jid in jobIds)
            {
                var aJob = await _context.AnalysisJobs
                    .Include(j => j.Repository)
                    .FirstOrDefaultAsync(j => j.Id == Guid.Parse(jid), cancellationToken);

                if (aJob == null) continue;

                if (attachedRepoIds.Contains(aJob.RepositoryId))
                {
                    cvJobs.Add(aJob);
                }
            }

            var selectedCvJobs = cvJobs.Take(5).ToList();

            var projectCount = await _context.ProjectEntries.CountAsync(p => p.UserId == assessment.UserId && p.DeletedAt == null, cancellationToken);
            var experienceCount = await _context.WorkExperiences.CountAsync(we => we.UserId == assessment.UserId && we.DeletedAt == null, cancellationToken);

            if (selectedCvJobs.Count == 0 && projectCount == 0 && experienceCount == 0)
            {
                throw new BusinessRuleException("NO_PORTFOLIO_CONTENT", "Please add at least one project or work experience to your profile before running the assessment.");
            }

            // 1. Process CV-Attached Repositories
            var activeRepoAssessments = new List<object>();
            foreach (var aJob in selectedCvJobs)
            {
                var link = attachedLinks.FirstOrDefault(l => l.SourceCodeRepositoryId == aJob.RepositoryId);
                var entryId = link?.ProjectEntryId;
                var entryName = link?.ProjectEntry?.Name;
                var verificationLevel = link?.ProjectEntry?.VerificationLevel.ToString();
                var trustLevel = link?.ProjectEntry?.VerificationLevel == CVerify.API.Modules.Shared.Domain.Enums.ProjectVerificationLevel.AiAnalyzed ? 3 : 2;

                var existingAssess = await _context.RepositoryAssessments
                    .FirstOrDefaultAsync(ra => ra.AnalysisJobId == aJob.Id
                        && ra.Status == "Completed"
                        && ra.PipelineVersion == targetPipelineVersion
                        && ra.ModelVersion == targetModelVersion
                        && ra.PromptVersion == targetPromptVersion
                        && ra.AssessmentSchemaVersion == targetSchemaVersion, cancellationToken);

                if (existingAssess != null)
                {
                    await ProjectRelationalDataAsync(existingAssess.Id, aJob.Id, existingAssess.OverallScore, cancellationToken);
                    var payloadItem = await GetRelationalAssessPayloadAsync(existingAssess, aJob.Repository.Name, entryId, entryName, verificationLevel, trustLevel, cancellationToken);
                    activeRepoAssessments.Add(payloadItem);
                    continue;
                }

                var newAssess = new RepositoryAssessment
                {
                    Id = Guid.CreateVersion7(),
                    RepositoryId = aJob.RepositoryId,
                    AnalysisJobId = aJob.Id,
                    CommitSha = aJob.CommitSha ?? "unknown",
                    Status = "Running",
                    ModelVersion = targetModelVersion,
                    PromptVersion = targetPromptVersion,
                    AssessmentSchemaVersion = targetSchemaVersion,
                    PipelineVersion = targetPipelineVersion,
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

                    var repoHttpClient = _httpClientFactory.CreateClient("AiServiceClient");
                    var repoRequestMessage = new HttpRequestMessage(HttpMethod.Post, repoPath)
                    {
                        Content = new StringContent(repoPayloadJson, Encoding.UTF8, "application/json")
                    };

                    var (sig, ts, non) = _hmacService.CreateSignatureHeaders("POST", repoPath, repoPayloadJson);
                    repoRequestMessage.Headers.Add("X-Client-Id", "cverify-core");
                    repoRequestMessage.Headers.Add("X-Timestamp", ts);
                    repoRequestMessage.Headers.Add("X-Nonce", non);
                    repoRequestMessage.Headers.Add("X-Correlation-Id", assessment.Id.ToString());
                    repoRequestMessage.Headers.Add("X-Signature", sig);

                    var repoResponse = await repoHttpClient.SendAsync(repoRequestMessage, cancellationToken);
                    if (!repoResponse.IsSuccessStatusCode)
                    {
                        var errStr = await repoResponse.Content.ReadAsStringAsync(cancellationToken);
                        throw new Exception($"AI repo assess returned {repoResponse.StatusCode}: {errStr}");
                    }

                    var responseJson = await repoResponse.Content.ReadAsStringAsync(cancellationToken);
                    using var repoDoc = JsonDocument.Parse(responseJson);
                    var repoRoot = repoDoc.RootElement;

                    newAssess.Status = "Completed";
                    newAssess.CompletedAtUtc = DateTimeOffset.UtcNow;
                    newAssess.OverallScore = repoRoot.TryGetProperty("complexityScore", out var repoScoreProp) ? repoScoreProp.GetDouble() : 0.0;

                    if (repoRoot.TryGetProperty("primaryLanguages", out var langProp))
                        newAssess.TechStack = JsonSerializer.Serialize(langProp);
                    if (repoRoot.TryGetProperty("verifiedPatterns", out var patProp))
                        newAssess.Patterns = JsonSerializer.Serialize(patProp);
                    if (repoRoot.TryGetProperty("qualityScore", out var qualProp))
                        newAssess.QualityMetrics = JsonSerializer.Serialize(new { qualityScore = qualProp.GetDouble(), cloneRiskClassification = repoRoot.TryGetProperty("cloneRiskClassification", out var crProp) ? crProp.GetString() : "clean" });

                    newAssess.JsonData = responseJson;
                    await _context.SaveChangesAsync(cancellationToken);

                    await ProjectRelationalDataAsync(newAssess.Id, aJob.Id, newAssess.OverallScore, cancellationToken);
                    var payloadItem = await GetRelationalAssessPayloadAsync(newAssess, aJob.Repository.Name, entryId, entryName, verificationLevel, trustLevel, cancellationToken);
                    activeRepoAssessments.Add(payloadItem);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error assessing repository {RepoName} for job {JobId}", aJob.Repository.Name, aJob.Id);
                    newAssess.Status = "Failed";
                    await _context.SaveChangesAsync(cancellationToken);
                }
            }

            // 2. Process Background Repositories (Removed - CV-driven repositories only)
            var backgroundRepoAssessments = new List<object>();

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
                repositoryAssessments = activeRepoAssessments,
                backgroundRepositories = backgroundRepoAssessments
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
                        var status = progressEvent.Status ?? "Running";
                        var step = progressEvent.Step ?? "Process";
                        var msg = progressEvent.Message ?? "";
                        var pct = progressEvent.Percentage;

                        // Update unified session progress and log/stage in database
                        await _streamingSessionService.UpdateSessionProgressAsync(assessment.Id, pct, step);
                        await _streamingSessionService.UpsertStageAsync(assessment.Id, step, step, status, pct, msg, detailsJson: progressEvent.JsonData);
                        await _streamingSessionService.AddLogAsync(assessment.Id, step, status == "Failed" ? "Error" : "Info", "FastApiStream", msg);

                        if (progressEvent.InputTokens.HasValue)
                            await _streamingSessionService.AddMetricAsync(assessment.Id, step, "input_tokens", progressEvent.InputTokens.Value);
                        if (progressEvent.OutputTokens.HasValue)
                            await _streamingSessionService.AddMetricAsync(assessment.Id, step, "output_tokens", progressEvent.OutputTokens.Value);
                        if (progressEvent.CostUsd.HasValue)
                            await _streamingSessionService.AddMetricAsync(assessment.Id, step, "cost_usd", (double)progressEvent.CostUsd.Value);

                        if (!string.IsNullOrEmpty(progressEvent.ModelName))
                        {
                            var session = await _context.AiStreamingSessions.FirstOrDefaultAsync(s => s.Id == assessment.Id, cancellationToken);
                            if (session != null && session.ModelName != progressEvent.ModelName)
                            {
                                session.ModelName = progressEvent.ModelName;
                                await _context.SaveChangesAsync(cancellationToken);
                            }
                        }

                        if (progressEvent.Status == "Failed")
                        {
                            assessment.FailedStage = progressEvent.Step;
                            assessment.FailureReason = progressEvent.Message;
                            throw new Exception($"AI Stream Stage Failed: {progressEvent.Message}");
                        }

                        // Publish progress to Redis channel (using camelCase to align with client-side expectations)
                        var redisJson = JsonSerializer.Serialize(progressEvent, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
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

            // Enforce strict schema validation and fail-fast streaming logic (composer v2/v3 enforcement)
            if (!root.TryGetProperty("schemaVersion", out var schemaProp) ||
                (schemaProp.GetString() != "candidate-profile-v2" && schemaProp.GetString() != "candidate-profile-v3"))
            {
                throw new InvalidDataException("Invalid assessment schema. Stream requires 'candidate-profile-v2' or 'candidate-profile-v3'.");
            }

            if (!root.TryGetProperty("trustScoreMetrics", out var trustMetricsProp) || trustMetricsProp.ValueKind != JsonValueKind.Object)
            {
                throw new InvalidDataException("Invalid assessment contract. Stream requires 'trustScoreMetrics' object.");
            }

            if (!trustMetricsProp.TryGetProperty("verifiedSkillRatio", out _) ||
                !trustMetricsProp.TryGetProperty("verifiedRepositoryRatio", out _) ||
                !trustMetricsProp.TryGetProperty("verifiedEvidenceRatio", out _) ||
                !trustMetricsProp.TryGetProperty("candidateTrustScore", out _))
            {
                throw new InvalidDataException("Invalid assessment contract. 'trustScoreMetrics' lacks required metrics properties.");
            }

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
            if (root.TryGetProperty("professionalBio", out var bioProp))
            {
                assessment.ProfessionalBio = bioProp.GetString();
            }

            // Populate Indexing ranking columns
            assessment.TechnicalDepth = root.TryGetProperty("technicalDepth", out var depthProp) ? depthProp.GetDouble() : 0.0;
            assessment.TechnicalBreadth = root.TryGetProperty("technicalBreadth", out var breadthProp) ? breadthProp.GetDouble() : 0.0;
            assessment.LeadershipPotential = root.TryGetProperty("leadershipPotential", out var leadPProp) ? leadPProp.GetDouble() : 0.0;
            assessment.ExecutionStrength = root.TryGetProperty("executionStrength", out var execPProp) ? execPProp.GetDouble() : 0.0;
            assessment.TrustLevel = root.TryGetProperty("trustLevel", out var trustProp) ? trustProp.GetDouble() : 0.0;

            assessment.CalculationMode = "LLM_Stream";
            assessment.EvidenceCompleteness = root.TryGetProperty("evidenceCompleteness", out var ecProp) ? ecProp.GetString() : "NONE";
            assessment.CloneRiskClassification = root.TryGetProperty("cloneRiskClassification", out var crcProp) ? crcProp.GetString() : "clean";

            using (var sha = System.Security.Cryptography.SHA256.Create())
            {
                var hashBytes = sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(payloadJson));
                assessment.InputFeatureSetHash = Convert.ToHexString(hashBytes);
            }

            assessment.Status = "Completed";
            assessment.CompletedAtUtc = DateTimeOffset.UtcNow;
            assessment.LastAssessmentAt = DateTimeOffset.UtcNow;

            // Save structured relational profile collections
            await SaveCandidateRelationalProfileAsync(assessment.Id, root, cancellationToken);

            var skillTreeArtifact = await _context.CandidateAssessmentArtifacts
                .FirstOrDefaultAsync(a => a.AssessmentId == assessment.Id && a.ArtifactType == "SkillTree", cancellationToken);
            if (skillTreeArtifact != null)
            {
                using var treeDoc = JsonDocument.Parse(skillTreeArtifact.JsonData);
                await SaveCandidateSkillTreeAsync(assessment.UserId, assessment.Id, treeDoc.RootElement, cancellationToken);
            }

            // Touch UserProfile.LastAssessmentAt / Update
            userProfile = await _context.UserProfiles.FirstOrDefaultAsync(up => up.UserId == assessment.UserId, cancellationToken);
            if (userProfile != null)
            {
                userProfile.UpdatedAt = DateTimeOffset.UtcNow;

                // Update AI Suggestions JSON
                Dictionary<string, AiSuggestionItem>? suggestions = null;
                if (!string.IsNullOrEmpty(userProfile.AiSuggestionsJson))
                {
                    try
                    {
                        suggestions = JsonSerializer.Deserialize<Dictionary<string, AiSuggestionItem>>(
                            userProfile.AiSuggestionsJson,
                            new JsonSerializerOptions { PropertyNameCaseInsensitive = true }
                        );
                    }
                    catch { /* Ignore parsing errors and recreate */ }
                }

                suggestions ??= new Dictionary<string, AiSuggestionItem>();

                // 1. Headline suggestion
                if (!string.IsNullOrEmpty(assessment.SummaryHeadline))
                {
                    if (!suggestions.TryGetValue("headline", out var headlineItem))
                    {
                        headlineItem = new AiSuggestionItem { Source = "user" };
                        suggestions["headline"] = headlineItem;
                    }
                    headlineItem.AiValue = assessment.SummaryHeadline;
                    headlineItem.GeneratedAt = DateTimeOffset.UtcNow;
                }

                // 2. Bio suggestion
                if (!string.IsNullOrEmpty(assessment.ProfessionalBio))
                {
                    if (!suggestions.TryGetValue("bio", out var bioItem))
                    {
                        bioItem = new AiSuggestionItem { Source = "user" };
                        suggestions["bio"] = bioItem;
                    }
                    bioItem.AiValue = assessment.ProfessionalBio;
                    bioItem.GeneratedAt = DateTimeOffset.UtcNow;
                }

                userProfile.AiSuggestionsJson = JsonSerializer.Serialize(
                    suggestions,
                    new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }
                );
            }

            var dbStatus = await _context.CandidateAssessments
                .AsNoTracking()
                .Where(ca => ca.Id == assessment.Id)
                .Select(ca => ca.Status)
                .FirstOrDefaultAsync(cancellationToken);

            if (dbStatus == "Cancelled")
            {
                assessment.Status = "Cancelled";
                await _context.SaveChangesAsync(cancellationToken);
                throw new OperationCanceledException("Assessment was cancelled by the user.");
            }

            await _context.SaveChangesAsync(cancellationToken);

            // Recalculate candidate evaluation snapshot and capability projection
            await _evaluationService.EvaluateAndSnapshotCandidateAsync(assessment.UserId, cancellationToken);

            // Sync search profile projection immediately
            await _evaluationService.UpdateSearchProfileAsync(assessment.UserId, cancellationToken);

            // Rebuild global ranking projections immediately
            _logger.LogInformation("Rebuilding candidate ranking projections for completed assessment. CandidateId: {CandidateId}, Action: Rebuild", assessment.UserId);
            await _rankingProjectionService.RebuildRankingProjectionsAsync(cancellationToken).ConfigureAwait(false);

            var profileArtifactJson = profileArtifact?.JsonData;
            await _streamingSessionService.UpdateSessionStatusAsync(assessment.Id, "Completed", summaryData: profileArtifactJson);
            await _streamingSessionService.AddLogAsync(assessment.Id, "CandidateProfileComposer", "Success", "Orchestrator", "Candidate Assessment pipeline completed successfully.");

            // Publish final completion
            await PublishProgressAsync(assessment.UserId, "Completed", "CandidateProfileComposer", "Candidate Assessment completed successfully.", 100.0);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning("Candidate assessment job {AssessmentId} was cancelled.", assessment.Id);

            var freshAssess = await _context.CandidateAssessments.FirstOrDefaultAsync(ca => ca.Id == assessment.Id);
            if (freshAssess != null && freshAssess.Status != "Cancelled")
            {
                freshAssess.Status = "Cancelled";
                freshAssess.CompletedAtUtc = DateTimeOffset.UtcNow;
                await _context.SaveChangesAsync(CancellationToken.None);
            }

            await _streamingSessionService.UpdateSessionStatusAsync(assessment.Id, "Cancelled");
            await PublishProgressAsync(assessment.UserId, "Cancelled", "Cancelled", "Assessment cancelled by user.", 100.0);
        }
        catch (Exception ex)
        {
            var freshAssess = await _context.CandidateAssessments.FirstOrDefaultAsync(ca => ca.Id == assessment.Id);
            if (freshAssess != null && freshAssess.Status == "Cancelled")
            {
                await _streamingSessionService.UpdateSessionStatusAsync(assessment.Id, "Cancelled");
                await PublishProgressAsync(assessment.UserId, "Cancelled", "Cancelled", "Assessment cancelled by user.", 100.0);
                return;
            }

            _logger.LogError(ex, "Error processing candidate assessment job {AssessmentId}", assessment.Id);

            assessment.Status = "Failed";
            assessment.FailureReason ??= ex.Message;
            assessment.CompletedAtUtc = DateTimeOffset.UtcNow;
            await _context.SaveChangesAsync(CancellationToken.None);

            await _streamingSessionService.UpdateSessionStatusAsync(assessment.Id, "Failed", errorMessage: ex.Message);
            await _streamingSessionService.AddLogAsync(assessment.Id, "Failed", "Error", "Orchestrator", $"Pipeline failed: {ex.Message}");

            // Publish failure
            await PublishProgressAsync(assessment.UserId, "Failed", assessment.FailedStage ?? "Failed", ex.Message, 100.0);
        }
        finally
        {
            _cancellationManager.Unregister(assessmentId);
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
        var json = JsonSerializer.Serialize(progress, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        await PublishRawProgressAsync(userId, json);
    }

    private async Task PublishRawProgressAsync(Guid userId, string rawJson)
    {
        var subscriber = _redis.GetSubscriber();
        var channel = $"candidate:assessment:progress:{userId}";
        await subscriber.PublishAsync(channel, rawJson);
    }

    private static string GenerateDeterministicFallbackBio(CandidateAssessment entity)
    {
        var level = entity.CareerLevelLabel ?? "Experienced";
        var tendency = entity.PrimaryTendency ?? "Software";
        var style = entity.PrimaryWorkingStyle ?? "Feature Builder";
        return $"{level} {tendency} Engineer specializing in robust system development, operating primarily as a {style}. Proven capability in designing, building, and deploying clean, maintainable software architectures.";
    }

    private static CandidateAssessmentResponse MapToResponse(CandidateAssessment entity)
    {
        return new CandidateAssessmentResponse(
            entity.Id,
            entity.UserId,
            entity.Status,
            entity.OverallScore,
            entity.TrustLevel,
            entity.CareerLevel,
            entity.CareerLevelLabel,
            entity.PrimaryTendency,
            entity.PrimaryWorkingStyle,
            entity.SummaryHeadline,
            entity.SummaryParagraph,
            string.IsNullOrEmpty(entity.ProfessionalBio) ? GenerateDeterministicFallbackBio(entity) : entity.ProfessionalBio,
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
            entity.CompletedAtUtc,
            entity.CalculationMode,
            entity.InputFeatureSetHash,
            entity.EvidenceCompleteness,
            entity.CloneRiskClassification
        );
    }

    private async Task ProjectRelationalDataAsync(Guid assessmentId, Guid jobId, double overallScore, CancellationToken cancellationToken)
    {
        // Check if already projected
        var exists = await _context.RepositoryCapabilities.AnyAsync(c => c.RepositoryAssessmentId == assessmentId, cancellationToken);
        if (exists) return;

        var results = await _context.AnalysisTaskResults
            .Include(r => r.Task)
            .Where(r => r.Task.JobId == jobId)
            .ToListAsync(cancellationToken);

        if (results.Count == 0) return;

        // Project Skill Attributions and Domains
        var skillsTaskResult = results.FirstOrDefault(r => r.Task.TaskType == "SkillExtraction");
        var domainsDict = new Dictionary<string, List<string>>();
        var domainsConfidenceSum = new Dictionary<string, double>();
        var domainsEvidenceCount = new Dictionary<string, int>();

        if (skillsTaskResult != null && !string.IsNullOrEmpty(skillsTaskResult.ResultData))
        {
            try
            {
                using var skillsDoc = JsonDocument.Parse(skillsTaskResult.ResultData);
                var skillsRoot = skillsDoc.RootElement;
                var dataElement = skillsRoot.TryGetProperty("data", out var dProp) ? dProp : skillsRoot;
                if (dataElement.TryGetProperty("skills", out var skillsProp) && skillsProp.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in skillsProp.EnumerateArray())
                    {
                        var skillName = item.GetProperty("skill").GetString() ?? "";
                        var category = item.GetProperty("category").GetString() ?? "backend";
                        var confidence = item.GetProperty("confidence").GetDouble();
                        var evidenceList = new List<string>();
                        if (item.TryGetProperty("evidence", out var evProp) && evProp.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var ev in evProp.EnumerateArray())
                            {
                                if (ev.GetString() is string evStr) evidenceList.Add(evStr);
                            }
                        }

                        var skillAttribution = new RepositorySkillAttribution
                        {
                            Id = Guid.CreateVersion7(),
                            RepositoryAssessmentId = assessmentId,
                            SkillName = skillName,
                            ContributionWeight = (overallScore / 100.0) * (confidence / 100.0),
                            Confidence = confidence / 100.0,
                            VerificationLevel = "AiAnalyzed",
                            AssessmentVersion = "2.2.0",
                            AnalysisVersion = "1.0.0",
                            ModelVersion = "claude-3-5-sonnet-20241022",
                            PromptVersion = "v2.3.0"
                        };
                        _context.RepositorySkillAttributions.Add(skillAttribution);

                        var normCategory = category.ToLowerInvariant() switch
                        {
                            "backend" => "Backend Engineering",
                            "frontend" => "Frontend Engineering",
                            "devops" or "infra" => "DevOps & Platform Engineering",
                            "database" or "data" => "Database & Data Engineering",
                            "ml" or "ai" => "Machine Learning & AI Engineering",
                            _ => "Other Engineering"
                        };

                        if (!domainsDict.ContainsKey(normCategory))
                        {
                            domainsDict[normCategory] = new List<string>();
                            domainsConfidenceSum[normCategory] = 0.0;
                            domainsEvidenceCount[normCategory] = 0;
                        }
                        domainsDict[normCategory].Add(skillName);
                        domainsConfidenceSum[normCategory] += confidence;
                        domainsEvidenceCount[normCategory] += evidenceList.Count;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error projecting skill attributions to Postgres for job {JobId}", jobId);
            }
        }

        // Create RepositoryDomain records
        var totalDomainSkills = domainsDict.Values.Sum(v => v.Count);
        foreach (var kvp in domainsDict)
        {
            var normCategory = kvp.Key;
            var domainSkills = kvp.Value;
            var avgConfidence = domainsConfidenceSum[normCategory] / domainSkills.Count;
            var weight = totalDomainSkills > 0 ? (double)domainSkills.Count / totalDomainSkills : 0.0;

            var repoDomain = new RepositoryDomain
            {
                Id = Guid.CreateVersion7(),
                RepositoryAssessmentId = assessmentId,
                DomainName = normCategory,
                Weight = weight,
                Confidence = avgConfidence / 100.0,
                EvidenceCount = domainsEvidenceCount[normCategory],
                SupportingSignals = JsonSerializer.Serialize(domainSkills),
                AssessmentVersion = "2.2.0",
                AnalysisVersion = "1.0.0",
                ModelVersion = "claude-3-5-sonnet-20241022",
                PromptVersion = "v2.3.0"
            };
            _context.RepositoryDomains.Add(repoDomain);
        }

        // Project Capabilities
        var featuresTaskResult = results.FirstOrDefault(r => r.Task.TaskType == "FeatureExtraction");
        if (featuresTaskResult != null && !string.IsNullOrEmpty(featuresTaskResult.ResultData))
        {
            try
            {
                using var featuresDoc = JsonDocument.Parse(featuresTaskResult.ResultData);
                var featuresRoot = featuresDoc.RootElement;
                var dataElement = featuresRoot.TryGetProperty("data", out var dProp) ? dProp : featuresRoot;
                if (dataElement.TryGetProperty("features", out var featuresProp) && featuresProp.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in featuresProp.EnumerateArray())
                    {
                        var name = item.GetProperty("name").GetString() ?? "";
                        var category = item.GetProperty("category").GetString() ?? "other";
                        var complexityScore = item.GetProperty("complexity_score").GetDouble();
                        var description = item.GetProperty("description").GetString() ?? "";
                        var evidenceList = new List<string>();
                        if (item.TryGetProperty("evidence", out var evProp) && evProp.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var ev in evProp.EnumerateArray())
                            {
                                if (ev.GetString() is string evStr) evidenceList.Add(evStr);
                            }
                        }

                        var maturity = complexityScore switch
                        {
                            <= 3 => "Basic",
                            <= 6 => "Intermediate",
                            <= 8 => "Advanced",
                            _ => "Enterprise"
                        };

                        var capability = new RepositoryCapability
                        {
                            Id = Guid.CreateVersion7(),
                            RepositoryAssessmentId = assessmentId,
                            Name = name,
                            Category = category,
                            Confidence = 0.85,
                            Maturity = maturity,
                            DifficultyScore = complexityScore / 10.0,
                            Score = complexityScore * 10.0,
                            EvidenceJson = JsonSerializer.Serialize(new { description = description, evidence = evidenceList }),
                            AssessmentVersion = "2.2.0",
                            AnalysisVersion = "1.0.0",
                            ModelVersion = "claude-3-5-sonnet-20241022",
                            PromptVersion = "v2.3.0"
                        };
                        _context.RepositoryCapabilities.Add(capability);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error projecting capabilities to Postgres for job {JobId}", jobId);
            }
        }

        // Project Signals
        var trustTaskResult = results.FirstOrDefault(r => r.Task.TaskType == "TrustScore");
        var ownershipTaskResult = results.FirstOrDefault(r => r.Task.TaskType == "Ownership");
        var commitsTaskResult = results.FirstOrDefault(r => r.Task.TaskType == "CommitIntelligence");

        double scopeSignal = 0.0;
        double complexitySignal = 0.0;
        double ownershipSignal = 0.0;
        double leadershipSignal = 0.0;
        double consistencySignal = 0.0;

        if (ownershipTaskResult != null && !string.IsNullOrEmpty(ownershipTaskResult.ResultData))
        {
            try
            {
                using var ownershipDoc = JsonDocument.Parse(ownershipTaskResult.ResultData);
                var ownershipRoot = ownershipDoc.RootElement;
                var dataElement = ownershipRoot.TryGetProperty("data", out var dProp) ? dProp : ownershipRoot;
                if (dataElement.TryGetProperty("ownership_score", out var osProp))
                {
                    ownershipSignal = osProp.GetDouble();
                    if (ownershipSignal <= 1.0) ownershipSignal *= 100.0;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error parsing ownership score for job {JobId}", jobId);
            }
        }

        if (trustTaskResult != null && !string.IsNullOrEmpty(trustTaskResult.ResultData))
        {
            try
            {
                using var trustDoc = JsonDocument.Parse(trustTaskResult.ResultData);
                var trustRoot = trustDoc.RootElement;
                var dataElement = trustRoot.TryGetProperty("data", out var dProp) ? dProp : trustRoot;

                if (dataElement.TryGetProperty("dimensions", out var dimProp))
                {
                    if (dimProp.TryGetProperty("code_quality", out var ssProp)) scopeSignal = ssProp.GetDouble();
                    if (dimProp.TryGetProperty("complexity", out var csProp)) complexitySignal = csProp.GetDouble();
                    if (ownershipSignal == 0.0 && dimProp.TryGetProperty("ownership", out var osProp))
                    {
                        ownershipSignal = osProp.GetDouble();
                        if (ownershipSignal <= 1.0) ownershipSignal *= 100.0;
                    }
                    if (dimProp.TryGetProperty("commit_integrity", out var consProp)) consistencySignal = consProp.GetDouble();
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error parsing trust score signals for job {JobId}", jobId);
            }
        }

        double userCommitRatio = 1.0;
        bool isPrimaryAuthor = true;
        if (commitsTaskResult != null && !string.IsNullOrEmpty(commitsTaskResult.ResultData))
        {
            try
            {
                using var commitsDoc = JsonDocument.Parse(commitsTaskResult.ResultData);
                var commitsRoot = commitsDoc.RootElement;
                var dataElement = commitsRoot.TryGetProperty("data", out var dProp) ? dProp : commitsRoot;
                if (dataElement.TryGetProperty("ownership", out var ownProp))
                {
                    if (ownProp.TryGetProperty("user_commit_ratio", out var ratioProp)) userCommitRatio = ratioProp.GetDouble();
                    if (ownProp.TryGetProperty("is_primary_author", out var primProp)) isPrimaryAuthor = primProp.GetBoolean();
                }
            }
            catch { }
        }
        leadershipSignal = isPrimaryAuthor ? userCommitRatio * 100.0 : userCommitRatio * 50.0;

        var repoSignal = new RepositoryIntelligenceSignal
        {
            Id = Guid.CreateVersion7(),
            RepositoryAssessmentId = assessmentId,
            ScopeSignal = scopeSignal,
            ComplexitySignal = complexitySignal,
            OwnershipSignal = ownershipSignal,
            LeadershipSignal = leadershipSignal,
            ConsistencySignal = consistencySignal,
            LastUpdatedUtc = DateTimeOffset.UtcNow,
            AssessmentVersion = "2.2.0",
            AnalysisVersion = "1.0.0",
            ModelVersion = "claude-3-5-sonnet-20241022",
            PromptVersion = "v2.3.0"
        };
        _context.RepositoryIntelligenceSignals.Add(repoSignal);

        // Project Architecture (L1-006) and Code Quality (L1-011) to RepositoryAssessment if null/empty
        var repoAssess = await _context.RepositoryAssessments.FirstOrDefaultAsync(ra => ra.Id == assessmentId, cancellationToken);
        if (repoAssess != null)
        {
            var archResult = results.FirstOrDefault(r => r.Task.TaskType == "ArchitectureAnalysis");
            if (archResult != null && !string.IsNullOrEmpty(archResult.ResultData) && string.IsNullOrEmpty(repoAssess.Patterns))
            {
                try
                {
                    using var archDoc = JsonDocument.Parse(archResult.ResultData);
                    var archRoot = archDoc.RootElement;
                    var dataElement = archRoot.TryGetProperty("data", out var dProp) ? dProp : archRoot;
                    if (dataElement.TryGetProperty("patterns", out var patProp))
                    {
                        var patternList = new List<string>();
                        foreach (var p in patProp.EnumerateArray())
                        {
                            if (p.TryGetProperty("pattern", out var pName))
                            {
                                patternList.Add(pName.GetString() ?? "");
                            }
                        }
                        repoAssess.Patterns = JsonSerializer.Serialize(patternList);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error projecting architecture patterns for assessment {AssessmentId}", assessmentId);
                }
            }

            var qualityResult = results.FirstOrDefault(r => r.Task.TaskType == "CodeQuality");
            if (qualityResult != null && !string.IsNullOrEmpty(qualityResult.ResultData) && string.IsNullOrEmpty(repoAssess.QualityMetrics))
            {
                try
                {
                    using var qualDoc = JsonDocument.Parse(qualityResult.ResultData);
                    var qualRoot = qualDoc.RootElement;
                    var dataElement = qualRoot.TryGetProperty("data", out var dProp) ? dProp : qualRoot;

                    double qualityScore = 0.0;
                    if (dataElement.TryGetProperty("quality_score", out var qsProp)) qualityScore = qsProp.GetDouble();
                    else if (dataElement.TryGetProperty("score", out var sProp)) qualityScore = sProp.GetDouble();

                    repoAssess.QualityMetrics = JsonSerializer.Serialize(new
                    {
                        qualityScore = qualityScore,
                        cloneRiskClassification = "clean",
                        cicd = dataElement.TryGetProperty("cicd", out var cicdProp) ? (object)cicdProp : null,
                        testing = dataElement.TryGetProperty("testing", out var testProp) ? (object)testProp : null
                    });
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error projecting quality metrics for assessment {AssessmentId}", assessmentId);
                }
            }
        }

        await _context.SaveChangesAsync(cancellationToken);
    }

    private async Task<object> GetRelationalAssessPayloadAsync(
        RepositoryAssessment assessment,
        string repoName,
        Guid? cvProjectEntryId,
        string? cvProjectName,
        string? cvVerificationLevel,
        int trustLevel,
        CancellationToken cancellationToken)
    {
        var capabilitiesRaw = await _context.RepositoryCapabilities
            .Where(c => c.RepositoryAssessmentId == assessment.Id)
            .Select(c => new
            {
                c.Name,
                c.Category,
                c.Confidence,
                c.Maturity,
                c.DifficultyScore,
                c.Score,
                c.EvidenceJson
            })
            .ToListAsync(cancellationToken);

        var capabilitiesList = capabilitiesRaw.Select(c => new
        {
            name = c.Name,
            category = c.Category,
            confidence = c.Confidence,
            maturity = c.Maturity,
            difficultyScore = c.DifficultyScore * 10.0,
            score = c.Score,
            evidenceJson = string.IsNullOrEmpty(c.EvidenceJson) ? null : JsonSerializer.Deserialize<object>(c.EvidenceJson, (JsonSerializerOptions?)null)
        }).ToList();

        var skillsList = await _context.RepositorySkillAttributions
            .Where(s => s.RepositoryAssessmentId == assessment.Id)
            .Select(s => new
            {
                skillName = s.SkillName,
                contributionWeight = s.ContributionWeight,
                confidence = s.Confidence,
                verificationLevel = s.VerificationLevel
            })
            .ToListAsync(cancellationToken);

        var domainsRaw = await _context.RepositoryDomains
            .Where(d => d.RepositoryAssessmentId == assessment.Id)
            .Select(d => new
            {
                d.DomainName,
                d.Weight,
                d.Confidence,
                d.EvidenceCount,
                d.SupportingSignals
            })
            .ToListAsync(cancellationToken);

        var domainsList = domainsRaw.Select(d => new
        {
            domainName = d.DomainName,
            weight = d.Weight,
            confidence = d.Confidence,
            evidenceCount = d.EvidenceCount,
            supportingSignals = string.IsNullOrEmpty(d.SupportingSignals) ? null : JsonSerializer.Deserialize<object>(d.SupportingSignals, (JsonSerializerOptions?)null)
        }).ToList();

        var signalEntity = await _context.RepositoryIntelligenceSignals
            .FirstOrDefaultAsync(s => s.RepositoryAssessmentId == assessment.Id, cancellationToken);

        var intelligenceSignal = signalEntity == null ? null : new
        {
            scopeSignal = signalEntity.ScopeSignal,
            complexitySignal = signalEntity.ComplexitySignal,
            ownershipSignal = signalEntity.OwnershipSignal,
            leadershipSignal = signalEntity.LeadershipSignal,
            consistencySignal = signalEntity.ConsistencySignal
        };

        return new
        {
            repositoryId = assessment.RepositoryId,
            repositoryName = repoName,
            verifiedCommitSha = assessment.CommitSha,
            overallScore = assessment.OverallScore,
            techStack = string.IsNullOrEmpty(assessment.TechStack) ? null : JsonSerializer.Deserialize<object>(assessment.TechStack, (JsonSerializerOptions?)null),
            patterns = string.IsNullOrEmpty(assessment.Patterns) ? null : JsonSerializer.Deserialize<object>(assessment.Patterns, (JsonSerializerOptions?)null),
            qualityMetrics = string.IsNullOrEmpty(assessment.QualityMetrics) ? null : JsonSerializer.Deserialize<object>(assessment.QualityMetrics, (JsonSerializerOptions?)null),
            jsonData = string.IsNullOrEmpty(assessment.JsonData) ? null : JsonSerializer.Deserialize<object>(assessment.JsonData, (JsonSerializerOptions?)null),
            capabilities = capabilitiesList,
            skillAttributions = skillsList,
            domains = domainsList,
            intelligenceSignal = intelligenceSignal,
            cvProjectEntryId = cvProjectEntryId,
            cvProjectName = cvProjectName,
            cvVerificationLevel = cvVerificationLevel,
            trustLevel = trustLevel
        };
    }

    private async Task SaveCandidateRelationalProfileAsync(Guid assessmentId, JsonElement root, CancellationToken cancellationToken)
    {
        // Clean old records for idempotency (e.g. if we reassess or retry)
        var oldSkills = await _context.CandidateSkills.Where(s => s.CandidateAssessmentId == assessmentId).ToListAsync(cancellationToken);
        _context.CandidateSkills.RemoveRange(oldSkills);

        var oldDomains = await _context.CandidateDomainProfiles.Where(d => d.CandidateAssessmentId == assessmentId).ToListAsync(cancellationToken);
        _context.CandidateDomainProfiles.RemoveRange(oldDomains);

        var oldSignals = await _context.CandidateIntelligenceSignals.Where(s => s.CandidateAssessmentId == assessmentId).ToListAsync(cancellationToken);
        _context.CandidateIntelligenceSignals.RemoveRange(oldSignals);

        var oldRoles = await _context.CandidateBestFitRoles.Where(r => r.CandidateAssessmentId == assessmentId).ToListAsync(cancellationToken);
        _context.CandidateBestFitRoles.RemoveRange(oldRoles);

        var oldSW = await _context.CandidateStrengthsWeaknesses.Where(sw => sw.CandidateAssessmentId == assessmentId).ToListAsync(cancellationToken);
        _context.CandidateStrengthsWeaknesses.RemoveRange(oldSW);

        await _context.SaveChangesAsync(cancellationToken);

        // 1. Save Skills
        if (root.TryGetProperty("skills", out var skillsProp) && skillsProp.ValueKind == JsonValueKind.Array)
        {
            foreach (var s in skillsProp.EnumerateArray())
            {
                var skill = new CandidateSkill
                {
                    Id = Guid.CreateVersion7(),
                    CandidateAssessmentId = assessmentId,
                    SkillName = s.GetProperty("skillName").GetString() ?? "unknown",
                    Score = s.GetProperty("score").GetDouble(),
                    Confidence = s.GetProperty("confidence").GetDouble(),
                    Level = s.GetProperty("level").GetString() ?? "Working",
                    EvidenceSources = s.TryGetProperty("evidenceSources", out var evProp) ? evProp.GetString() : null
                };
                _context.CandidateSkills.Add(skill);
            }
        }

        // 2. Save Domain Profiles
        if (root.TryGetProperty("domainProfiles", out var domainsProp) && domainsProp.ValueKind == JsonValueKind.Array)
        {
            foreach (var d in domainsProp.EnumerateArray())
            {
                var dom = new CandidateDomainProfile
                {
                    Id = Guid.CreateVersion7(),
                    CandidateAssessmentId = assessmentId,
                    DomainName = d.GetProperty("domainName").GetString() ?? "unknown",
                    Score = d.GetProperty("score").GetDouble(),
                    Confidence = d.GetProperty("confidence").GetDouble(),
                    Seniority = d.GetProperty("seniority").GetString() ?? "Middle",
                    SupportingEvidence = d.TryGetProperty("supportingEvidence", out var evProp) ? evProp.GetString() : null
                };
                _context.CandidateDomainProfiles.Add(dom);
            }
        }

        // 3. Save Signals
        var scope = root.TryGetProperty("technicalBreadth", out var scProp) ? scProp.GetDouble() : 0.0;
        var complexity = root.TryGetProperty("technicalDepth", out var compProp) ? compProp.GetDouble() : 0.0;

        double verifiedSkillRatio = 0.0;
        double verifiedRepoRatio = 0.0;
        double verifiedEvidenceRatio = 0.0;
        double candidateTrustScore = 0.0;
        if (root.TryGetProperty("trustScoreMetrics", out var tProp))
        {
            if (tProp.TryGetProperty("verifiedSkillRatio", out var r1)) verifiedSkillRatio = r1.GetDouble();
            if (tProp.TryGetProperty("verifiedRepositoryRatio", out var r2)) verifiedRepoRatio = r2.GetDouble();
            if (tProp.TryGetProperty("verifiedEvidenceRatio", out var r3)) verifiedEvidenceRatio = r3.GetDouble();
            if (tProp.TryGetProperty("candidateTrustScore", out var r4)) candidateTrustScore = r4.GetDouble();
        }

        double ownershipVal = 0.0;
        if (root.TryGetProperty("capabilityVector", out var capVectorProp) && capVectorProp.ValueKind == JsonValueKind.Object)
        {
            if (capVectorProp.TryGetProperty("dimensions", out var dimsProp) && dimsProp.ValueKind == JsonValueKind.Object)
            {
                if (dimsProp.TryGetProperty("ownership", out var ownProp)) ownershipVal = ownProp.GetDouble();
            }
            else if (capVectorProp.TryGetProperty("ownership", out var ownProp))
            {
                ownershipVal = ownProp.GetDouble();
            }
        }
        else if (root.TryGetProperty("ownership", out var ownProp))
        {
            ownershipVal = ownProp.GetDouble();
        }

        var signals = new CandidateIntelligenceSignal
        {
            Id = Guid.CreateVersion7(),
            CandidateAssessmentId = assessmentId,
            ScopeSignal = scope,
            ComplexitySignal = complexity,
            OwnershipSignal = ownershipVal,
            LeadershipSignal = root.TryGetProperty("leadershipPotential", out var leadProp) ? leadProp.GetDouble() : 0.0,
            ConsistencySignal = root.TryGetProperty("executionStrength", out var execProp) ? execProp.GetDouble() : 0.0,
            DeliverySignal = verifiedRepoRatio * 100.0,
            EngineeringMaturitySignal = root.TryGetProperty("engineeringMaturityScore", out var matProp) ? matProp.GetDouble() : 50.0,
            ProblemSolvingSignal = root.TryGetProperty("problemSolvingScore", out var probProp) ? probProp.GetDouble() : 50.0,
            LastUpdatedUtc = DateTimeOffset.UtcNow
        };
        _context.CandidateIntelligenceSignals.Add(signals);

        // 4. Save Best-Fit Roles
        if (root.TryGetProperty("bestFitRoles", out var rolesProp) && rolesProp.ValueKind == JsonValueKind.Array)
        {
            foreach (var r in rolesProp.EnumerateArray())
            {
                var role = new CandidateBestFitRole
                {
                    Id = Guid.CreateVersion7(),
                    CandidateAssessmentId = assessmentId,
                    RoleTitle = r.GetProperty("roleTitle").GetString() ?? "unknown",
                    MatchScore = r.GetProperty("matchScore").GetDouble(),
                    Confidence = r.GetProperty("confidence").GetDouble(),
                    Rank = r.GetProperty("rank").GetInt32(),
                    MatchingEngineVersion = r.TryGetProperty("matchingEngineVersion", out var mvProp) ? mvProp.GetString() ?? "V1" : "V1",
                    Evidence = r.TryGetProperty("evidence", out var evProp) ? evProp.GetString() : null,
                    EngineMetadata = r.TryGetProperty("engineMetadata", out var metaProp) ? metaProp.GetString() : null
                };
                _context.CandidateBestFitRoles.Add(role);
            }
        }

        // 5. Save Strengths & Weaknesses
        if (root.TryGetProperty("strengthsWeaknesses", out var swProp) && swProp.ValueKind == JsonValueKind.Array)
        {
            foreach (var sw in swProp.EnumerateArray())
            {
                var item = new CandidateStrengthWeakness
                {
                    Id = Guid.CreateVersion7(),
                    CandidateAssessmentId = assessmentId,
                    FindingType = sw.GetProperty("findingType").GetString() ?? "Strength",
                    Topic = sw.GetProperty("topic").GetString() ?? "General",
                    Description = sw.GetProperty("description").GetString() ?? "",
                    Evidence = sw.TryGetProperty("evidence", out var evProp) ? evProp.GetString() : null
                };
                _context.CandidateStrengthsWeaknesses.Add(item);
            }
        }

        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<List<CandidateSkillTreeNodeResponse>?> GetSkillTreeAsync(Guid userId, Guid assessmentId, CancellationToken cancellationToken = default)
    {
        var assessment = await _context.CandidateAssessments
            .FirstOrDefaultAsync(a => a.Id == assessmentId && a.UserId == userId, cancellationToken)
            .ConfigureAwait(false);

        if (assessment == null) return null;

        return await BuildSkillTreeFromDbAsync(assessmentId, cancellationToken).ConfigureAwait(false);
    }

    public async Task<List<CandidateSkillTreeNodeResponse>?> GetPublicSkillTreeAsync(string username, CancellationToken cancellationToken = default)
    {
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Username.ToLower() == username.ToLower(), cancellationToken)
            .ConfigureAwait(false);

        if (user == null) return null;

        var latestAssessment = await _context.CandidateAssessments
            .Where(a => a.UserId == user.Id && a.Status == "Completed")
            .OrderByDescending(a => a.CompletedAtUtc)
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

        if (latestAssessment == null) return null;

        return await BuildSkillTreeFromDbAsync(latestAssessment.Id, cancellationToken).ConfigureAwait(false);
    }

    private async Task<List<CandidateSkillTreeNodeResponse>> BuildSkillTreeFromDbAsync(Guid assessmentId, CancellationToken cancellationToken)
    {
        var nodes = await _context.CandidateSkillTreeNodes
            .Where(n => n.CandidateAssessmentId == assessmentId)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        if (!nodes.Any()) return new List<CandidateSkillTreeNodeResponse>();

        var nodeMap = nodes.Select(n => new CandidateSkillTreeNodeResponse
        {
            Id = n.Id,
            ParentId = n.ParentId,
            DisplayName = n.DisplayName,
            Category = n.Category,
            ProficiencyLevel = n.ProficiencyLevel,
            ConfidenceScore = n.ConfidenceScore,
            EstimatedExperienceMonths = n.EstimatedExperienceMonths,
            SupportingEvidence = n.SupportingEvidence,
            Children = new List<CandidateSkillTreeNodeResponse>()
        }).ToDictionary(n => n.Id);

        var rootNodes = new List<CandidateSkillTreeNodeResponse>();

        foreach (var node in nodeMap.Values)
        {
            if (node.ParentId.HasValue && nodeMap.TryGetValue(node.ParentId.Value, out var parentNode))
            {
                parentNode.Children.Add(node);
            }
            else
            {
                rootNodes.Add(node);
            }
        }

        return rootNodes;
    }

    private async Task SaveCandidateSkillTreeAsync(Guid candidateId, Guid assessmentId, JsonElement skillTreeRoot, CancellationToken cancellationToken)
    {
        var validatedNodes = await _validationService.ValidateAndNormalizeTreeAsync(candidateId, assessmentId, skillTreeRoot);

        var oldNodes = await _context.CandidateSkillTreeNodes
            .Where(n => n.CandidateAssessmentId == assessmentId)
            .ToListAsync(cancellationToken);
        _context.CandidateSkillTreeNodes.RemoveRange(oldNodes);
        await _context.SaveChangesAsync(cancellationToken);

        if (validatedNodes.Any())
        {
            _context.CandidateSkillTreeNodes.AddRange(validatedNodes);
            await _context.SaveChangesAsync(cancellationToken);
        }
    }

    private class FastApiProgressEvent
    {
        public string Status { get; set; } = null!;
        public string Step { get; set; } = null!;
        public string Message { get; set; } = null!;
        public double Percentage { get; set; }
        public string? ArtifactType { get; set; }
        public string? JsonData { get; set; }
        public string? EventType { get; set; }
        public int? InputTokens { get; set; }
        public int? OutputTokens { get; set; }
        public decimal? CostUsd { get; set; }
        public long? DurationMs { get; set; }
        public string? ModelName { get; set; }
    }

    private class AiSuggestionItem
    {
        public string? AiValue { get; set; }
        public string? Source { get; set; }
        public DateTimeOffset? GeneratedAt { get; set; }
    }

    public async Task<bool> CancelAssessmentAsync(Guid userId, Guid assessmentId)
    {
        var assessment = await _context.CandidateAssessments
            .FirstOrDefaultAsync(ca => ca.Id == assessmentId && ca.UserId == userId);

        if (assessment == null) return false;

        var activeStates = new[] { "Queued", "Running" };
        if (!activeStates.Contains(assessment.Status))
        {
            return false;
        }

        assessment.Status = "Cancelled";
        assessment.CompletedAtUtc = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync();

        // 1. Set Redis cancellation key for Python AI service
        try
        {
            var db = _redis.GetDatabase();
            await db.StringSetAsync($"ai:cancel:{assessmentId}", "true", TimeSpan.FromMinutes(5));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to set Redis cancellation key for assessment {AssessmentId}", assessmentId);
        }

        // 2. Cancel C# token via IAiCancellationManager
        _cancellationManager.Cancel(assessmentId);

        // 3. Update unified streaming session so client-side and server-side state is synchronized
        await _streamingSessionService.UpdateSessionStatusAsync(assessmentId, "Cancelled");

        // Broadcast to Redis Pub/Sub to notify listening SSE connections
        await PublishProgressAsync(userId, "Cancelled", "Cancelled", "Assessment cancelled by user.", 100.0);

        return true;
    }

    private async Task<object> BuildCvPayloadAsync(Guid userId, CancellationToken cancellationToken)
    {
        var userProfile = await _context.UserProfiles
            .Include(up => up.User)
            .FirstOrDefaultAsync(up => up.UserId == userId, cancellationToken);

        if (userProfile == null)
        {
            throw new Exception("Candidate user profile not found.");
        }

        var cvSkills = await _context.UserSkills
            .Where(us => us.UserId == userId)
            .Select(us => us.Skill)
            .ToListAsync(cancellationToken);

        var careerPref = await _context.CareerPreferences
            .FirstOrDefaultAsync(cp => cp.UserId == userId, cancellationToken);
        if (careerPref?.TargetSkills != null)
        {
            cvSkills = cvSkills.Concat(careerPref.TargetSkills).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        }

        var experiences = await _context.WorkExperiences
            .Include(we => we.Achievements)
            .Include(we => we.Technologies)
            .Include(we => we.Links)
            .Where(we => we.UserId == userId && we.DeletedAt == null)
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

        var educations = await _context.EducationEntries
            .Where(e => e.UserId == userId && e.DeletedAt == null)
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

        var achievements = await _context.AcademicAchievements
            .Where(a => a.UserId == userId && a.DeletedAt == null)
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

        var projects = await _context.ProjectEntries
            .Include(p => p.Technologies)
            .Include(p => p.Contributions)
            .Include(p => p.RepositoryLinks).ThenInclude(l => l.SourceCodeRepository)
            .Where(p => p.UserId == userId && p.DeletedAt == null)
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

        return new
        {
            cvId = userId.ToString(),
            candidate = new
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
        };
    }

    public async Task ReprocessAssessmentAsync(Guid assessmentId, CancellationToken cancellationToken = default)
    {
        var ca = await _context.CandidateAssessments
            .Include(x => x.Artifacts)
            .FirstOrDefaultAsync(a => a.Id == assessmentId, cancellationToken);
        if (ca == null) return;

        var completedJobs = await _context.AnalysisJobs
            .Include(j => j.Repository)
            .Where(j => j.UserId == ca.UserId && j.Status == "Completed")
            .ToListAsync(cancellationToken);

        var repos = completedJobs.Select(j => j.Repository)
            .Where(r => r.IsEnabled)
            .GroupBy(r => r.Id)
            .Select(g => g.First())
            .ToList();

        var jobIds = completedJobs.Select(j => j.Id).ToList();

        var repoAssessments = await _context.RepositoryAssessments
            .Where(ra => jobIds.Contains(ra.AnalysisJobId) && ra.Status == "Completed")
            .ToListAsync(cancellationToken);

        var activeRepoAssessments = new List<object>();
        foreach (var ra in repoAssessments)
        {
            var job = completedJobs.First(j => j.Id == ra.AnalysisJobId);
            var cvProjectLink = await _context.ProjectRepositoryLinks
                .Include(link => link.ProjectEntry)
                .FirstOrDefaultAsync(link => link.SourceCodeRepositoryId == job.RepositoryId && link.ProjectEntry.UserId == ca.UserId && link.ProjectEntry.DeletedAt == null, cancellationToken);

            Guid? entryId = cvProjectLink?.ProjectEntryId;
            string? entryName = cvProjectLink?.ProjectEntry.Name;
            string? verificationLevel = cvProjectLink != null ? "RepositoryLinked" : "AiAnalyzed";
            int trustLevel = 3;

            var payloadItem = await GetRelationalAssessPayloadAsync(ra, job.Repository.Name, entryId, entryName, verificationLevel, trustLevel, cancellationToken);
            activeRepoAssessments.Add(payloadItem);
        }

        var cvPayload = await BuildCvPayloadAsync(ca.UserId, cancellationToken);

        var signals = await _context.CandidateIntelligenceSignals
            .FirstOrDefaultAsync(s => s.CandidateAssessmentId == ca.Id, cancellationToken);

        var payload = new
        {
            cv = cvPayload,
            repositoryAssessments = activeRepoAssessments,
            skillProficiencies = (object)null,
            historicalMaturityScore = signals?.EngineeringMaturitySignal,
            historicalProblemSolvingScore = signals?.ProblemSolvingSignal
        };

        var payloadJson = JsonSerializer.Serialize(payload);
        var path = "/api/v1/candidate/assess/score";

        var httpClient = _httpClientFactory.CreateClient("AiServiceClient");
        var requestMessage = new HttpRequestMessage(HttpMethod.Post, path)
        {
            Content = new StringContent(payloadJson, Encoding.UTF8, "application/json")
        };

        var (signature, timestamp, nonce) = _hmacService.CreateSignatureHeaders("POST", path, payloadJson);
        requestMessage.Headers.Add("X-Client-Id", "cverify-core");
        requestMessage.Headers.Add("X-Timestamp", timestamp);
        requestMessage.Headers.Add("X-Nonce", nonce);
        requestMessage.Headers.Add("X-Correlation-Id", ca.Id.ToString());
        requestMessage.Headers.Add("X-Signature", signature);

        var response = await httpClient.SendAsync(requestMessage, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var errorMsg = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new HttpRequestException($"AI service returned status code {response.StatusCode} for scoring: {errorMsg}");
        }

        var resultJson = await response.Content.ReadAsStringAsync(cancellationToken);
        using var doc = JsonDocument.Parse(resultJson);
        JsonElement root = doc.RootElement;

        // Enforce strict schema validation and fail-fast reprocessing logic (composer v2 enforcement)
        if (!root.TryGetProperty("schemaVersion", out var schemaProp) || schemaProp.GetString() != "candidate-profile-v2")
        {
            throw new InvalidDataException("Invalid assessment schema. Reprocess requires 'candidate-profile-v2'.");
        }

        if (!root.TryGetProperty("trustScoreMetrics", out var trustMetricsProp) || trustMetricsProp.ValueKind != JsonValueKind.Object)
        {
            throw new InvalidDataException("Invalid assessment contract. Reprocess requires 'trustScoreMetrics' object.");
        }

        if (!trustMetricsProp.TryGetProperty("verifiedSkillRatio", out _) ||
            !trustMetricsProp.TryGetProperty("verifiedRepositoryRatio", out _) ||
            !trustMetricsProp.TryGetProperty("verifiedEvidenceRatio", out _) ||
            !trustMetricsProp.TryGetProperty("candidateTrustScore", out _))
        {
            throw new InvalidDataException("Invalid assessment contract. 'trustScoreMetrics' lacks required metrics properties.");
        }

        var profileArtifact = ca.Artifacts.FirstOrDefault(a => a.ArtifactType == "CandidateProfile");
        JsonDocument? finalDoc = null;

        try
        {
            // Preserve AI-generated qualitative fields
            if (profileArtifact != null && !string.IsNullOrEmpty(profileArtifact.JsonData))
            {
                try
                {
                    var oldObj = System.Text.Json.Nodes.JsonNode.Parse(profileArtifact.JsonData)?.AsObject();
                    var newObj = System.Text.Json.Nodes.JsonNode.Parse(resultJson)?.AsObject();
                    if (oldObj != null && newObj != null)
                    {
                        var keysToPreserve = new[] { "recruiterHeadline", "fullSummary", "professionalBio", "keyStrengths", "watchPoints", "cvImprovementSuggestions", "strengthsWeaknesses", "evidenceGovernance" };
                        _logger.LogInformation("[REPROCESS_MERGE] Assessment: {AssessmentId}, Preserved Keys: {Keys}", ca.Id, string.Join(", ", keysToPreserve));
                        foreach (var key in keysToPreserve)
                        {
                            if (oldObj.TryGetPropertyValue(key, out var oldVal) && oldVal != null)
                            {
                                oldObj.Remove(key);
                                newObj[key] = oldVal;
                            }
                        }
                        resultJson = newObj.ToJsonString();
                        finalDoc = JsonDocument.Parse(resultJson);
                        root = finalDoc.RootElement;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to merge old narratives into the reprocessed candidate profile.");
                }
            }

            ca.OverallScore = root.TryGetProperty("candidateScore", out var scoreProp) ? scoreProp.GetDouble() : 0.0;
            ca.CareerLevel = root.TryGetProperty("careerLevel", out var lvProp) ? lvProp.GetString() : null;
            ca.CareerLevelLabel = root.TryGetProperty("careerLevelLabel", out var lvlLabelProp) ? lvlLabelProp.GetString() : null;
            ca.PrimaryTendency = root.TryGetProperty("primaryTendency", out var tendProp) ? tendProp.GetString() : null;
            ca.PrimaryWorkingStyle = root.TryGetProperty("primaryWorkingStyle", out var styleProp) ? styleProp.GetString() : null;

            if (root.TryGetProperty("recruiterHeadline", out var headlineProp))
            {
                ca.SummaryHeadline = headlineProp.GetString();
            }
            if (root.TryGetProperty("fullSummary", out var sumProp))
            {
                ca.SummaryParagraph = sumProp.GetString();
            }
            if (root.TryGetProperty("professionalBio", out var bioProp))
            {
                ca.ProfessionalBio = bioProp.GetString();
            }

            ca.CompletedAtUtc = DateTimeOffset.UtcNow;
            ca.TechnicalDepth = root.TryGetProperty("technicalDepth", out var depthProp) ? depthProp.GetDouble() : 0.0;
            ca.TechnicalBreadth = root.TryGetProperty("technicalBreadth", out var breadthProp) ? breadthProp.GetDouble() : 0.0;
            ca.LeadershipPotential = root.TryGetProperty("leadershipPotential", out var leadProp) ? leadProp.GetDouble() : 0.0;
            ca.ExecutionStrength = root.TryGetProperty("executionStrength", out var execProp) ? execProp.GetDouble() : 0.0;
            ca.TrustLevel = root.TryGetProperty("trustLevel", out var trustProp) ? trustProp.GetDouble() : 0.0;

            ca.CalculationMode = "Deterministic_Scoring";
            ca.EvidenceCompleteness = root.TryGetProperty("evidenceCompleteness", out var ecProp) ? ecProp.GetString() : "NONE";
            ca.CloneRiskClassification = root.TryGetProperty("cloneRiskClassification", out var crcProp) ? crcProp.GetString() : "clean";

            using (var sha = System.Security.Cryptography.SHA256.Create())
            {
                var hashBytes = sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(payloadJson));
                ca.InputFeatureSetHash = Convert.ToHexString(hashBytes);
            }

            if (profileArtifact == null)
            {
                profileArtifact = new CandidateAssessmentArtifact
                {
                    Id = Guid.CreateVersion7(),
                    AssessmentId = ca.Id,
                    ArtifactType = "CandidateProfile",
                    CreatedAtUtc = DateTimeOffset.UtcNow
                };
                _context.CandidateAssessmentArtifacts.Add(profileArtifact);
            }
            profileArtifact.JsonData = resultJson;

            await _context.SaveChangesAsync(cancellationToken);

            await SaveCandidateRelationalProfileAsync(ca.Id, root, cancellationToken);

            var skillTreeArtifact = await _context.CandidateAssessmentArtifacts
                .FirstOrDefaultAsync(a => a.AssessmentId == ca.Id && a.ArtifactType == "SkillTree", cancellationToken);
            if (skillTreeArtifact != null)
            {
                using var treeDoc = JsonDocument.Parse(skillTreeArtifact.JsonData);
                await SaveCandidateSkillTreeAsync(ca.UserId, ca.Id, treeDoc.RootElement, cancellationToken);
            }

            await _rankingProjectionService.RebuildRankingProjectionsAsync(cancellationToken);
        }
        finally
        {
            finalDoc?.Dispose();
        }
    }

    public async Task ReprocessAllAssessmentsAsync(CancellationToken cancellationToken = default)
    {
        var completedAssessments = await _context.CandidateAssessments
            .Where(ca => ca.Status == "Completed")
            .ToListAsync(cancellationToken);

        foreach (var ca in completedAssessments)
        {
            try
            {
                await ReprocessAssessmentAsync(ca.Id, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to reprocess candidate assessment {AssessmentId}", ca.Id);
            }
        }
    }
}
