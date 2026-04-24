using System;
using System.Collections.Generic;

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
    PublicCareerPreferenceDto? CareerPreference
);
