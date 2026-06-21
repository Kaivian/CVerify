using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Persistence;

namespace CVerify.API.Modules.Intelligence.Services;

public interface IExplainableMatchService
{
    Task<MatchingEvaluation> EvaluateMatchAsync(Guid jobVacancyId, Guid candidateId);
}

public class ExplainableMatchService : IExplainableMatchService
{
    private readonly ApplicationDbContext _context;
    private readonly ICandidateEvaluationService _evaluationService;

    public ExplainableMatchService(
        ApplicationDbContext context,
        ICandidateEvaluationService evaluationService)
    {
        _context = context;
        _evaluationService = evaluationService;
    }

    public async Task<MatchingEvaluation> EvaluateMatchAsync(Guid jobVacancyId, Guid candidateId)
    {
        var job = await _context.JobVacancies
            .Include(j => j.RequirementSnapshot)
            .FirstOrDefaultAsync(j => j.Id == jobVacancyId)
            .ConfigureAwait(false);

        if (job == null)
            throw new ArgumentException($"JobVacancy {jobVacancyId} not found.");

        // Clear existing matching evaluation if it exists
        var existingEval = await _context.MatchingEvaluations
            .FirstOrDefaultAsync(e => e.JobVacancyId == jobVacancyId && e.CandidateId == candidateId)
            .ConfigureAwait(false);

        if (existingEval != null)
        {
            _context.MatchingEvaluations.Remove(existingEval);
            await _context.SaveChangesAsync().ConfigureAwait(false);
        }

        // 1. Fetch Candidate Snapshot and Capability Projection (generate dynamically if null)
        var snapshot = await _context.CandidateEvaluationSnapshots
            .FirstOrDefaultAsync(s => s.CandidateId == candidateId)
            .ConfigureAwait(false);

        if (snapshot == null)
        {
            snapshot = await _evaluationService.EvaluateAndSnapshotCandidateAsync(candidateId).ConfigureAwait(false);
        }

        var projection = await _context.CandidateCapabilityProjections
            .FirstOrDefaultAsync(p => p.CandidateId == candidateId)
            .ConfigureAwait(false);

        var candCaps = new List<ProjectedCapabilityItem>();
        if (projection != null && !string.IsNullOrEmpty(projection.CapabilitiesJson))
        {
            candCaps = JsonSerializer.Deserialize<List<ProjectedCapabilityItem>>(
                projection.CapabilitiesJson,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new();
        }

        // 2. Fetch Job vacancy target skills/requirements
        var jobRequiredSlugs = job.Skills.Select(s => s.ToLowerInvariant().Trim()).ToList();

        // 3. Compute Capability Overlap
        var matchingCaps = candCaps
            .Where(cc => jobRequiredSlugs.Contains(cc.Slug) || jobRequiredSlugs.Contains(cc.Name.ToLowerInvariant().Trim()))
            .ToList();

        int capabilityMatchScore = 0;
        if (jobRequiredSlugs.Any())
        {
            capabilityMatchScore = (int)((double)matchingCaps.Count / jobRequiredSlugs.Count * 100);
        }

        // 4. Compute Evidence Strength
        int evidenceStrengthScore = 0;
        if (matchingCaps.Any())
        {
            var averageProficiency = matchingCaps.Average(cc => cc.Score);
            evidenceStrengthScore = (int)Math.Clamp(averageProficiency, 0, 100);
        }

        // 5. Compute Recency Score
        int recencyScore = 0;
        if (matchingCaps.Any())
        {
            var averageRecency = matchingCaps.Average(cc => cc.Recency);
            recencyScore = (int)(averageRecency * 100);
        }

        // 6. Fetch Trust Multiplier (from Snapshot)
        var trustScore = (int)snapshot.IdentityTrustScore;

        // 7. Calculate aggregate score
        double aggregate = (capabilityMatchScore * 0.40) + (evidenceStrengthScore * 0.30) + (recencyScore * 0.20) + (trustScore * 0.10);
        int finalScore = (int)Math.Clamp(aggregate, 0, 100);

        var confidence = finalScore switch
        {
            >= 80 => "High",
            >= 50 => "Medium",
            _ => "Low"
        };

        var evaluation = new MatchingEvaluation
        {
            Id = Guid.CreateVersion7(),
            JobVacancyId = jobVacancyId,
            CandidateId = candidateId,
            AggregateScore = finalScore,
            ConfidenceLevel = confidence,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        _context.MatchingEvaluations.Add(evaluation);
        await _context.SaveChangesAsync().ConfigureAwait(false);

        // Add factors
        _context.MatchingFactors.Add(new MatchingFactor
        {
            Id = Guid.CreateVersion7(),
            MatchingEvaluationId = evaluation.Id,
            FactorName = "CapabilityMatch",
            FactorScore = capabilityMatchScore,
            Weight = 0.40
        });

        _context.MatchingFactors.Add(new MatchingFactor
        {
            Id = Guid.CreateVersion7(),
            MatchingEvaluationId = evaluation.Id,
            FactorName = "EvidenceStrength",
            FactorScore = evidenceStrengthScore,
            Weight = 0.30
        });

        _context.MatchingFactors.Add(new MatchingFactor
        {
            Id = Guid.CreateVersion7(),
            MatchingEvaluationId = evaluation.Id,
            FactorName = "Recency",
            FactorScore = recencyScore,
            Weight = 0.20
        });

        _context.MatchingFactors.Add(new MatchingFactor
        {
            Id = Guid.CreateVersion7(),
            MatchingEvaluationId = evaluation.Id,
            FactorName = "TrustFactor",
            FactorScore = trustScore,
            Weight = 0.10
        });

        // Add explanations
        foreach (var cap in matchingCaps)
        {
            var level = cap.Score >= 80 ? "Expert" : cap.Score >= 50 ? "Intermediate" : "Working";
            
            var node = await _context.CapabilityNodes
                .FirstOrDefaultAsync(n => n.Slug == cap.Slug || n.Name.ToLower() == cap.Name.ToLower())
                .ConfigureAwait(false);

            _context.MatchingExplanations.Add(new MatchingExplanation
            {
                Id = Guid.CreateVersion7(),
                MatchingEvaluationId = evaluation.Id,
                ExplanationType = "Strength",
                CapabilityNodeId = node?.Id,
                AssertionText = $"Candidate has verified {level}-level experience in {cap.Name}."
            });
        }

        // Gaps
        var candidateCapSlugs = candCaps.Select(c => c.Slug).ToList();
        var gaps = job.Skills.Where(s => !candidateCapSlugs.Contains(s.ToLowerInvariant().Trim())).ToList();
        foreach (var gap in gaps)
        {
            var node = await _context.CapabilityNodes
                .FirstOrDefaultAsync(n => n.Slug == gap.ToLowerInvariant().Trim() || n.Name.ToLower() == gap.ToLowerInvariant().Trim())
                .ConfigureAwait(false);

            _context.MatchingExplanations.Add(new MatchingExplanation
            {
                Id = Guid.CreateVersion7(),
                MatchingEvaluationId = evaluation.Id,
                ExplanationType = "Gap",
                CapabilityNodeId = node?.Id,
                AssertionText = $"Missing verified capability: {gap}."
            });
        }

        await _context.SaveChangesAsync().ConfigureAwait(false);
        return evaluation;
    }

    private class ProjectedCapabilityItem
    {
        public string Slug { get; set; } = null!;
        public string Name { get; set; } = null!;
        public string Source { get; set; } = null!;
        public double Score { get; set; }
        public double Recency { get; set; }
    }
}
