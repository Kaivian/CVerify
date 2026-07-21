using System;
using System.Collections.Generic;

namespace CVerify.API.Modules.Intelligence.DTOs;

public record ParsedSearchQueryDto(
    string RawPrompt,
    string? TargetRoleTitle,
    string? TargetSeniority,
    string? WorkplaceType,
    string? Location,
    decimal? SalaryMin,
    decimal? SalaryMax,
    int? MinimumYearsOfExperience,
    List<string> ExtractedSkills,
    List<string> ExtractedCapabilities
);

public record ExpandedSearchQueryDto(
    ParsedSearchQueryDto ParsedQuery,
    List<string> NormalizedSkillUris,
    List<string> ExpandedCapabilitySlugs,
    Dictionary<string, float> CapabilityWeights
);
