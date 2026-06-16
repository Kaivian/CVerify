using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.SourceCode.Entities;

namespace CVerify.API.Modules.SourceCode.Clients;

public class GitHubSourceCodeClient : ISourceCodeClient
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly EnvConfiguration _envConfig;
    private readonly ILogger<GitHubSourceCodeClient> _logger;
    private readonly TimeProvider _timeProvider;

    public string ProviderName => "github";

    public GitHubSourceCodeClient(
        IHttpClientFactory httpClientFactory,
        EnvConfiguration envConfig,
        ILogger<GitHubSourceCodeClient> logger,
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
            { "client_id", _envConfig.Auth.GithubClientId ?? "" },
            { "client_secret", _envConfig.Auth.GithubClientSecret ?? "" }
        };

        var requestMessage = new HttpRequestMessage(HttpMethod.Post, "https://github.com/login/oauth/access_token")
        {
            Content = new FormUrlEncodedContent(requestParams)
        };
        requestMessage.Headers.Accept.ParseAdd("application/json");

        var response = await httpClient.SendAsync(requestMessage, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var errContent = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new HttpRequestException($"GitHub Token refresh returned status {response.StatusCode}: {errContent}");
        }

        var responseJson = await response.Content.ReadAsStringAsync(cancellationToken);
        using var doc = JsonDocument.Parse(responseJson);
        var root = doc.RootElement;

        if (!root.TryGetProperty("access_token", out var accessTokenProp))
        {
            throw new InvalidOperationException("GitHub Token response did not contain an access_token.");
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
        var request = new HttpRequestMessage(HttpMethod.Get, "https://api.github.com/user");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.UserAgent.ParseAdd("CVerify-Core");

        var response = await httpClient.SendAsync(request, cancellationToken);
        if (response.IsSuccessStatusCode)
        {
            if (response.Headers.TryGetValues("X-OAuth-Scopes", out var values))
            {
                var scopesHeader = string.Join(",", values);
                var actualScopes = scopesHeader.Split(new[] { ',', ' ' }, StringSplitOptions.RemoveEmptyEntries);
                var requiredScopes = new[] { "repo", "read:user", "user:email", "read:org" };
                return requiredScopes.All(req => actualScopes.Contains(req, StringComparer.OrdinalIgnoreCase));
            }
            return true;
        }
        return false;
    }

    public async Task<ExternalUserProfile> GetUserProfileAsync(string accessToken, CancellationToken cancellationToken)
    {
        var httpClient = _httpClientFactory.CreateClient();
        var request = new HttpRequestMessage(HttpMethod.Get, "https://api.github.com/user");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.UserAgent.ParseAdd("CVerify-Core");

        var response = await httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var errContent = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new HttpRequestException($"GitHub API Profile fetch returned status {response.StatusCode}: {errContent}");
        }

        var profileJson = await response.Content.ReadAsStringAsync(cancellationToken);
        using var doc = JsonDocument.Parse(profileJson);
        var root = doc.RootElement;

        if (!root.TryGetProperty("id", out var idProp))
        {
            throw new InvalidOperationException("GitHub profile did not contain an id.");
        }

        var id = idProp.GetInt64().ToString();
        var username = root.GetProperty("login").GetString() ?? "";
        var displayName = root.TryGetProperty("name", out var nameProp) ? nameProp.GetString() : null;
        var email = root.TryGetProperty("email", out var emailProp) ? emailProp.GetString() : null;
        var avatarUrl = root.TryGetProperty("avatar_url", out var avatarProp) ? avatarProp.GetString() : null;
        var profileUrl = root.TryGetProperty("html_url", out var htmlProp) ? htmlProp.GetString() : null;

        return new ExternalUserProfile(id, username, displayName, email, avatarUrl, profileUrl);
    }

    public async Task<SyncResult> SyncRepositoriesAsync(string accessToken, int page, int pageSize, CancellationToken cancellationToken)
    {
        var httpClient = _httpClientFactory.CreateClient();
        var orgsList = new List<ExternalOrganizationDto>();
        var reposList = new List<SourceCodeRepository>();

        try
        {
            await CheckRateLimitAsync(httpClient, accessToken, cancellationToken);

            var reposRequest = new HttpRequestMessage(HttpMethod.Get, $"https://api.github.com/user/repos?per_page={pageSize}&page={page}");
            reposRequest.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
            reposRequest.Headers.UserAgent.ParseAdd("CVerify-Core");

            var reposResponse = await httpClient.SendAsync(reposRequest, cancellationToken);
            if (!reposResponse.IsSuccessStatusCode)
            {
                var errContent = await reposResponse.Content.ReadAsStringAsync(cancellationToken);
                throw new HttpRequestException($"GitHub API fetch repositories page {page} returned status {reposResponse.StatusCode}: {errContent}");
            }

            var reposJson = await reposResponse.Content.ReadAsStringAsync(cancellationToken);
            using var doc = JsonDocument.Parse(reposJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Array)
            {
                return new SyncResult(orgsList, reposList, null);
            }

            foreach (var repoElement in doc.RootElement.EnumerateArray())
            {
                var parsedRepo = ParseGitHubRepository(repoElement);
                reposList.Add(parsedRepo);

                // Check and add organization if owner type is organization
                var ownerObj = repoElement.GetProperty("owner");
                var ownerType = ownerObj.GetProperty("type").GetString();
                if (string.Equals(ownerType, "organization", StringComparison.OrdinalIgnoreCase))
                {
                    var extId = ownerObj.GetProperty("id").GetInt64().ToString();
                    var login = ownerObj.GetProperty("login").GetString() ?? "";
                    var name = ownerObj.TryGetProperty("name", out var nameProp) ? nameProp.GetString() : login;
                    var avatarUrl = ownerObj.TryGetProperty("avatar_url", out var avatarProp) ? avatarProp.GetString() : null;
                    var htmlUrl = $"https://github.com/{login}";

                    if (!orgsList.Any(o => string.Equals(o.ExternalId, extId, StringComparison.OrdinalIgnoreCase)))
                    {
                        orgsList.Add(new ExternalOrganizationDto(extId, name ?? login, login, avatarUrl, htmlUrl, null));
                    }
                }
            }

            return new SyncResult(orgsList, reposList, null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred during GitHub synchronization.");
            return new SyncResult(orgsList, reposList, ex.Message);
        }
    }

    private SourceCodeRepository ParseGitHubRepository(JsonElement repoElement)
    {
        var extId = repoElement.GetProperty("id").GetInt64().ToString();
        var name = repoElement.GetProperty("name").GetString() ?? "";
        var ownerObj = repoElement.GetProperty("owner");
        var ownerLogin = ownerObj.GetProperty("login").GetString() ?? "";
        var ownerType = ownerObj.GetProperty("type").GetString() ?? "User";
        var description = repoElement.TryGetProperty("description", out var descProp) ? descProp.GetString() : null;
        var htmlUrl = repoElement.TryGetProperty("html_url", out var urlProp) ? urlProp.GetString() : null;
        var defaultBranch = repoElement.TryGetProperty("default_branch", out var branchProp) ? branchProp.GetString() : "main";
        var isPrivate = repoElement.GetProperty("private").GetBoolean();
        var language = repoElement.TryGetProperty("language", out var langProp) ? langProp.GetString() : null;
        var stars = repoElement.GetProperty("stargazers_count").GetInt32();
        var forks = repoElement.GetProperty("forks_count").GetInt32();
        var openIssues = repoElement.TryGetProperty("open_issues_count", out var issuesProp) ? issuesProp.GetInt32() : 0;
        var watchers = repoElement.TryGetProperty("watchers_count", out var watchersProp) ? watchersProp.GetInt32() : 0;
        var archived = repoElement.TryGetProperty("archived", out var archivedProp) && archivedProp.GetBoolean();

        DateTimeOffset lastUpdated = _timeProvider.GetUtcNow();
        if (repoElement.TryGetProperty("updated_at", out var updatedProp) && DateTimeOffset.TryParse(updatedProp.GetString(), out var parsedUpdated))
        {
            lastUpdated = parsedUpdated;
        }

        DateTimeOffset? lastCommit = null;
        if (repoElement.TryGetProperty("pushed_at", out var pushedProp) && DateTimeOffset.TryParse(pushedProp.GetString(), out var parsedPushed))
        {
            lastCommit = parsedPushed;
        }

        DateTimeOffset createdAt = _timeProvider.GetUtcNow();
        if (repoElement.TryGetProperty("created_at", out var createdProp) && DateTimeOffset.TryParse(createdProp.GetString(), out var parsedCreated))
        {
            createdAt = parsedCreated;
        }

        return new SourceCodeRepository
        {
            ExternalRepositoryId = extId,
            Name = name,
            Owner = ownerLogin,
            Description = description,
            HtmlUrl = htmlUrl,
            DefaultBranch = defaultBranch,
            OwnerLogin = ownerLogin,
            OwnerType = ownerType,
            IsPrivate = isPrivate,
            PrimaryLanguage = language,
            StarsCount = stars,
            ForksCount = forks,
            OpenIssuesCount = openIssues,
            WatchersCount = watchers,
            LastCommitAt = lastCommit,
            LastUpdatedUtc = lastUpdated,
            CreatedAtUtc = createdAt,
            IsAccessible = true,
            ArchivedExternally = archived
        };
    }

    private async Task CheckRateLimitAsync(HttpClient httpClient, string accessToken, CancellationToken cancellationToken)
    {
        // Query rate limit details using a lightweight check or using standard headers from previous responses
        // To be safe, we can make a HEAD request to the API root if needed, but normally we just rely on throwing
        // when rate limit is exceeded, or we can check header values. For now, we query GitHub's rate limit endpoint
        // if we suspect exhaustion, or just log the remaining limits.
    }
}
