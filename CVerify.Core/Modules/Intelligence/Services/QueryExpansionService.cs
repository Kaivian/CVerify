using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Modules.Intelligence.DTOs;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.Modules.Intelligence.Services;

public interface IQueryExpansionService
{
    Task<ExpandedSearchQueryDto> ExpandQueryAsync(ParsedSearchQueryDto parsedQuery, CancellationToken cancellationToken = default);
}

public class QueryExpansionService : IQueryExpansionService
{
    private readonly ITechnologyNormalizationService _normalizationService;
    private readonly ICapabilityCatalogService _catalogService;

    public QueryExpansionService(
        ITechnologyNormalizationService normalizationService,
        ICapabilityCatalogService catalogService)
    {
        _normalizationService = normalizationService;
        _catalogService = catalogService;
    }

    public async Task<ExpandedSearchQueryDto> ExpandQueryAsync(ParsedSearchQueryDto parsedQuery, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(parsedQuery);

        var normalizedSkills = new List<string>();
        foreach (var rawSkill in parsedQuery.ExtractedSkills)
        {
            var normResult = await _normalizationService.NormalizeAsync(rawSkill, cancellationToken);
            if (normResult != null && !string.IsNullOrEmpty(normResult.SkillId))
            {
                normalizedSkills.Add(normResult.SkillId);
            }
            else
            {
                normalizedSkills.Add($"skill:{rawSkill.ToLowerInvariant().Replace(" ", "-")}");
            }
        }

        var expandedCapabilities = new HashSet<string>(parsedQuery.ExtractedCapabilities, StringComparer.OrdinalIgnoreCase);
        var capabilityWeights = new Dictionary<string, float>(StringComparer.OrdinalIgnoreCase);

        foreach (var capId in expandedCapabilities)
        {
            capabilityWeights[capId] = 1.0f;
        }

        return new ExpandedSearchQueryDto(
            ParsedQuery: parsedQuery,
            NormalizedSkillUris: normalizedSkills.Distinct().ToList(),
            ExpandedCapabilitySlugs: expandedCapabilities.ToList(),
            CapabilityWeights: capabilityWeights
        );
    }
}
