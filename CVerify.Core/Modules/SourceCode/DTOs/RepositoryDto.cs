using System;

namespace CVerify.API.Modules.SourceCode.DTOs;

public record RepositoryDto(
    Guid Id,
    Guid AuthProviderId,
    string ExternalRepositoryId,
    string Name,
    string Owner,
    string? Description,
    string? HtmlUrl,
    string? DefaultBranch,
    string OwnerLogin,
    string OwnerType,
    bool IsPrivate,
    string? PrimaryLanguage,
    int StarsCount,
    int ForksCount,
    int OpenIssuesCount,
    int WatchersCount,
    DateTimeOffset? LastCommitAt,
    DateTimeOffset LastUpdatedUtc,
    DateTimeOffset LastSeenAt,
    bool IsAccessible,
    bool ArchivedExternally,
    bool IsEnabled,
    bool IsVerified,
    double TrustScore,
    string? CustomSettingsJson,
    string? Classification,
    string? AuthenticityType,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset LastSyncedAt
);
