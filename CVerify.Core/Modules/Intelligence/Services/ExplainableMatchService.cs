using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.System.DTOs;
using CVerify.API.Modules.Shared.Domain.Enums;

namespace CVerify.API.Modules.Intelligence.Services;

public interface IExplainableMatchService
{
    Task<MatchingEvaluation> EvaluateMatchAsync(Guid jobVacancyId, Guid candidateId);
}

public class ExplainableMatchService : IExplainableMatchService
{
    private readonly ApplicationDbContext _context;
    private readonly ICandidateEvaluationService _evaluationService;
    private readonly IUnifiedMatchingEngine _matchingEngine;

    public ExplainableMatchService(
        ApplicationDbContext context,
        ICandidateEvaluationService evaluationService,
        IUnifiedMatchingEngine matchingEngine)
    {
        _context = context;
        _evaluationService = evaluationService;
        _matchingEngine = matchingEngine;
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

        // 1. Fetch Candidate Capability Intelligence DTO
        var intelligence = await _evaluationService.GetCapabilityIntelligenceAsync(candidateId).ConfigureAwait(false);

        // 2. Build Unified Job Requirement DTO
        var jobRequirement = new UnifiedJobRequirement
        {
            JobOrRequirementId = job.Id,
            Skills = job.Skills,
            Seniority = job.Experience,
            RequiresLeadership = job.Requirements.Any(r => r.Contains("lead", StringComparison.OrdinalIgnoreCase) || r.Contains("manage", StringComparison.OrdinalIgnoreCase)),
            SalaryMin = null,
            SalaryMax = null,
            WorkplaceType = job.WorkplaceType
        };

        if (job.RequirementSnapshot != null && !string.IsNullOrEmpty(job.RequirementSnapshot.CapabilitiesJson))
        {
            var snapshotCaps = JsonSerializer.Deserialize<List<RequirementCapabilityDto>>(
                job.RequirementSnapshot.CapabilitiesJson,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new();
            
            jobRequirement.Capabilities = snapshotCaps.Select(c => new RequiredCapabilityDto
            {
                CapabilityId = c.CapabilityId,
                Name = c.Name,
                Weight = c.Priority == RequirementPriority.MustHave ? 1.5f : 1.0f,
                ExpectedProficiency = c.ExpectedProficiency
            }).ToList();
        }
        else
        {
            // Fallback: build capabilities from simple JobVacancy.Skills list
            jobRequirement.Capabilities = job.Skills.Select(s => new RequiredCapabilityDto
            {
                CapabilityId = s.ToLowerInvariant().Trim(),
                Name = s,
                Weight = 1.0f,
                ExpectedProficiency = 2
            }).ToList();
        }

        // 3. Delegate score calculation to the consolidated engine
        var matchResult = await _matchingEngine.EvaluateMatchAsync(intelligence, jobRequirement).ConfigureAwait(false);

        // 4. Save evaluation
        var evaluation = new MatchingEvaluation
        {
            Id = Guid.CreateVersion7(),
            JobVacancyId = jobVacancyId,
            CandidateId = candidateId,
            AggregateScore = (int)matchResult.MatchScore,
            ConfidenceLevel = matchResult.ConfidenceLevel,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        _context.MatchingEvaluations.Add(evaluation);
        await _context.SaveChangesAsync().ConfigureAwait(false);

        // 5. Save matching factors
        foreach (var factor in matchResult.Factors)
        {
            _context.MatchingFactors.Add(new MatchingFactor
            {
                Id = Guid.CreateVersion7(),
                MatchingEvaluationId = evaluation.Id,
                FactorName = factor.FactorName,
                FactorScore = (int)factor.FactorScore,
                Weight = factor.Weight
            });
        }

        // 6. Save matching explanations (strengths and gaps)
        foreach (var exp in matchResult.Explanations)
        {
            var node = await _context.CapabilityNodes
                .FirstOrDefaultAsync(n => n.Slug == exp.AssertionText || n.Name.ToLower() == exp.AssertionText.ToLower())
                .ConfigureAwait(false);

            _context.MatchingExplanations.Add(new MatchingExplanation
            {
                Id = Guid.CreateVersion7(),
                MatchingEvaluationId = evaluation.Id,
                ExplanationType = exp.ExplanationType,
                CapabilityNodeId = node?.Id,
                AssertionText = exp.AssertionText
            });
        }

        await _context.SaveChangesAsync().ConfigureAwait(false);
        return evaluation;
    }
}
