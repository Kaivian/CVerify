using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Intelligence.Services;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Persistence;

namespace CVerify.API.Modules.Intelligence.Controllers;

[ApiController]
[Authorize]
public class TalentDiscoveryController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ICapabilityGraphService _capabilityGraph;
    private readonly IExplainableMatchService _matchService;

    public TalentDiscoveryController(
        ApplicationDbContext context,
        ICapabilityGraphService capabilityGraph,
        IExplainableMatchService matchService)
    {
        _context = context;
        _capabilityGraph = capabilityGraph;
        _matchService = matchService;
    }

    [HttpGet("api/v1/intelligence/search")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(CVerify.API.Modules.Shared.System.DTOs.PaginatedResultDto<object>))]
    public async Task<IActionResult> Search(
        [FromQuery] string? query,
        [FromQuery] string? location,
        [FromQuery] int minTrustScore = 0,
        [FromQuery] string? sortBy = "highest_trust",
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 12,
        CancellationToken cancellationToken = default)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 12;

        // Query search profiles from the read-model projection
        var dbQuery = _context.CandidateSearchProfiles.AsQueryable();

        if (!string.IsNullOrEmpty(location))
        {
            dbQuery = dbQuery.Where(p => p.Location.ToLower().Contains(location.ToLower()));
        }

        if (minTrustScore > 0)
        {
            dbQuery = dbQuery.Where(p => p.TrustScore >= minTrustScore);
        }

        if (!string.IsNullOrEmpty(query))
        {
            var cleanQuery = query.ToLowerInvariant();
            dbQuery = dbQuery.Where(p => p.FullName.ToLower().Contains(cleanQuery) ||
                                         (p.Headline != null && p.Headline.ToLower().Contains(cleanQuery)) ||
                                         p.CapabilitiesJson.ToLower().Contains(cleanQuery));
        }

        // Sorting
        switch (sortBy?.ToLowerInvariant())
        {
            case "highest_trust":
                dbQuery = dbQuery.OrderByDescending(p => p.TrustScore);
                break;
            case "alphabetical":
                dbQuery = dbQuery.OrderBy(p => p.FullName);
                break;
            case "recently_updated":
            default:
                dbQuery = dbQuery.OrderByDescending(p => p.LastProjectedAt);
                break;
        }

        var totalCount = await dbQuery.CountAsync(cancellationToken).ConfigureAwait(false);

        var results = await dbQuery
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new
            {
                p.CandidateId,
                p.FullName,
                p.Headline,
                p.Location,
                p.TrustScore,
                p.TrustTier,
                p.CapabilitiesJson,
                p.LastProjectedAt
            })
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return Ok(new CVerify.API.Modules.Shared.System.DTOs.PaginatedResultDto<object>(results, totalCount, page, pageSize));
    }

    [HttpGet("api/v1/intelligence/candidate/{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetCandidateProfile(Guid id, CancellationToken cancellationToken)
    {
        var searchProfile = await _context.CandidateSearchProfiles
            .FirstOrDefaultAsync(p => p.CandidateId == id, cancellationToken)
            .ConfigureAwait(false);

        if (searchProfile == null)
        {
            return NotFound(new { message = "Candidate intelligence profile not found." });
        }

        var capabilities = await _context.CandidateCapabilities
            .Include(cc => cc.CapabilityNode)
            .Include(cc => cc.Score)
            .Where(cc => cc.CandidateId == id)
            .Select(cc => new
            {
                cc.Id,
                CapabilityName = cc.CapabilityNode.Name,
                cc.CapabilityNode.Slug,
                cc.CapabilityNode.Category,
                Score = cc.Score != null ? new
                {
                    cc.Score.ExpertiseLevel,
                    cc.Score.ProficiencyScore,
                    cc.Score.RecencyIndex
                } : null,
                EvidenceCount = cc.EvidenceLinks.Count
            })
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        var evidence = await _context.EvidenceClaims
            .Include(c => c.EvidenceArtifact)
            .Where(c => c.CandidateId == id)
            .Select(c => new
            {
                c.Id,
                c.AssertionType,
                c.ConfidenceScore,
                Artifact = new
                {
                    c.EvidenceArtifact.Id,
                    c.EvidenceArtifact.ArtifactType,
                    c.EvidenceArtifact.ExternalIdentifier,
                    c.EvidenceArtifact.Payload
                },
                Verifications = c.Verifications.Select(v => new
                {
                    v.VerificationType,
                    v.Status,
                    v.VerifiedAt
                })
            })
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        var trustProfile = await _context.TrustProfiles
            .Include(p => p.Components)
            .FirstOrDefaultAsync(p => p.TargetEntityId == id && p.TargetType == "Candidate", cancellationToken)
            .ConfigureAwait(false);

        return Ok(new
        {
            searchProfile.CandidateId,
            searchProfile.FullName,
            searchProfile.Headline,
            searchProfile.Location,
            searchProfile.TrustScore,
            searchProfile.TrustTier,
            Capabilities = capabilities,
            Evidence = evidence,
            TrustComponents = trustProfile?.Components.Select(c => new
            {
                c.ComponentName,
                c.ComponentScore,
                c.Weight
            })
        });
    }

    [HttpGet("api/v1/intelligence/match/{jobVacancyId}/{candidateId}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> EvaluateMatch(Guid jobVacancyId, Guid candidateId)
    {
        try
        {
            var evaluation = await _matchService.EvaluateMatchAsync(jobVacancyId, candidateId).ConfigureAwait(false);

            var factors = await _context.MatchingFactors
                .Where(f => f.MatchingEvaluationId == evaluation.Id)
                .Select(f => new
                {
                    f.FactorName,
                    f.FactorScore,
                    f.Weight
                })
                .ToListAsync()
                .ConfigureAwait(false);

            var explanations = await _context.MatchingExplanations
                .Where(e => e.MatchingEvaluationId == evaluation.Id)
                .Select(e => new
                {
                    e.ExplanationType,
                    e.AssertionText,
                    e.CapabilityNodeId
                })
                .ToListAsync()
                .ConfigureAwait(false);

            return Ok(new
            {
                evaluation.Id,
                evaluation.JobVacancyId,
                evaluation.CandidateId,
                evaluation.AggregateScore,
                evaluation.ConfidenceLevel,
                Factors = factors,
                Explanations = explanations
            });
        }
        catch (ArgumentException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }
}
