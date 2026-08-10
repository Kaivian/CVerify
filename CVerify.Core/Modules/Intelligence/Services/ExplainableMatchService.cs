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

        List<RequiredCapabilityDto> requiredCapabilities;
        List<string> requiredSkills = job.Skills;
        decimal? salaryMin = null;
        decimal? salaryMax = null;
        string workplaceType = job.WorkplaceType;
        bool requiresLeadership = job.Requirements.Any(r => r.Contains("lead", StringComparison.OrdinalIgnoreCase) || r.Contains("manage", StringComparison.OrdinalIgnoreCase));

        if (job.RequirementSnapshot != null)
        {
            var snapshot = job.RequirementSnapshot;

            var snapshotCaps = !string.IsNullOrEmpty(snapshot.CapabilitiesJson)
                ? JsonSerializer.Deserialize<List<RequirementCapabilityDto>>(snapshot.CapabilitiesJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new()
                : new();

            requiredCapabilities = snapshotCaps.Select(c => new RequiredCapabilityDto
            {
                CapabilityId = c.CapabilityId,
                Name = c.Name,
                Weight = c.Priority == RequirementPriority.MustHave ? 1.5f : 1.0f,
                ExpectedProficiency = c.ExpectedProficiency
            }).ToList();

            var techReqs = !string.IsNullOrEmpty(snapshot.TechnologyRequirementsJson)
                ? JsonSerializer.Deserialize<List<TechnologyRequirementDto>>(snapshot.TechnologyRequirementsJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new()
                : new();
            requiredSkills = techReqs.Select(t => t.Name).ToList();

            var responsibilities = !string.IsNullOrEmpty(snapshot.ResponsibilitiesJson)
                ? JsonSerializer.Deserialize<List<ResponsibilityDto>>(snapshot.ResponsibilitiesJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new()
                : new();

            requiresLeadership = responsibilities.Any(r => r.OwnershipLevel == OwnershipLevel.Leader || r.IsLeadership) ||
                                 snapshotCaps.Any(c => c.OwnershipLevel == OwnershipLevel.Leader);

            salaryMin = snapshot.SalaryMin;
            salaryMax = snapshot.SalaryMax;
            workplaceType = snapshot.WorkplaceType;
        }
        else
        {
            // Fallback: build capabilities from simple JobVacancy.Skills list
            requiredCapabilities = job.Skills.Select(s => new RequiredCapabilityDto
            {
                CapabilityId = s.ToLowerInvariant().Trim(),
                Name = s,
                Weight = 1.0f,
                ExpectedProficiency = 2
            }).ToList();
        }

        // 2. Build Unified Job Requirement DTO
        var jobRequirement = new UnifiedJobRequirement
        {
            JobOrRequirementId = job.Id,
            Skills = requiredSkills,
            Seniority = job.Experience,
            RequiresLeadership = requiresLeadership,
            SalaryMin = salaryMin,
            SalaryMax = salaryMax,
            WorkplaceType = workplaceType,
            Capabilities = requiredCapabilities
        };

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
                .FirstOrDefaultAsync(n => n.Slug == exp.CapabilitySlug || n.Slug == exp.AssertionText || n.Name.ToLower() == exp.AssertionText.ToLower())
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
