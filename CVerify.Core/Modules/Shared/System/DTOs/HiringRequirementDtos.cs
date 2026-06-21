using System;
using System.Collections.Generic;
using CVerify.API.Modules.Shared.Domain.Enums;

namespace CVerify.API.Modules.Shared.System.DTOs;

public record CreateHiringRequirementRequestDto(
    string OrganizationSlug,
    string Title,
    string Department,
    string Seniority,
    string WorkplaceType,
    string? City,
    string EmploymentType,
    int Headcount
);

public record UpdateHiringRequirementRequestDto(
    string? HiringReason,
    string? BusinessProblem,
    List<string>? Outcomes,
    List<ResponsibilityDto>? Responsibilities,
    List<RequirementCapabilityDto>? Capabilities,
    List<TechnologyRequirementDto>? Skills,
    decimal? SalaryMin,
    decimal? SalaryMax,
    string? Currency,
    string? TimezoneRange,
    string? DegreeRequirement,
    List<string>? Benefits,
    List<string>? LanguageRequirements,
    DateTimeOffset? StartDate,
    DateTimeOffset? EndDate,
    AutoCloseRule? AutoCloseRule,
    int? CandidatesNeededCount,
    int? Headcount,
    SalaryPeriod? SalaryPeriod,
    bool? IsSalaryNegotiable,
    bool? IsManuallyClosed
);

public record ResponsibilityDto(
    string Text,
    RequirementPriority Priority,
    OwnershipLevel OwnershipLevel,
    bool IsLeadership
);

public record RequirementCapabilityDto(
    string CapabilityId,
    string Name,
    string Category,
    RequirementPriority Priority,
    OwnershipLevel OwnershipLevel,
    int ExpectedProficiency
);

public record TechnologyRequirementDto(
    string Name,
    RequirementPriority Priority,
    int SfiaLevel
);

public record CandidateMatchDto(
    Guid CandidateId,
    string FullName,
    string? AvatarUrl,
    string? Headline,
    string? CareerLevel,
    string? CareerLevelLabel,
    double MatchScore,
    double TrustLevel,
    MatchBreakdownDto Breakdown,
    List<EvidenceTraceDto> Traces
);

public record MatchBreakdownDto(
    double CapabilitiesScore,
    double SkillsScore,
    double ResponsibilitiesScore,
    double SalaryScore,
    double CosineSimilarity,
    double GapScore
);

public record EvidenceTraceDto(
    string CapabilityId,
    string CapabilityName,
    double Confidence,
    string MatchStatus,
    string Metric,
    string TargetFile,
    string Rationale
);

public record CreateCapabilityCatalogItemDto(
    Guid WorkspaceId,
    string DisplayName,
    string Category,
    string Description,
    List<string> Skills,
    List<string> ExpectedEvidence
);

public record UpdateCapabilityCatalogItemDto(
    string DisplayName,
    string Category,
    string Description,
    List<string> Skills,
    List<string> ExpectedEvidence
);

public record PaginatedListDto<T>(
    List<T> Items,
    int TotalCount,
    int Page,
    int PageSize
);

public record BulkHiringRequirementOperationDto(
    List<Guid> Ids
);

public record GenerateArtifactRequestDto(
    string ArtifactType
);

public record CancelArtifactRequestDto(
    string ArtifactType
);

public record UpdateJobVacancyDto(
    string Title,
    string Department,
    string WorkplaceType,
    string City,
    string Type,
    string Salary,
    string SalaryMinMax,
    int Headcount,
    string Gender,
    string Experience,
    string Degree,
    string Category,
    List<string> Description,
    List<string> Requirements,
    List<string> Benefits,
    List<string> Tags,
    List<string> Skills,
    string CoverUrl,
    string AcquisitionStrategy,
    string DiscoveryProfileJson
);

public record PublishRequirementRequestDto(
    string? Notes = null
);

public record CandidateDiscoveryRunDto(
    Guid Id,
    Guid HiringRequirementId,
    Guid? TriggeredById,
    DateTimeOffset StartedAt,
    DateTimeOffset? CompletedAt,
    DiscoveryStatus Status,
    int CandidatesFoundCount,
    string? MatchQualitySummary,
    string? ErrorMessage,
    List<CandidateMatchDto>? Matches
);

public record TriggerDiscoveryResponseDto(
    Guid RunId,
    DiscoveryStatus Status
);
