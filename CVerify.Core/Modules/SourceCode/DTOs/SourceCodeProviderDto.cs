using System;

namespace CVerify.API.Modules.SourceCode.DTOs;

public record SourceCodeProviderDto(
    Guid Id,
    string ProviderName,
    string? ProviderEmail,
    string? ProviderUsername,
    string? ProviderDisplayName,
    string? ProviderAvatarUrl,
    string? ProviderProfileUrl,
    bool Connected,
    string ScopeValidationStatus,
    DateTimeOffset? LastProviderSyncAt,
    string SyncStatus,
    string? SyncError
);
