using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using CVerify.API.Modules.Shared.Domain.Enums;

namespace CVerify.API.Modules.Profiles.DTOs;

public record ProjectEntryRequest(
    [Required, MaxLength(255)] string Name,
    [MaxLength(255)] string? Role,
    [Required, MaxLength(2000)] string Description,
    DateTimeOffset? StartDate,
    DateTimeOffset? EndDate,
    bool IsCurrentlyWorking,
    [Required] ProjectVerificationLevel VerificationLevel,
    List<Guid>? LinkedRepositoryIds,
    List<string>? Technologies,
    List<string>? Contributions
);

public record ProjectRepositoryLinkResponse(
    Guid Id,
    Guid SourceCodeRepositoryId,
    string Name,
    string Owner,
    string? HtmlUrl
);

public record ProjectEntryResponse(
    Guid Id,
    Guid UserId,
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
    List<ProjectRepositoryLinkResponse> RepositoryLinks,
    List<string> Technologies,
    List<string> Contributions
);
