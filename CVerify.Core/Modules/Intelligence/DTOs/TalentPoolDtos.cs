using System;
using System.Collections.Generic;

namespace CVerify.API.Modules.Intelligence.DTOs;

public record SaveCandidateDto(Guid CandidateId);

public record UpdateCandidateMetaDto(
    string? Notes,
    List<string>? Tags,
    string? HiringStage,
    Guid? RecruiterId
);

public record BulkActionDto(
    List<Guid> CandidateIds,
    string ActionType, // "Delete", "UpdateStage", "AddTags"
    string? StageValue,
    List<string>? TagValues
);

public record OrganizationCandidateDto(
    Guid Id,
    Guid CandidateId,
    string FullName,
    string? Username,
    string? Headline,
    string? Bio,
    string? Location,
    string? AvatarUrl,
    int TrustScore,
    string TrustTier,
    double AiScore,
    string? CareerLevel,
    bool AvailableForHire,
    List<string> PrimarySkills,
    List<string> SavedTags,
    string HiringStage,
    Guid? AssignedRecruiterId,
    string? AssignedRecruiterName,
    string? RecruiterNotes,
    DateTimeOffset SavedAt
);

public record TalentPoolAnalyticsDto(
    int TotalCandidates,
    int VerifiedCandidates,
    double AverageTrustScore,
    Dictionary<string, int> StageDistribution,
    Dictionary<string, int> SkillDistribution,
    Dictionary<string, int> ExperienceDistribution
);
