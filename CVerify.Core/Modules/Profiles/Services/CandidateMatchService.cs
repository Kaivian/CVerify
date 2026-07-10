using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.System.Services;
using CVerify.API.Modules.Shared.System.DTOs;
using CVerify.API.Modules.Profiles.Entities;
using StackExchange.Redis;
using Microsoft.Extensions.DependencyInjection;
using CVerify.API.Modules.Intelligence.Services;

namespace CVerify.API.Modules.Profiles.Services;

public class CandidateMatchService : ICandidateMatchService
{
    private readonly ApplicationDbContext _context;
    private readonly ICapabilityCatalogService _catalogService;
    private readonly IHiringRequirementService _hiringRequirementService;
    private readonly IConnectionMultiplexer _redis;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ICandidateEvaluationService _evaluationService;
    private readonly IUnifiedMatchingEngine _matchingEngine;
    private readonly IAiCancellationManager _cancellationManager;
    private readonly IAiStreamingSessionService _streamingSessionService;
    private readonly ILogger<CandidateMatchService> _logger;

    public CandidateMatchService(
        ApplicationDbContext context,
        ICapabilityCatalogService catalogService,
        IHiringRequirementService hiringRequirementService,
        IConnectionMultiplexer redis,
        IServiceScopeFactory scopeFactory,
        ICandidateEvaluationService evaluationService,
        IUnifiedMatchingEngine matchingEngine,
        IAiCancellationManager cancellationManager,
        IAiStreamingSessionService streamingSessionService,
        ILogger<CandidateMatchService> logger)
    {
        _context = context;
        _catalogService = catalogService;
        _hiringRequirementService = hiringRequirementService;
        _redis = redis;
        _scopeFactory = scopeFactory;
        _evaluationService = evaluationService;
        _matchingEngine = matchingEngine;
        _cancellationManager = cancellationManager;
        _streamingSessionService = streamingSessionService;
        _logger = logger;
    }

    public async Task<List<CandidateMatchDto>> GetCandidateMatchesAsync(Guid requirementId, CancellationToken cancellationToken)
    {
        var req = await _context.HiringRequirements
            .Include(r => r.BusinessOutcomes)
            .Include(r => r.Responsibilities)
            .Include(r => r.Capabilities)
                .ThenInclude(c => c.EvidenceSignals)
            .Include(r => r.TechnologyRequirements)
            .FirstOrDefaultAsync(r => r.Id == requirementId, cancellationToken);

        if (req == null)
        {
            throw new KeyNotFoundException("Hiring requirement not found.");
        }

        var snapshot = await _context.RequirementSnapshots
            .Include(s => s.RequirementVectorSnapshot)
            .Include(s => s.EvaluationRubricSnapshot)
            .Where(s => s.HiringRequirementId == requirementId)
            .OrderByDescending(s => s.Version)
            .FirstOrDefaultAsync(cancellationToken);

        List<RequirementCapabilityDto> requiredCapabilities;
        List<TechnologyRequirementDto> requiredSkills;
        List<ResponsibilityDto> requiredResponsibilities;
        decimal? salaryMin = req.SalaryMin;
        decimal? salaryMax = req.SalaryMax;

        if (snapshot != null)
        {
            requiredCapabilities = !string.IsNullOrEmpty(snapshot.CapabilitiesJson)
                ? JsonSerializer.Deserialize<List<RequirementCapabilityDto>>(snapshot.CapabilitiesJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new()
                : new();

            requiredSkills = !string.IsNullOrEmpty(snapshot.TechnologyRequirementsJson)
                ? JsonSerializer.Deserialize<List<TechnologyRequirementDto>>(snapshot.TechnologyRequirementsJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new()
                : new();

            requiredResponsibilities = !string.IsNullOrEmpty(snapshot.ResponsibilitiesJson)
                ? JsonSerializer.Deserialize<List<ResponsibilityDto>>(snapshot.ResponsibilitiesJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new()
                : new();

            salaryMin = snapshot.SalaryMin;
            salaryMax = snapshot.SalaryMax;
        }
        else
        {
            requiredCapabilities = req.Capabilities.Select(c => new RequirementCapabilityDto(
                c.CapabilityId,
                c.Name,
                c.Category,
                c.Priority,
                c.OwnershipLevel,
                c.ExpectedProficiency
            )).ToList();

            requiredSkills = req.TechnologyRequirements.Select(t => new TechnologyRequirementDto(
                t.Name,
                t.Priority,
                t.SfiaLevel
            )).ToList();

            requiredResponsibilities = req.Responsibilities.Select(r => new ResponsibilityDto(
                r.Text,
                r.Priority,
                r.OwnershipLevel,
                r.IsLeadership
            )).ToList();
        }

        Dictionary<string, float> normalizedWeights = new(StringComparer.OrdinalIgnoreCase);
        if (snapshot?.EvaluationRubricSnapshot?.CapabilityWeights != null)
        {
            normalizedWeights = JsonSerializer.Deserialize<Dictionary<string, float>>(snapshot.EvaluationRubricSnapshot.CapabilityWeights) ?? new();
        }
        else
        {
            normalizedWeights = _hiringRequirementService.CalculateWeights(req);
        }

        // Build the UnifiedJobRequirement DTO
        var jobRequirement = new UnifiedJobRequirement
        {
            JobOrRequirementId = req.Id,
            Seniority = req.Seniority,
            RequiresLeadership = requiredResponsibilities.Any(r => r.OwnershipLevel == OwnershipLevel.Leader || r.IsLeadership) ||
                                 requiredCapabilities.Any(c => c.OwnershipLevel == OwnershipLevel.Leader),
            SalaryMin = salaryMin,
            SalaryMax = salaryMax,
            WorkplaceType = req.WorkplaceType,
            Skills = requiredSkills.Select(s => s.Name).ToList()
        };

        jobRequirement.Capabilities = requiredCapabilities.Select(c => new RequiredCapabilityDto
        {
            CapabilityId = c.CapabilityId,
            Name = c.Name,
            Weight = normalizedWeights.TryGetValue(c.CapabilityId, out var w) ? w : 1.0f,
            ExpectedProficiency = c.ExpectedProficiency
        }).ToList();

        var allAssessments = await _context.CandidateAssessments
            .Include(ca => ca.User)
            .Where(ca => ca.Status == "Completed")
            .OrderByDescending(ca => ca.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        var latestAssessments = allAssessments
            .GroupBy(ca => ca.UserId)
            .Select(g => g.First())
            .ToList();

        var matches = new List<CandidateMatchDto>();

        foreach (var assess in latestAssessments)
        {
            var profile = await _context.UserProfiles
                .FirstOrDefaultAsync(up => up.UserId == assess.UserId, cancellationToken);

            // Fetch Candidate Capability Intelligence DTO
            var intelligence = await _evaluationService.GetCapabilityIntelligenceAsync(assess.UserId, forceRefresh: false, cancellationToken: cancellationToken).ConfigureAwait(false);

            // Delegate matching to the Unified Matching Engine
            var matchResult = await _matchingEngine.EvaluateMatchAsync(intelligence, jobRequirement, cancellationToken).ConfigureAwait(false);

            // Map factors / outputs to the DTO breakdown
            var breakdown = new MatchBreakdownDto(
                Math.Round(matchResult.CapabilityFitScore, 2),
                Math.Round(matchResult.PreferenceFitScore, 2),
                Math.Round(matchResult.RoleFitScore, 2),
                Math.Round(matchResult.PreferenceFitScore, 2),
                Math.Round(matchResult.CapabilityFitScore, 2),
                Math.Round(matchResult.CapabilityFitScore, 2)
            );

            matches.Add(new CandidateMatchDto(
                assess.UserId,
                assess.User.FullName,
                assess.User.AvatarUrl,
                profile?.Headline ?? "Software Engineer",
                assess.CareerLevel,
                assess.CareerLevelLabel,
                matchResult.MatchScore,
                assess.TrustLevel,
                breakdown,
                matchResult.EvidenceTraces
            ));
        }

        return matches.OrderByDescending(m => m.MatchScore).ToList();
    }

    public async Task<List<CandidateDiscoveryRunDto>> GetDiscoveryRunsAsync(Guid requirementId, CancellationToken cancellationToken)
    {
        var runs = await _context.CandidateDiscoveryRuns
            .Where(r => r.HiringRequirementId == requirementId)
            .OrderByDescending(r => r.StartedAt)
            .ToListAsync(cancellationToken);

        return runs.Select(r => new CandidateDiscoveryRunDto(
            r.Id,
            r.HiringRequirementId,
            r.TriggeredById,
            r.StartedAt,
            r.CompletedAt,
            r.Status,
            r.CandidatesFoundCount,
            r.MatchQualitySummary,
            r.ErrorMessage,
            !string.IsNullOrEmpty(r.RawResultsJson)
                ? JsonSerializer.Deserialize<List<CandidateMatchDto>>(r.RawResultsJson)
                : null
        )).ToList();
    }

    public async Task<TriggerDiscoveryResponseDto> TriggerDiscoveryAsync(Guid requirementId, Guid userId, CancellationToken cancellationToken)
    {
        var req = await _context.HiringRequirements.FindAsync(new object[] { requirementId }, cancellationToken);
        if (req == null)
        {
            throw new KeyNotFoundException("Hiring requirement not found.");
        }

        var userExists = await _context.Users.AnyAsync(u => u.Id == userId, cancellationToken);

        var run = new CandidateDiscoveryRun
        {
            Id = Guid.CreateVersion7(),
            HiringRequirementId = requirementId,
            TriggeredById = userExists ? userId : null,
            StartedAt = DateTimeOffset.UtcNow,
            Status = DiscoveryStatus.Pending,
            CandidatesFoundCount = 0
        };

        _context.CandidateDiscoveryRuns.Add(run);
        await _context.SaveChangesAsync(cancellationToken);

        // Create unified streaming session
        await _streamingSessionService.CreateSessionAsync(
            sessionId: requirementId,
            pipelineId: "candidate-discovery",
            userId: userId,
            workspaceId: req.WorkspaceId,
            modelName: "Claude 3.5 Sonnet",
            provider: "Anthropic",
            pipelineVersion: "1.0.0",
            expectedOutputsJson: "[\"CandidateMatches\"]"
        );
        await _streamingSessionService.UpdateSessionStatusAsync(requirementId, "Running");

        // Register requirementId in cancellation manager linked to background task
        var linkedToken = _cancellationManager.Register(requirementId, cancellationToken);

        // Run matching in the background
        var runId = run.Id;
        var scopeFactory = _scopeFactory;
        _ = Task.Run(async () =>
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var scopedMatchService = scope.ServiceProvider.GetRequiredService<ICandidateMatchService>();
                await ((CandidateMatchService)scopedMatchService).ExecuteDiscoveryPipelineAsync(runId, linkedToken);
            }
            catch (Exception ex)
            {
                // Top level async exception handler
            }
        });

        return new TriggerDiscoveryResponseDto(run.Id, run.Status);
    }

    public async Task ExecuteDiscoveryPipelineAsync(Guid runId, CancellationToken cancellationToken)
    {
        var run = await _context.CandidateDiscoveryRuns.FindAsync(new object[] { runId }, cancellationToken);
        if (run == null) return;

        try
        {
            // 1. Searching candidates
            await _context.Entry(run).ReloadAsync(cancellationToken);
            if (run.Status == DiscoveryStatus.Cancelled) throw new OperationCanceledException("Discovery run was cancelled.");

            run.Status = DiscoveryStatus.Searching;
            await _context.SaveChangesAsync(cancellationToken);
            await _streamingSessionService.UpsertStageAsync(run.HiringRequirementId, "Searching", "Searching candidates", "Running", 20.0, "Searching candidate profiles...");
            await _streamingSessionService.UpdateSessionProgressAsync(run.HiringRequirementId, 20.0, "Searching");
            await PublishProgressAsync(run.HiringRequirementId, "Running", "Searching", "Searching candidates...", 20.0);
            await Task.Delay(1000, cancellationToken);

            // 2. Matching profiles
            await _context.Entry(run).ReloadAsync(cancellationToken);
            if (run.Status == DiscoveryStatus.Cancelled) throw new OperationCanceledException("Discovery run was cancelled.");

            run.Status = DiscoveryStatus.Matching;
            await _context.SaveChangesAsync(cancellationToken);
            await _streamingSessionService.UpsertStageAsync(run.HiringRequirementId, "Matching", "Matching profiles", "Running", 50.0, "Matching profiles to requirement...");
            await _streamingSessionService.UpdateSessionProgressAsync(run.HiringRequirementId, 50.0, "Matching");
            await PublishProgressAsync(run.HiringRequirementId, "Running", "Matching", "Matching profiles...", 50.0);
            await Task.Delay(1000, cancellationToken);

            // 3. Ranking candidates
            await _context.Entry(run).ReloadAsync(cancellationToken);
            if (run.Status == DiscoveryStatus.Cancelled) throw new OperationCanceledException("Discovery run was cancelled.");

            run.Status = DiscoveryStatus.Ranking;
            await _context.SaveChangesAsync(cancellationToken);
            await _streamingSessionService.UpsertStageAsync(run.HiringRequirementId, "Ranking", "Ranking candidates", "Running", 80.0, "Ranking matched candidates...");
            await _streamingSessionService.UpdateSessionProgressAsync(run.HiringRequirementId, 80.0, "Ranking");
            await PublishProgressAsync(run.HiringRequirementId, "Running", "Ranking", "Ranking candidates...", 80.0);

            // Perform the actual matching calculation
            var matches = await GetCandidateMatchesAsync(run.HiringRequirementId, cancellationToken);
            await Task.Delay(500, cancellationToken);

            // 4. Completed
            await _context.Entry(run).ReloadAsync(cancellationToken);
            if (run.Status == DiscoveryStatus.Cancelled) throw new OperationCanceledException("Discovery run was cancelled.");

            run.CompletedAt = DateTimeOffset.UtcNow;
            run.Status = DiscoveryStatus.Completed;
            run.CandidatesFoundCount = matches.Count;

            // Compute match quality summary
            int highMatchCount = matches.Count(m => m.MatchScore >= 80);
            int medMatchCount = matches.Count(m => m.MatchScore >= 50 && m.MatchScore < 80);
            int lowMatchCount = matches.Count(m => m.MatchScore < 50);
            run.MatchQualitySummary = $"{highMatchCount} High Match, {medMatchCount} Good Fit, {lowMatchCount} Potential Fit";

            run.RawResultsJson = JsonSerializer.Serialize(matches);

            await _context.SaveChangesAsync(cancellationToken);
            await _streamingSessionService.UpdateSessionStatusAsync(run.HiringRequirementId, "Completed", summaryData: run.RawResultsJson);
            await _streamingSessionService.UpdateSessionProgressAsync(run.HiringRequirementId, 100.0, "Completed");
            await _streamingSessionService.UpsertStageAsync(run.HiringRequirementId, "Completed", "Completed", "Completed", 100.0, "Discovery run completed.");
            await PublishProgressAsync(run.HiringRequirementId, "Completed", "Completed", "Discovery run completed.", 100.0);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning("Candidate discovery run {RunId} was cancelled.", runId);

            var freshRun = await _context.CandidateDiscoveryRuns.FirstOrDefaultAsync(r => r.Id == runId);
            if (freshRun != null && freshRun.Status != DiscoveryStatus.Cancelled)
            {
                freshRun.Status = DiscoveryStatus.Cancelled;
                freshRun.CompletedAt = DateTimeOffset.UtcNow;
                await _context.SaveChangesAsync(CancellationToken.None);
            }

            await _streamingSessionService.UpdateSessionStatusAsync(run.HiringRequirementId, "Cancelled");
            await PublishProgressAsync(run.HiringRequirementId, "Cancelled", "Cancelled", "Discovery run cancelled by user.", 100.0);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error executing candidate discovery pipeline for run {RunId}", runId);

            var freshRun = await _context.CandidateDiscoveryRuns.FirstOrDefaultAsync(r => r.Id == runId);
            if (freshRun != null && freshRun.Status != DiscoveryStatus.Cancelled)
            {
                freshRun.CompletedAt = DateTimeOffset.UtcNow;
                freshRun.Status = DiscoveryStatus.Failed;
                freshRun.ErrorMessage = ex.Message;
                await _context.SaveChangesAsync(CancellationToken.None);
            }

            await _streamingSessionService.UpdateSessionStatusAsync(run.HiringRequirementId, "Failed", errorMessage: ex.Message);
            await PublishProgressAsync(run.HiringRequirementId, "Failed", "Failed", $"Discovery run failed: {ex.Message}", 100.0);
        }
        finally
        {
            _cancellationManager.Unregister(run.HiringRequirementId);
        }
    }

    public async Task<bool> CancelDiscoveryAsync(Guid requirementId)
    {
        var run = await _context.CandidateDiscoveryRuns
            .Where(r => r.HiringRequirementId == requirementId && r.Status != DiscoveryStatus.Completed && r.Status != DiscoveryStatus.Failed && r.Status != DiscoveryStatus.Cancelled)
            .OrderByDescending(r => r.StartedAt)
            .FirstOrDefaultAsync();

        if (run == null) return false;

        run.Status = DiscoveryStatus.Cancelled;
        run.CompletedAt = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync();

        // 1. Set Redis cancellation key for Python AI service
        try
        {
            var db = _redis.GetDatabase();
            await db.StringSetAsync($"ai:cancel:{requirementId}", "true", TimeSpan.FromMinutes(5));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to set Redis cancellation key for candidate discovery session {SessionId}", requirementId);
        }

        // 2. Cancel C# token via IAiCancellationManager
        _cancellationManager.Cancel(requirementId);

        // 3. Update unified streaming session status
        await _streamingSessionService.UpdateSessionStatusAsync(requirementId, "Cancelled");

        // Broadcast progress updates
        await PublishProgressAsync(requirementId, "Cancelled", "Cancelled", "Discovery run cancelled by user.", 100.0);

        return true;
    }

    private async Task PublishProgressAsync(Guid reqId, string status, string step, string message, double percentage)
    {
        var progress = new
        {
            status = status,
            step = step,
            message = message,
            percentage = percentage
        };
        var json = JsonSerializer.Serialize(progress);
        var subscriber = _redis.GetSubscriber();
        var channel = $"hiring:requirement:progress:{reqId}";
        await subscriber.PublishAsync(channel, json);
    }
}
