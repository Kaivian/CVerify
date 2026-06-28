using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace CVerify.API.Modules.Profiles.DTOs;

public record UpdateProfileRequest(
    [MaxLength(100)]
    string? FullName,

    [MaxLength(160)]
    string? Bio,

    [MaxLength(50)]
    string? Location,

    [MaxLength(15)]
    [RegularExpression(@"^\+?[0-9\s\-()]{0,15}$", ErrorMessage = "Invalid phone number format.")]
    string? PhoneNumber,

    DateTimeOffset? BirthDate,

    [MaxLength(50)]
    string? Headline,

    [MaxLength(50)]
    string? Company,

    [MaxLength(20)]
    string? Pronouns,

    [MaxLength(30)]
    string? CustomPronouns,

    [MaxLength(255)]
    [EmailAddress(ErrorMessage = "Invalid public email address format.")]
    string? PublicEmail,

    [Required]
    [MaxLength(20)]
    string ProfileVisibility, // "public" or "private" or "connections"

    bool RecruiterVisibility,

    [Required]
    [MaxLength(20)]
    string AiTalentDiscovery,

    List<string>? SocialLinks,

    string? AiSuggestionsJson,

    [Required]
    uint Version // Optimistic concurrency token (xmin)
);

public record ProfileResponse(
    Guid UserId,
    string? Username,
    string? FullName,
    string? Bio,
    string? Location,
    string? PhoneNumber,
    DateTimeOffset? BirthDate,
    string? Headline,
    string? Company,
    string? Pronouns,
    string? CustomPronouns,
    string? PublicEmail,
    string ProfileVisibility,
    bool RecruiterVisibility,
    string AiTalentDiscovery,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    uint Version,
    string? AiSuggestionsJson,
    List<string> SocialLinks
);

public record UpdateUsernameRequest(
    [Required]
    [MinLength(3, ErrorMessage = "Username must be at least 3 characters long.")]
    [MaxLength(32, ErrorMessage = "Username cannot exceed 32 characters.")]
    [RegularExpression(@"^[a-zA-Z0-9_\-\.]+$", ErrorMessage = "Username can only contain alphanumeric characters, underscores, hyphens, and periods.")]
    string NewUsername
);

public record EducationEntryRequest(
    [Required]
    [MaxLength(255)]
    string Label,

    [Required]
    [MaxLength(255)]
    string SchoolName,

    [MaxLength(255)]
    string? Degree,

    [MaxLength(255)]
    string? Major,

    [Range(0.0, 100.0, ErrorMessage = "GPA must be between 0.0 and GPAScale.")]
    decimal? GPA,

    [Range(1.0, 100.0, ErrorMessage = "GPA scale must be at least 1.0.")]
    decimal? GPAScale,

    string? Description,

    DateTimeOffset? StartDate,

    DateTimeOffset? EndDate,

    bool IsCurrentlyStudying
);

public record EducationEntryResponse(
    Guid Id,
    Guid UserId,
    string Label,
    string SchoolName,
    string? Degree,
    string? Major,
    decimal? GPA,
    decimal? GPAScale,
    string? Description,
    DateTimeOffset? StartDate,
    DateTimeOffset? EndDate,
    bool IsCurrentlyStudying,
    int DisplayOrder
);

public record ReorderItemsRequest(
    [Required]
    List<Guid> OrderedIds
);

public record AcademicAchievementRequest(
    [Required]
    [MaxLength(255)]
    string Title,

    [Required]
    [MaxLength(255)]
    string Issuer,

    [Required]
    DateTimeOffset IssueDate,

    [Required]
    [MaxLength(2000)]
    string Description,

    [MaxLength(255)]
    [Url(ErrorMessage = "Invalid credential URL.")]
    string? CredentialUrl,

    Guid? AttachmentId
);

public record AcademicAchievementResponse(
    Guid Id,
    Guid UserId,
    string Title,
    string Issuer,
    DateTimeOffset IssueDate,
    string Description,
    string? CredentialUrl,
    int DisplayOrder,
    AttachmentResponse? Attachment
);

public record DeclaredCareerPreferenceDto(
    Guid UserId,
    bool AvailableForHire,
    string PreferredLanguage,
    string? JobTitlePreferences,
    decimal? SalaryExpectations,
    string? RemotePreference,
    string OpenToWorkStatus,
    bool OpenToRelocation,
    string LeadershipTrack,
    List<string> CompanyStagePreferences,
    List<string> PreferredIndustries,
    List<string> TargetSkills,
    List<string> PreferredWorkEnvironments,
    List<string> WorkStyles,
    List<string> CompanyValues,
    decimal? ExpectedSalaryMin,
    decimal? ExpectedSalaryMax,
    string? ExpectedSalaryCurrency,
    string? ExpectedSalaryType,
    bool ExpectedSalaryNegotiable,
    bool IsExpectedSalaryVisible,
    string? WorkPreferenceNotes,
    List<string> DesiredJobPositions,
    List<string> Skills,
    List<string> PreferredLocations,
    List<string> EmploymentPreferences,
    uint Version
);

public record AiInferredPreferenceDto(
    string? InferredPrimaryRole,
    string? InferredSeniority,
    List<string> InferredSkills,
    decimal? InferredSalaryMin,
    decimal? InferredSalaryMax,
    string? InferredSalaryCurrency,
    List<string> InferredIndustries,
    decimal ConfidenceScore,
    string? SynthesisRationale,
    DateTimeOffset LastAnalyzedAt
);

public record CareerReadinessActionItem(
    string Id,
    string Message,
    int ImpactScore
);

public record CareerReadinessReportDto(
    int DiscoverabilityScore,
    string DiscoverabilityStatus,
    int CompletenessPercent,
    List<CareerReadinessActionItem> ActionItems
);

public record CareerPreferencesDashboardResponse(
    DeclaredCareerPreferenceDto DeclaredPreferences,
    AiInferredPreferenceDto? AiInferredPreferences,
    CareerReadinessReportDto ReadinessReport
);

public record UpdateCareerPreferenceRequest(
    bool? AvailableForHire,

    [MaxLength(10)]
    string? PreferredLanguage,

    [MaxLength(255)]
    string? JobTitlePreferences,

    [Range(0.0, 999999999999.99, ErrorMessage = "Salary expectations must be positive.")]
    decimal? SalaryExpectations,

    [MaxLength(20)]
    string? RemotePreference,

    [MaxLength(20)]
    string? OpenToWorkStatus,

    bool? OpenToRelocation,

    [MaxLength(30)]
    string? LeadershipTrack,

    List<string>? CompanyStagePreferences,
    List<string>? PreferredIndustries,
    List<string>? TargetSkills,
    List<string>? PreferredWorkEnvironments,
    List<string>? WorkStyles,
    List<string>? CompanyValues,
    List<string>? DesiredJobPositions,
    List<string>? Skills,
    List<string>? PreferredLocations,
    List<string>? EmploymentPreferences,

    [Range(0.0, 999999999999.99, ErrorMessage = "Minimum salary cannot be negative.")]
    decimal? ExpectedSalaryMin,

    [Range(0.0, 999999999999.99, ErrorMessage = "Maximum salary cannot be negative.")]
    decimal? ExpectedSalaryMax,

    [MaxLength(10)] string? ExpectedSalaryCurrency,
    [MaxLength(20)] string? ExpectedSalaryType,
    bool? ExpectedSalaryNegotiable,
    bool? IsExpectedSalaryVisible,

    [MaxLength(2000, ErrorMessage = "Notes cannot exceed 2000 characters.")]
    string? WorkPreferenceNotes,

    [Required]
    uint Version // Optimistic concurrency token (xmin)
);

public record AcceptAiSuggestionsRequest(
    bool AcceptRoles,
    bool AcceptSkills,

    [Required]
    uint Version
);

// Retained for backward compatibility
public record CareerPreferenceResponse(
    Guid UserId,
    bool AvailableForHire,
    string PreferredLanguage,
    string? JobTitlePreferences,
    decimal? SalaryExpectations,
    string? RemotePreference,
    string? OpenToWorkStatus,
    List<string> Skills,
    List<string> PreferredLocations,
    List<string> EmploymentPreferences,
    uint Version,
    List<string> PreferredWorkEnvironments,
    List<string> WorkStyles,
    List<string> CompanyValues,
    List<string> DesiredJobPositions,
    decimal? ExpectedSalaryMin,
    decimal? ExpectedSalaryMax,
    string? ExpectedSalaryCurrency,
    string? ExpectedSalaryType,
    bool ExpectedSalaryNegotiable,
    bool IsExpectedSalaryVisible,
    string? WorkPreferenceNotes
);

public record AttachmentResponse(
    Guid Id,
    string FileName,
    long FileSize,
    string FileType,
    string FileUrl,
    DateTimeOffset CreatedAt
);

public record AvatarUploadResponse(string AvatarUrl);

public record SyncAvatarRequest(
    [Required]
    string ProviderName
);

public record WorkExperienceAchievementDto(
    [Required, MaxLength(255)] string Title,
    [Required, MaxLength(2000)] string Description
);

public record WorkExperienceLinkDto(
    [Required] int LinkType,
    [Required, MaxLength(500), Url(ErrorMessage = "Invalid project/repository URL.")] string Url
);

public record WorkExperienceRequest(
    [Required, MaxLength(255)] string JobTitle,
    [Required, MaxLength(255)] string Company,
    [Required] int ExperienceCategory,
    [Required] int EmploymentType,
    [MaxLength(255)] string? Location,
    [Required] DateTimeOffset StartDate,
    DateTimeOffset? EndDate,
    bool IsCurrentlyWorking,
    [Required, MaxLength(2000)] string Description,
    List<WorkExperienceAchievementDto>? Achievements,
    List<string>? Technologies,
    List<WorkExperienceLinkDto>? Links,
    bool IsLeadership = false
);

public record WorkExperienceResponse(
    Guid Id,
    Guid UserId,
    string JobTitle,
    string Company,
    int ExperienceCategory,
    int EmploymentType,
    string? Location,
    DateTimeOffset StartDate,
    DateTimeOffset? EndDate,
    bool IsCurrentlyWorking,
    string Description,
    int DisplayOrder,
    List<WorkExperienceAchievementDto> Achievements,
    List<string> Technologies,
    List<WorkExperienceLinkDto> Links,
    bool IsLeadership
);


