using System;
using System.Collections.Generic;

namespace CVerify.API.Modules.Profiles.DTOs;

public record RankingQueryDto(
    string? Search = null,
    string? Category = "Global",
    List<string>? TrustTiers = null,
    List<string>? ExperienceLevels = null,
    List<string>? Skills = null,
    string? Location = null,
    bool? AvailableForHire = null,
    int Page = 1,
    int PageSize = 20
);

public record CapabilityDto(
    string Name,
    double Score
);

public record RankingResponseItemDto(
    Guid CandidateId,
    string FullName,
    string? Username,
    string? Bio,
    string? Headline,
    string? Location,
    string? AvatarUrl,
    double CompositeScore,
    double AiScore,
    double TrustScore,
    double ProfileCompleteness,
    double EvidenceTrustScore,
    int VerifiedRepoCount,
    int TotalStarsCount,
    int TotalForksCount,
    int VerifiedContributionCount,
    List<CapabilityDto> TopCapabilities,
    string? PrimaryDomain,
    string? CareerLevelLabel,
    int FollowersCount,
    int FollowingCount,
    bool AvailableForHire,
    string OpenToWorkStatus,
    int GlobalRankPosition,
    int PreviousGlobalRankPosition,
    bool IsFollowedByCurrentUser,
    DateTimeOffset LastUpdatedAt
);

public record TrendingEngineerDto(
    Guid CandidateId,
    string FullName,
    string? Username,
    string? AvatarUrl,
    double CompositeScore,
    int GlobalRankPosition,
    int PreviousGlobalRankPosition,
    int RankDelta
);

public record RankingStatsDto(
    int TotalTalents,
    int TotalRepositories,
    int TotalCountries,
    List<string> TopTechnologies,
    List<string> FastestRisingSkills,
    List<TrendingEngineerDto> TrendingEngineers,
    double AverageTrustScore = 0.0,
    double AverageCapabilityScore = 0.0,
    double AverageRepositoryImpact = 0.0,
    double VerificationRate = 0.0,
    double AverageCompositeScore = 0.0
);

