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

namespace CVerify.API.Modules.Profiles.Services;

public class CandidateMatchService : ICandidateMatchService
{
    private readonly ApplicationDbContext _context;
    private readonly ICapabilityCatalogService _catalogService;
    private readonly IHiringRequirementService _hiringRequirementService;
    private readonly IConnectionMultiplexer _redis;
    private readonly IServiceScopeFactory _scopeFactory;

    public CandidateMatchService(
        ApplicationDbContext context,
        ICapabilityCatalogService catalogService,
        IHiringRequirementService hiringRequirementService,
        IConnectionMultiplexer redis,
        IServiceScopeFactory scopeFactory)
    {
        _context = context;
        _catalogService = catalogService;
        _hiringRequirementService = hiringRequirementService;
        _redis = redis;
        _scopeFactory = scopeFactory;
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
        float[] requirementVector;
        decimal? salaryMin = req.SalaryMin;
        decimal? salaryMax = req.SalaryMax;
        string seniority = req.Seniority;

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

            requirementVector = snapshot.RequirementVectorSnapshot?.Vector ?? Array.Empty<float>();
            salaryMin = snapshot.SalaryMin;
            salaryMax = snapshot.SalaryMax;
            seniority = snapshot.Seniority;
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

            var weights = _hiringRequirementService.CalculateWeights(req);
            requirementVector = _hiringRequirementService.CalculateRequirementVector(req, weights);
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

            var candidateCapabilities = await _context.RepositoryCapabilities
                .Where(rc => rc.RepositoryAssessmentId == assess.Id)
                .ToListAsync(cancellationToken);

            var candidateSkills = await _context.CandidateSkills
                .Where(cs => cs.CandidateAssessmentId == assess.Id)
                .ToListAsync(cancellationToken);

            var selfDeclaredSkills = await _context.UserSkills
                .Where(us => us.UserId == assess.UserId)
                .Select(us => us.Skill)
                .ToListAsync(cancellationToken);

            var careerPref = await _context.CareerPreferences
                .FirstOrDefaultAsync(cp => cp.UserId == assess.UserId, cancellationToken);

            if (careerPref?.TargetSkills != null)
            {
                selfDeclaredSkills = selfDeclaredSkills.Concat(careerPref.TargetSkills).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            }

            double sumCapScores = 0.0;
            var traces = new List<EvidenceTraceDto>();

            var catalog = _catalogService.GetCatalog(req.WorkspaceId).ToList();
            var candidateVector = new float[catalog.Count];

            foreach (var reqCap in requiredCapabilities)
            {
                var matchedVerified = candidateCapabilities.FirstOrDefault(rc => 
                    rc.Name.Equals(reqCap.CapabilityId, StringComparison.OrdinalIgnoreCase) ||
                    rc.Name.Equals(reqCap.Name, StringComparison.OrdinalIgnoreCase));

                double scoreCap = 0.0;
                string status = "Missing";
                string metric = "No verified repo data";
                string rationale = $"Candidate lacks repository verification for {reqCap.Name}.";
                string targetFile = "";
                double confidence = 0.0;

                if (matchedVerified != null)
                {
                    int candidateLevel = MapMaturityToLevel(matchedVerified.Maturity);
                    int expectedLevel = reqCap.ExpectedProficiency;

                    if (candidateLevel >= expectedLevel)
                    {
                        scoreCap = 1.0;
                        status = "Verified";
                        confidence = matchedVerified.Confidence;
                        metric = $"Verified Level {candidateLevel} >= Expected Level {expectedLevel}";
                        rationale = $"Candidate has verified repository data matching {reqCap.Name} at level {matchedVerified.Maturity}.";
                    }
                    else
                    {
                        scoreCap = 0.40 + 0.60 * ((double)candidateLevel / expectedLevel);
                        status = "Verified (Needs Growth)";
                        confidence = matchedVerified.Confidence;
                        metric = $"Verified Level {candidateLevel} < Expected Level {expectedLevel}";
                        rationale = $"Candidate has verified repository data matching {reqCap.Name} at level {matchedVerified.Maturity}, which is below the expected level {reqCap.ExpectedProficiency}.";
                    }

                    if (!string.IsNullOrEmpty(matchedVerified.EvidenceJson))
                    {
                        try
                        {
                            using var evDoc = JsonDocument.Parse(matchedVerified.EvidenceJson);
                            if (evDoc.RootElement.TryGetProperty("file_path", out var pathProp))
                            {
                                targetFile = pathProp.GetString() ?? "";
                            }
                            if (evDoc.RootElement.TryGetProperty("description", out var descProp))
                            {
                                rationale = descProp.GetString() ?? rationale;
                            }
                        }
                        catch {}
                    }
                }
                else
                {
                    bool isSelfDeclared = selfDeclaredSkills.Any(s => 
                        s.Equals(reqCap.CapabilityId, StringComparison.OrdinalIgnoreCase) ||
                        s.Equals(reqCap.Name, StringComparison.OrdinalIgnoreCase) ||
                        reqCap.Name.Contains(s, StringComparison.OrdinalIgnoreCase) ||
                        s.Contains(reqCap.Name, StringComparison.OrdinalIgnoreCase));

                    if (isSelfDeclared)
                    {
                        scoreCap = 0.40;
                        status = "Self-Declared";
                        confidence = 0.20;
                        metric = "Self-declared skill in profile";
                        rationale = "Candidate listed this capability in their resume or preferences but no repository code evidence was found.";
                    }
                }

                sumCapScores += scoreCap;

                traces.Add(new EvidenceTraceDto(
                    reqCap.CapabilityId,
                    reqCap.Name,
                    confidence,
                    status,
                    metric,
                    targetFile,
                    rationale
                ));
            }

            double sCapabilities = requiredCapabilities.Any() ? sumCapScores / requiredCapabilities.Count : 1.0;

            for (int i = 0; i < catalog.Count; i++)
            {
                var catItem = catalog[i];
                var matchedVerified = candidateCapabilities.FirstOrDefault(rc => 
                    rc.Name.Equals(catItem.CapabilityId, StringComparison.OrdinalIgnoreCase) ||
                    rc.Name.Equals(catItem.DisplayName, StringComparison.OrdinalIgnoreCase));

                if (matchedVerified != null)
                {
                    int candidateLevel = MapMaturityToLevel(matchedVerified.Maturity);
                    candidateVector[i] = candidateLevel;
                }
                else
                {
                    bool isSelfDeclared = selfDeclaredSkills.Any(s => 
                        s.Equals(catItem.CapabilityId, StringComparison.OrdinalIgnoreCase) ||
                        s.Equals(catItem.DisplayName, StringComparison.OrdinalIgnoreCase));

                    if (isSelfDeclared)
                    {
                        var reqCap = requiredCapabilities.FirstOrDefault(c => c.CapabilityId.Equals(catItem.CapabilityId, StringComparison.OrdinalIgnoreCase));
                        int expectedProf = reqCap?.ExpectedProficiency ?? 2;
                        candidateVector[i] = 0.40f * expectedProf;
                    }
                    else
                    {
                        candidateVector[i] = 0f;
                    }
                }
            }

            double cosineSimilarity = CalculateCosineSimilarity(candidateVector, requirementVector);
            double gapScore = CalculateGapScore(candidateVector, requirementVector, normalizedWeights, requiredCapabilities, catalog);

            double sumSkillScores = 0.0;
            foreach (var reqSkill in requiredSkills)
            {
                var matchedVerifiedSkill = candidateSkills.FirstOrDefault(cs => 
                    cs.SkillName.Equals(reqSkill.Name, StringComparison.OrdinalIgnoreCase));

                if (matchedVerifiedSkill != null)
                {
                    sumSkillScores += 1.0;
                }
                else if (selfDeclaredSkills.Any(s => s.Equals(reqSkill.Name, StringComparison.OrdinalIgnoreCase)))
                {
                    sumSkillScores += 0.40;
                }
            }
            double sSkills = requiredSkills.Any() ? sumSkillScores / requiredSkills.Count : 1.0;

            double sResponsibilities = 1.0;
            bool requestsLeader = requiredResponsibilities.Any(r => r.OwnershipLevel == OwnershipLevel.Leader || r.IsLeadership) ||
                                  requiredCapabilities.Any(c => c.OwnershipLevel == OwnershipLevel.Leader);
            
            bool isLeaderProfile = assess.CareerLevel == "L4" || assess.CareerLevel == "L5" ||
                                   (assess.CareerLevelLabel != null && 
                                    (assess.CareerLevelLabel.Equals("Staff", StringComparison.OrdinalIgnoreCase) || 
                                     assess.CareerLevelLabel.Equals("Principal", StringComparison.OrdinalIgnoreCase)));

            if (requestsLeader && !isLeaderProfile)
            {
                sResponsibilities = 0.6;
            }

            double sSalary = 1.0;
            if (salaryMax.HasValue && salaryMax.Value > 0)
            {
                double jdMax = (double)salaryMax.Value;
                double desired = careerPref?.ExpectedSalaryMax.HasValue == true ? (double)careerPref.ExpectedSalaryMax.Value : 
                                 careerPref?.SalaryExpectations.HasValue == true ? (double)careerPref.SalaryExpectations.Value : 0.0;
                double minAcceptable = careerPref?.ExpectedSalaryMin.HasValue == true ? (double)careerPref.ExpectedSalaryMin.Value :
                                       careerPref?.SalaryExpectations.HasValue == true ? (double)careerPref.SalaryExpectations.Value : 0.0;

                if (desired > 0)
                {
                    if (desired <= jdMax)
                    {
                        sSalary = 1.0;
                    }
                    else if (minAcceptable <= jdMax && minAcceptable > 0)
                    {
                        sSalary = 0.6;
                    }
                    else
                    {
                        sSalary = 0.0;
                    }
                }
            }

            double tCandidate = Math.Clamp(assess.TrustLevel / 100.0, 0.40, 1.00);

            double matchScoreVal = (0.40 * sCapabilities + 0.20 * sSkills + 0.30 * sResponsibilities + 0.10 * sSalary) * tCandidate * 100.0;
            matchScoreVal = Math.Round(Math.Clamp(matchScoreVal, 0.0, 100.0), 2);

            var breakdown = new MatchBreakdownDto(
                Math.Round(sCapabilities * 100.0, 2),
                Math.Round(sSkills * 100.0, 2),
                Math.Round(sResponsibilities * 100.0, 2),
                Math.Round(sSalary * 100.0, 2),
                Math.Round(cosineSimilarity * 100.0, 2),
                Math.Round(gapScore * 100.0, 2)
            );

            matches.Add(new CandidateMatchDto(
                assess.UserId,
                assess.User.FullName,
                assess.User.AvatarUrl,
                profile?.Headline ?? "Software Engineer",
                assess.CareerLevel,
                assess.CareerLevelLabel,
                matchScoreVal,
                assess.TrustLevel,
                breakdown,
                traces
            ));
        }

        return matches.OrderByDescending(m => m.MatchScore).ToList();
    }

    private int MapMaturityToLevel(string maturity)
    {
        if (string.IsNullOrEmpty(maturity)) return 1;
        return maturity.ToLowerInvariant() switch
        {
            "basic" or "awareness" => 1,
            "intermediate" or "working" or "contributor" => 2,
            "advanced" or "practitioner" or "owner" => 3,
            "enterprise" or "expert" or "principal" or "leader" => 4,
            _ => 2
        };
    }

    private double CalculateCosineSimilarity(float[] vecA, float[] vecB)
    {
        if (vecA == null || vecB == null || vecA.Length == 0 || vecB.Length == 0 || vecA.Length != vecB.Length)
            return 0.0;

        double dotProduct = 0.0;
        double normA = 0.0;
        double normB = 0.0;

        for (int i = 0; i < vecA.Length; i++)
        {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }

        if (normA == 0.0 || normB == 0.0)
            return 0.0;

        return dotProduct / (Math.Sqrt(normA) * Math.Sqrt(normB));
    }

    private double CalculateGapScore(
        float[] candidateVector, 
        float[] requirementVector, 
        Dictionary<string, float> weights, 
        List<RequirementCapabilityDto> requiredCapabilities,
        List<CapabilityCatalogDto> catalog)
    {
        double sumWeightedGaps = 0.0;
        double sumWeightedMax = 0.0;

        for (int i = 0; i < catalog.Count; i++)
        {
            var catItem = catalog[i];
            var reqCap = requiredCapabilities.FirstOrDefault(c => c.CapabilityId.Equals(catItem.CapabilityId, StringComparison.OrdinalIgnoreCase));
            
            if (reqCap != null)
            {
                float weight = weights.TryGetValue(catItem.CapabilityId, out float w) ? w : 0f;
                float reqVal = requirementVector[i];
                float candVal = candidateVector[i];

                double gap = Math.Max(0.0, reqVal - candVal);
                sumWeightedGaps += weight * gap * gap;
                sumWeightedMax += weight * reqVal * reqVal;
            }
        }

        if (sumWeightedMax == 0.0)
            return 1.0;

        double fraction = sumWeightedGaps / sumWeightedMax;
        return Math.Max(0.0, 1.0 - Math.Sqrt(fraction));
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

        // Run matching in the background
        var runId = run.Id;
        var scopeFactory = _scopeFactory;
        _ = Task.Run(async () =>
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var scopedMatchService = scope.ServiceProvider.GetRequiredService<ICandidateMatchService>();
                await ((CandidateMatchService)scopedMatchService).ExecuteDiscoveryPipelineAsync(runId, CancellationToken.None);
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
            run.Status = DiscoveryStatus.Searching;
            await _context.SaveChangesAsync(cancellationToken);
            await PublishProgressAsync(run.HiringRequirementId, "Running", "Searching", "Searching candidates...", 20.0);
            await Task.Delay(1000, cancellationToken);

            // 2. Matching profiles
            run.Status = DiscoveryStatus.Matching;
            await _context.SaveChangesAsync(cancellationToken);
            await PublishProgressAsync(run.HiringRequirementId, "Running", "Matching", "Matching profiles...", 50.0);
            await Task.Delay(1000, cancellationToken);

            // 3. Ranking candidates
            run.Status = DiscoveryStatus.Ranking;
            await _context.SaveChangesAsync(cancellationToken);
            await PublishProgressAsync(run.HiringRequirementId, "Running", "Ranking", "Ranking candidates...", 80.0);

            // Perform the actual matching calculation
            var matches = await GetCandidateMatchesAsync(run.HiringRequirementId, cancellationToken);
            await Task.Delay(500, cancellationToken);

            // 4. Completed
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
            await PublishProgressAsync(run.HiringRequirementId, "Completed", "Completed", "Discovery run completed.", 100.0);
        }
        catch (Exception ex)
        {
            run.CompletedAt = DateTimeOffset.UtcNow;
            run.Status = DiscoveryStatus.Failed;
            run.ErrorMessage = ex.Message;
            await _context.SaveChangesAsync(CancellationToken.None);
            await PublishProgressAsync(run.HiringRequirementId, "Failed", "Failed", $"Discovery run failed: {ex.Message}", 100.0);
        }
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
