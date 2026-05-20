using System;
using System.Collections.Generic;
using CVerify.API.Modules.Shared.Domain.Enums;

namespace CVerify.API.Modules.Profiles.DTOs;

public record PublicCareerPreferenceDto(
    bool AvailableForHire,
    string PreferredLanguage,
    List<string> EmploymentPreferences,
    List<string> PreferredWorkEnvironments,
    List<string> WorkStyles,
    List<string> CompanyValues,
    List<string> PreferredLocations,
    List<string> DesiredJobPositions,
    decimal? ExpectedSalaryMin,
    decimal? ExpectedSalaryMax,
    string? ExpectedSalaryCurrency,
    string? ExpectedSalaryType,
    bool ExpectedSalaryNegotiable,
    bool IsExpectedSalaryVisible,
    string? WorkPreferenceNotes
);

public record PublicRepositoryDto(
    Guid Id,
    string Name,
    string Owner,
    string? Description,
    string? HtmlUrl,
    string? PrimaryLanguage,
    double TrustScore,
    string? Classification,
    string LatestAnalysisStatus,
    DateTimeOffset? LatestAnalysisCompletedAtUtc
);

public record PublicProjectRepositoryLinkDto(
    Guid Id,
    Guid SourceCodeRepositoryId,
    string Name,
    string Owner,
    string? HtmlUrl
);

public record PublicProjectDto(
    Guid Id,
    string Name,
    string? Role,
    string Description,
    DateTimeOffset? StartDate,
    DateTimeOffset? EndDate,
    bool IsCurrentlyWorking,
    ProjectVerificationLevel VerificationLevel,
    ProjectVerificationStatus VerificationStatus,
    DateTimeOffset? VerifiedAt,
    string? VerificationMetadataJson,
    int DisplayOrder,
    List<PublicProjectRepositoryLinkDto> RepositoryLinks,
    List<string> Technologies,
    List<string> Contributions
);

public record PublicProfileResponse(
    Guid UserId,
    string Username,
    string FullName,
    string? AvatarUrl,
    string? Bio,
    string? Headline,
    string? Company,
    string? Location,
    List<string> SocialLinks,
    PublicCareerPreferenceDto? CareerPreference,
    double? TrustScore = null,
    List<PublicRepositoryDto>? Repositories = null,
    List<PublicProjectDto>? Projects = null,
    List<WorkExperienceResponse>? Experiences = null,
    List<EducationEntryResponse>? Educations = null,
    List<AcademicAchievementResponse>? Achievements = null,
    bool HasCompletedAssessment = false,
    DateTimeOffset? LastAssessmentDate = null
);
