using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.SourceCode.Entities;

namespace CVerify.API.Modules.SourceCode.Clients;

public class GitLabSourceCodeClient : ISourceCodeClient
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly EnvConfiguration _envConfig;
    private readonly ILogger<GitLabSourceCodeClient> _logger;
    private readonly TimeProvider _timeProvider;

    public string ProviderName => "gitlab";

    public GitLabSourceCodeClient(
        IHttpClientFactory httpClientFactory,
        EnvConfiguration envConfig,
        ILogger<GitLabSourceCodeClient> logger,
        TimeProvider timeProvider)
    {
        _httpClientFactory = httpClientFactory;
        _envConfig = envConfig;
        _logger = logger;
        _timeProvider = timeProvider;
    }

    public async Task<TokenRefreshResult> RefreshTokenAsync(string refreshToken, CancellationToken cancellationToken)
    {
        var httpClient = _httpClientFactory.CreateClient();
        var requestParams = new Dictionary<string, string>
        {
            { "refresh_token", refreshToken },
            { "grant_type", "refresh_token" },
            { "client_id", _envConfig.Auth.GitlabClientId ?? "" },
            { "client_secret", _envConfig.Auth.GitlabClientSecret ?? "" }
        };

        var requestMessage = new HttpRequestMessage(HttpMethod.Post, "https://gitlab.com/oauth/token")
        {
            Content = new FormUrlEncodedContent(requestParams)
        };
        requestMessage.Headers.Accept.ParseAdd("application/json");

        var response = await httpClient.SendAsync(requestMessage, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var errContent = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new HttpRequestException($"GitLab Token refresh returned status {response.StatusCode}: {errContent}");
        }

        var responseJson = await response.Content.ReadAsStringAsync(cancellationToken);
        using var doc = JsonDocument.Parse(responseJson);
        var root = doc.RootElement;

        if (!root.TryGetProperty("access_token", out var accessTokenProp))
        {
            throw new InvalidOperationException("GitLab Token response did not contain an access_token.");
        }

        var accessToken = accessTokenProp.GetString() ?? "";
        string? newRefreshToken = root.TryGetProperty("refresh_token", out var refreshProp) ? refreshProp.GetString() : null;
        int? expiresIn = null;

        if (root.TryGetProperty("expires_in", out var expiresProp))
        {
            if (expiresProp.ValueKind == JsonValueKind.Number)
            {
                expiresIn = expiresProp.GetInt32();
            }
            else if (expiresProp.ValueKind == JsonValueKind.String && int.TryParse(expiresProp.GetString(), out var parsedExpires))
            {
                expiresIn = parsedExpires;
            }
        }

        return new TokenRefreshResult(accessToken, newRefreshToken, expiresIn);
    }

    public async Task<bool> ValidateScopesAsync(string accessToken, CancellationToken cancellationToken)
    {
        var httpClient = _httpClientFactory.CreateClient();
        var request = new HttpRequestMessage(HttpMethod.Get, "https://gitlab.com/api/v4/user");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

        var response = await httpClient.SendAsync(request, cancellationToken);
        return response.IsSuccessStatusCode;
    }

    public async Task<ExternalUserProfile> GetUserProfileAsync(string accessToken, CancellationToken cancellationToken)
    {
        var httpClient = _httpClientFactory.CreateClient();
        var request = new HttpRequestMessage(HttpMethod.Get, "https://gitlab.com/api/v4/user");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

        var response = await httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var errContent = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new HttpRequestException($"GitLab API Profile fetch returned status {response.StatusCode}: {errContent}");
        }

        var profileJson = await response.Content.ReadAsStringAsync(cancellationToken);
        using var doc = JsonDocument.Parse(profileJson);
        var root = doc.RootElement;

        if (!root.TryGetProperty("id", out var idProp))
        {
            throw new InvalidOperationException("GitLab profile did not contain an id.");
        }

        var id = idProp.GetInt64().ToString();
        var username = root.GetProperty("username").GetString() ?? "";
        var displayName = root.TryGetProperty("name", out var nameProp) ? nameProp.GetString() : null;
        var email = root.TryGetProperty("email", out var emailProp) ? emailProp.GetString() : null;
        var avatarUrl = root.TryGetProperty("avatar_url", out var avatarProp) ? avatarProp.GetString() : null;
        var profileUrl = root.TryGetProperty("web_url", out var htmlProp) ? htmlProp.GetString() : null;

        return new ExternalUserProfile(id, username, displayName, email, avatarUrl, profileUrl);
    }

    public async Task<SyncResult> SyncRepositoriesAsync(string accessToken, int page, int pageSize, CancellationToken cancellationToken)
    {
        var httpClient = _httpClientFactory.CreateClient();
        var orgsList = new List<ExternalOrganizationDto>();
        var reposList = new List<SourceCodeRepository>();

        try
        {
            var request = new HttpRequestMessage(HttpMethod.Get, $"https://gitlab.com/api/v4/projects?membership=true&per_page={pageSize}&page={page}");
            request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

            var response = await httpClient.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                var errContent = await response.Content.ReadAsStringAsync(cancellationToken);
                throw new HttpRequestException($"GitLab API fetch projects page {page} returned status {response.StatusCode}: {errContent}");
            }

            var responseJson = await response.Content.ReadAsStringAsync(cancellationToken);
            using var doc = JsonDocument.Parse(responseJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Array)
            {
                return new SyncResult(orgsList, reposList, null);
            }

            foreach (var projectElement in doc.RootElement.EnumerateArray())
            {
                var extId = projectElement.GetProperty("id").GetInt64().ToString();
                var name = projectElement.GetProperty("name").GetString() ?? "";
                
                var namespaceObj = projectElement.GetProperty("namespace");
                var ownerLogin = namespaceObj.TryGetProperty("full_path", out var fpProp) ? fpProp.GetString() ?? "" : (namespaceObj.GetProperty("path").GetString() ?? "");
                var ownerType = namespaceObj.TryGetProperty("kind", out var kindProp) ? kindProp.GetString() ?? "user" : "user";
                var owner = namespaceObj.GetProperty("name").GetString() ?? ownerLogin;
                
                var description = projectElement.TryGetProperty("description", out var descProp) ? descProp.GetString() : null;
                var htmlUrl = projectElement.TryGetProperty("web_url", out var urlProp) ? urlProp.GetString() : null;
                var defaultBranch = projectElement.TryGetProperty("default_branch", out var branchProp) ? branchProp.GetString() : "main";
                
                var visibility = projectElement.TryGetProperty("visibility", out var visProp) ? visProp.GetString() : "private";
                var isPrivate = visibility == "private" || visibility == "internal";

                var stars = projectElement.TryGetProperty("star_count", out var starsProp) ? starsProp.GetInt32() : 0;
                var forks = projectElement.TryGetProperty("forks_count", out var forksProp) ? forksProp.GetInt32() : 0;
                var openIssues = projectElement.TryGetProperty("open_issues_count", out var issuesProp) ? issuesProp.GetInt32() : 0;
                var watchers = stars;
                var archived = projectElement.TryGetProperty("archived", out var archivedProp) && archivedProp.GetBoolean();

                DateTimeOffset lastUpdated = _timeProvider.GetUtcNow();
                if (projectElement.TryGetProperty("last_activity_at", out var updatedProp) && DateTimeOffset.TryParse(updatedProp.GetString(), out var parsedUpdated))
                {
                    lastUpdated = parsedUpdated;
                }

                DateTimeOffset createdAt = _timeProvider.GetUtcNow();
                if (projectElement.TryGetProperty("created_at", out var createdProp) && DateTimeOffset.TryParse(createdProp.GetString(), out var parsedCreated))
                {
                    createdAt = parsedCreated;
                }

                reposList.Add(new SourceCodeRepository
                {
                    ExternalRepositoryId = extId,
                    Name = name,
                    Owner = owner,
                    Description = description,
                    HtmlUrl = htmlUrl,
                    DefaultBranch = defaultBranch,
                    OwnerLogin = ownerLogin,
                    OwnerType = ownerType == "group" ? "Organization" : "User",
                    IsPrivate = isPrivate,
                    PrimaryLanguage = null,
                    StarsCount = stars,
                    ForksCount = forks,
                    OpenIssuesCount = openIssues,
                    WatchersCount = watchers,
                    LastCommitAt = null,
                    LastUpdatedUtc = lastUpdated,
                    CreatedAtUtc = createdAt,
                    IsAccessible = true,
                    ArchivedExternally = archived
                });

                if (string.Equals(ownerType, "group", StringComparison.OrdinalIgnoreCase))
                {
                    var groupExtId = namespaceObj.GetProperty("id").GetInt64().ToString();
                    var groupName = namespaceObj.GetProperty("name").GetString() ?? ownerLogin;
                    var groupPath = namespaceObj.GetProperty("path").GetString() ?? "";
                    var fullPath = namespaceObj.TryGetProperty("full_path", out var fullPathProp) ? fullPathProp.GetString() ?? groupPath : groupPath;
                    var avatarUrl = namespaceObj.TryGetProperty("avatar_url", out var avatarProp) ? avatarProp.GetString() : null;
                    var webUrl = namespaceObj.TryGetProperty("web_url", out var urlValProp) ? urlValProp.GetString() : $"https://gitlab.com/groups/{fullPath}";

                    if (!orgsList.Any(o => string.Equals(o.ExternalId, groupExtId, StringComparison.OrdinalIgnoreCase)))
                    {
                        orgsList.Add(new ExternalOrganizationDto(groupExtId, groupName, fullPath, avatarUrl, webUrl, null));
                    }
                }
            }

            return new SyncResult(orgsList, reposList, null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred during GitLab synchronization.");
            return new SyncResult(orgsList, reposList, ex.Message);
        }
    }
}
