using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Modules.SourceCode.Entities;

namespace CVerify.API.Modules.SourceCode.Clients;

public record ExternalUserProfile(
    string Id,
    string Username,
    string? DisplayName,
    string? Email,
    string? AvatarUrl,
    string? ProfileUrl
);

public record ExternalOrganizationDto(
    string ExternalId,
    string Name,
    string Login,
    string? AvatarUrl,
    string? HtmlUrl,
    string? Description
);

public record SyncResult(
    List<ExternalOrganizationDto> Organizations,
    List<SourceCodeRepository> Repositories,
    string? SyncError,
    bool IsAuthError = false
);

public record TokenRefreshResult(
    string AccessToken,
    string? RefreshToken,
    int? ExpiresInSeconds
);

public interface ISourceCodeClient
{
    string ProviderName { get; }

    Task<TokenRefreshResult> RefreshTokenAsync(string refreshToken, CancellationToken cancellationToken);

    Task<bool> ValidateScopesAsync(string accessToken, CancellationToken cancellationToken);

    Task<ExternalUserProfile> GetUserProfileAsync(string accessToken, CancellationToken cancellationToken);

    Task<SyncResult> SyncRepositoriesAsync(string accessToken, int page, int pageSize, CancellationToken cancellationToken);
}
