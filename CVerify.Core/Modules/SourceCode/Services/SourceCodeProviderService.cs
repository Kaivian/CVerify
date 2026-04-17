using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.Auth.Entities;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Security;
using CVerify.API.Modules.Shared.System.Services;
using CVerify.API.Modules.SourceCode.DTOs;
using CVerify.API.Modules.SourceCode.Entities;
using CVerify.API.Modules.Admin.DTOs;

namespace CVerify.API.Modules.SourceCode.Services;

public class SourceCodeProviderService : ISourceCodeProviderService
{
    private readonly ApplicationDbContext _context;
    private readonly ICacheService _cacheService;
    private readonly IRepositorySyncQueue _syncQueue;
    private readonly EnvConfiguration _envConfig;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<SourceCodeProviderService> _logger;
    private readonly TimeProvider _timeProvider;

    public SourceCodeProviderService(
        ApplicationDbContext context,
        ICacheService cacheService,
        IRepositorySyncQueue syncQueue,
        EnvConfiguration envConfig,
        IHttpClientFactory httpClientFactory,
        ILogger<SourceCodeProviderService> logger,
        TimeProvider timeProvider)
    {
        _context = context;
        _cacheService = cacheService;
        _syncQueue = syncQueue;
        _envConfig = envConfig;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _timeProvider = timeProvider;
    }

    public async Task<IEnumerable<SourceCodeProviderDto>> GetProvidersAsync(Guid userId)
    {
        var linked = await _context.AuthProviders
            .Where(ap => ap.UserId == userId && ap.DeletedAt == null)
            .ToListAsync();

        var result = new List<SourceCodeProviderDto>();
        var supported = new[] { "github", "gitlab" };

        foreach (var providerName in supported)
        {
            var matchedProviders = linked.Where(ap => string.Equals(ap.ProviderName, providerName, StringComparison.OrdinalIgnoreCase)).ToList();
            if (matchedProviders.Any())
            {
                foreach (var matched in matchedProviders)
                {
                    var email = matched.ProviderAccountId?.Contains('@') == true ? matched.ProviderAccountId : null;
                    var username = matched.ProviderAccountId?.Contains('@') == false ? matched.ProviderAccountId : null;
                    
                    result.Add(new SourceCodeProviderDto(
                        Id: matched.Id,
                        ProviderName: matched.ProviderName.ToLowerInvariant(),
                        ProviderEmail: email,
                        ProviderUsername: username ?? matched.ProviderUsername,
                        ProviderDisplayName: matched.ProviderDisplayName,
                        ProviderAvatarUrl: matched.ProviderAvatarUrl,
                        ProviderProfileUrl: matched.ProviderProfileUrl,
                        Connected: true,
                        ScopeValidationStatus: matched.ScopeValidationStatus.ToString(),
                        LastProviderSyncAt: matched.LastProviderSyncAt,
                        SyncStatus: matched.SyncStatus ?? "Pending",
                        SyncError: matched.SyncError
                    ));
                }
            }
        }

        return result;
    }

    public async Task<PaginatedResultDto<RepositoryDto>> GetRepositoriesAsync(
        Guid userId, 
        Guid? providerId, 
        string? search, 
        string? visibility, 
        string? language, 
        string? sort, 
        int page, 
        int pageSize)
    {
        var query = _context.SourceCodeRepositories
            .Include(r => r.AuthProvider)
            .Where(r => r.AuthProvider.UserId == userId && r.AuthProvider.DeletedAt == null);

        if (providerId.HasValue)
        {
            query = query.Where(r => r.AuthProviderId == providerId.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var cleanSearch = search.Trim();
            query = query.Where(r => EF.Functions.ILike(r.Name, $"%{cleanSearch}%") 
                                  || EF.Functions.ILike(r.Description ?? "", $"%{cleanSearch}%")
                                  || EF.Functions.ILike(r.Owner, $"%{cleanSearch}%"));
        }

        if (!string.IsNullOrWhiteSpace(visibility) && !string.Equals(visibility, "all", StringComparison.OrdinalIgnoreCase))
        {
            if (string.Equals(visibility, "private", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(r => r.IsPrivate);
            }
            else if (string.Equals(visibility, "public", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(r => !r.IsPrivate);
            }
        }

        if (!string.IsNullOrWhiteSpace(language))
        {
            query = query.Where(r => r.PrimaryLanguage != null && EF.Functions.ILike(r.PrimaryLanguage, language));
        }

        // Apply Sorting
        query = sort?.ToLowerInvariant() switch
        {
            "stars" => query.OrderByDescending(r => r.StarsCount),
            "name_asc" => query.OrderBy(r => r.Name),
            "name_desc" => query.OrderByDescending(r => r.Name),
            "updated" => query.OrderByDescending(r => r.LastUpdatedUtc),
            _ => query.OrderByDescending(r => r.LastUpdatedUtc) // default
        };

        var totalCount = await query.CountAsync();
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new RepositoryDto(
                r.Id,
                r.AuthProviderId,
                r.ExternalRepositoryId,
                r.Name,
                r.Owner,
                r.Description,
                r.HtmlUrl,
                r.DefaultBranch,
                r.OwnerLogin,
                r.OwnerType,
                r.IsPrivate,
                r.PrimaryLanguage,
                r.StarsCount,
                r.ForksCount,
                r.OpenIssuesCount,
                r.WatchersCount,
                r.LastCommitAt,
                r.LastUpdatedUtc,
                r.LastSeenAt,
                r.IsAccessible,
                r.ArchivedExternally,
                r.IsEnabled,
                r.IsVerified,
                r.TrustScore,
                r.CustomSettingsJson,
                r.CreatedAtUtc,
                r.LastSyncedAt
            ))
            .ToListAsync();

        return new PaginatedResultDto<RepositoryDto>(items, totalCount, page, pageSize);
    }

    public async Task<Guid> EnqueueSyncJobAsync(Guid userId, Guid? providerId)
    {
        var jobId = Guid.CreateVersion7();
        var jobStatus = new RepositorySyncJobStatus
        {
            JobId = jobId,
            UserId = userId,
            AuthProviderId = providerId,
            Status = "Pending",
            CreatedAt = _timeProvider.GetUtcNow(),
            UpdatedAt = _timeProvider.GetUtcNow()
        };

        // Cache in Redis with 30 minutes Time-To-Live
        var redisKey = $"repository:sync:job:{jobId}";
        await _cacheService.SetAsync(redisKey, jobStatus, TimeSpan.FromMinutes(30));

        // Enqueue job details
        _syncQueue.QueueSyncJob(new RepositorySyncJob(jobId, userId, providerId));

        return jobId;
    }

    public async Task<RepositorySyncJobStatus?> GetSyncStatusAsync(Guid userId, Guid jobId)
    {
        var redisKey = $"repository:sync:job:{jobId}";
        var status = await _cacheService.GetAsync<RepositorySyncJobStatus>(redisKey);

        if (status == null) return null;

        // Verify ownership
        if (status.UserId != userId) return null;

        // Restart / Timeout Recovery Check:
        // If the job is active (Pending/Syncing) but has not updated its timestamp in over 10 minutes, mark as failed
        if ((status.Status == "Pending" || status.Status == "Syncing") && 
            _timeProvider.GetUtcNow() - status.UpdatedAt > TimeSpan.FromMinutes(10))
        {
            status.Status = "Failed";
            status.Error = "Synchronization interrupted due to server reboot or timeout.";
            status.UpdatedAt = _timeProvider.GetUtcNow();
            await _cacheService.SetAsync(redisKey, status, TimeSpan.FromMinutes(30));
        }

        return status;
    }

    public async Task ExecuteSyncJobAsync(RepositorySyncJob job, CancellationToken cancellationToken)
    {
        var redisKey = $"repository:sync:job:{job.JobId}";
        var status = await _cacheService.GetAsync<RepositorySyncJobStatus>(redisKey);
        if (status == null) return;

        status.Status = "Syncing";
        status.UpdatedAt = _timeProvider.GetUtcNow();
        await _cacheService.SetAsync(redisKey, status, TimeSpan.FromMinutes(30));

        try
        {
            List<AuthProvider> providersToSync;
            if (job.AuthProviderId.HasValue)
            {
                var matched = await _context.AuthProviders
                    .Include(ap => ap.OAuthCredential)
                    .FirstOrDefaultAsync(ap => ap.Id == job.AuthProviderId.Value && ap.UserId == job.UserId && ap.DeletedAt == null, cancellationToken);
                
                providersToSync = matched != null ? new List<AuthProvider> { matched } : new List<AuthProvider>();
            }
            else
            {
                providersToSync = await _context.AuthProviders
                    .Include(ap => ap.OAuthCredential)
                    .Where(ap => ap.UserId == job.UserId && ap.DeletedAt == null && (ap.ProviderName == "github" || ap.ProviderName == "gitlab"))
                    .ToListAsync(cancellationToken);
            }

            if (!providersToSync.Any())
            {
                status.Status = "Completed";
                status.Progress = 100.0;
                status.UpdatedAt = _timeProvider.GetUtcNow();
                await _cacheService.SetAsync(redisKey, status, TimeSpan.FromMinutes(30));
                return;
            }

            double progressPerProvider = 100.0 / providersToSync.Count;
            double currentProgress = 0.0;

            foreach (var provider in providersToSync)
            {
                provider.SyncStatus = "Syncing";
                provider.SyncError = null;
                await _context.SaveChangesAsync(cancellationToken);

                try
                {
                    await SyncProviderRepositoriesAsync(provider, cancellationToken);
                    
                    provider.SyncStatus = "Synced";
                    provider.SyncError = null;
                    provider.LastProviderSyncAt = _timeProvider.GetUtcNow();
                }
                catch (Exception providerEx)
                {
                    _logger.LogError(providerEx, "Failed to sync connection {AuthProviderId}", provider.Id);
                    provider.SyncStatus = "Failed";
                    provider.SyncError = providerEx.Message;
                }

                await _context.SaveChangesAsync(cancellationToken);

                currentProgress += progressPerProvider;
                status.Progress = Math.Min(currentProgress, 99.0);
                status.UpdatedAt = _timeProvider.GetUtcNow();
                await _cacheService.SetAsync(redisKey, status, TimeSpan.FromMinutes(30));
            }

            // Sync Job Completed
            status.Status = "Completed";
            status.Progress = 100.0;
            status.UpdatedAt = _timeProvider.GetUtcNow();
            await _cacheService.SetAsync(redisKey, status, TimeSpan.FromMinutes(30));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Fatal error executing sync job {JobId}", job.JobId);
            status.Status = "Failed";
            status.Error = ex.Message;
            status.UpdatedAt = _timeProvider.GetUtcNow();
            await _cacheService.SetAsync(redisKey, status, TimeSpan.FromMinutes(30));
        }
    }

    private async Task<string> GetOrRefreshAccessTokenAsync(AuthProvider provider, CancellationToken cancellationToken)
    {
        if (provider.OAuthCredential == null)
        {
            provider.OAuthCredential = await _context.OAuthCredentials
                .FirstOrDefaultAsync(oc => oc.AuthProviderId == provider.Id, cancellationToken);
        }

        if (provider.OAuthCredential == null)
        {
            throw new InvalidOperationException("OAuth connection credentials are missing.");
        }

        if (provider.OAuthCredential.ExpiresAt.HasValue && 
            provider.OAuthCredential.ExpiresAt.Value - _timeProvider.GetUtcNow() < TimeSpan.FromMinutes(5))
        {
            _logger.LogInformation("Access token for provider {ProviderId} ({ProviderName}) is expired or close to expiry. Refreshing...", 
                provider.Id, provider.ProviderName);
            try
            {
                return await RefreshTokenInternalAsync(provider, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to auto-refresh access token for provider {ProviderId}", provider.Id);
                throw;
            }
        }

        if (string.IsNullOrEmpty(_envConfig.Security.TokenEncryptionKey))
        {
            throw new InvalidOperationException("Token encryption key is not configured on server.");
        }

        return EncryptionHelper.Decrypt(provider.OAuthCredential.EncryptedAccessToken, _envConfig.Security.TokenEncryptionKey);
    }

    private async Task<string> RefreshTokenInternalAsync(AuthProvider provider, CancellationToken cancellationToken)
    {
        if (provider.OAuthCredential == null)
        {
            provider.OAuthCredential = await _context.OAuthCredentials
                .FirstOrDefaultAsync(oc => oc.AuthProviderId == provider.Id, cancellationToken);
        }

        if (provider.OAuthCredential == null)
        {
            throw new InvalidOperationException("OAuth connection credentials are missing.");
        }

        if (string.IsNullOrEmpty(_envConfig.Security.TokenEncryptionKey))
        {
            throw new InvalidOperationException("Token encryption key is not configured on server.");
        }

        if (string.IsNullOrEmpty(provider.OAuthCredential.EncryptedRefreshToken))
        {
            throw new InvalidOperationException("OAuth refresh token is missing. Re-authorization is required.");
        }

        var decryptedRefreshToken = EncryptionHelper.Decrypt(provider.OAuthCredential.EncryptedRefreshToken, _envConfig.Security.TokenEncryptionKey);
        var httpClient = _httpClientFactory.CreateClient();
        
        string tokenEndpoint;
        var requestParams = new Dictionary<string, string>
        {
            { "refresh_token", decryptedRefreshToken },
            { "grant_type", "refresh_token" }
        };

        if (string.Equals(provider.ProviderName, "github", StringComparison.OrdinalIgnoreCase))
        {
            tokenEndpoint = "https://github.com/login/oauth/access_token";
            requestParams.Add("client_id", _envConfig.Auth.GithubClientId ?? "");
            requestParams.Add("client_secret", _envConfig.Auth.GithubClientSecret ?? "");
        }
        else if (string.Equals(provider.ProviderName, "gitlab", StringComparison.OrdinalIgnoreCase))
        {
            tokenEndpoint = "https://gitlab.com/oauth/token";
            requestParams.Add("client_id", _envConfig.Auth.GitlabClientId ?? "");
            requestParams.Add("client_secret", _envConfig.Auth.GitlabClientSecret ?? "");
        }
        else
        {
            throw new NotSupportedException($"Token refresh is not supported for provider '{provider.ProviderName}'.");
        }

        var requestMessage = new HttpRequestMessage(HttpMethod.Post, tokenEndpoint)
        {
            Content = new FormUrlEncodedContent(requestParams)
        };
        requestMessage.Headers.Accept.ParseAdd("application/json");

        var response = await httpClient.SendAsync(requestMessage, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var errContent = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogError("Token refresh failed for provider {ProviderName}. HTTP status: {StatusCode}, Error: {Error}", 
                provider.ProviderName, response.StatusCode, errContent);
            
            provider.RefreshFailureCount++;
            provider.SyncStatus = "Failed";
            provider.SyncError = $"Token refresh failed: {response.StatusCode}. Please re-connect account.";
            await _context.SaveChangesAsync(cancellationToken);

            throw new HttpRequestException($"Token refresh returned status {response.StatusCode}: {errContent}");
        }

        var responseJson = await response.Content.ReadAsStringAsync(cancellationToken);
        using var doc = JsonDocument.Parse(responseJson);
        var root = doc.RootElement;

        if (!root.TryGetProperty("access_token", out var accessTokenProp))
        {
            throw new InvalidOperationException("Response did not contain an access_token.");
        }

        var newAccessToken = accessTokenProp.GetString() ?? "";
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

        var encryptedAccess = EncryptionHelper.Encrypt(newAccessToken, _envConfig.Security.TokenEncryptionKey);
        provider.OAuthCredential.EncryptedAccessToken = encryptedAccess;

        if (!string.IsNullOrEmpty(newRefreshToken))
        {
            provider.OAuthCredential.EncryptedRefreshToken = EncryptionHelper.Encrypt(newRefreshToken, _envConfig.Security.TokenEncryptionKey);
        }

        if (expiresIn.HasValue)
        {
            provider.OAuthCredential.ExpiresAt = _timeProvider.GetUtcNow().AddSeconds(expiresIn.Value);
        }
        else
        {
            provider.OAuthCredential.ExpiresAt = null;
        }

        provider.OAuthCredential.UpdatedAt = _timeProvider.GetUtcNow();
        provider.LastSuccessfulRefreshAt = _timeProvider.GetUtcNow();
        provider.RefreshFailureCount = 0;

        await _context.SaveChangesAsync(cancellationToken);

        return newAccessToken;
    }

    private async Task SyncProviderRepositoriesAsync(AuthProvider provider, CancellationToken cancellationToken)
    {
        if (provider.OAuthCredential == null)
        {
            provider.OAuthCredential = await _context.OAuthCredentials
                .FirstOrDefaultAsync(oc => oc.AuthProviderId == provider.Id, cancellationToken);
        }

        if (provider.OAuthCredential == null)
        {
            throw new InvalidOperationException("OAuth connection credentials are missing.");
        }

        if (string.IsNullOrEmpty(_envConfig.Security.TokenEncryptionKey))
        {
            throw new InvalidOperationException("Token encryption key is not configured on server.");
        }

        var decryptedToken = await GetOrRefreshAccessTokenAsync(provider, cancellationToken);
        var httpClient = _httpClientFactory.CreateClient();
        
        var fetchedRepos = new List<SourceCodeRepository>();
        bool tokenRefreshed = false;

        if (string.Equals(provider.ProviderName, "github", StringComparison.OrdinalIgnoreCase))
        {
            int page = 1;
            bool hasMore = true;

            while (hasMore)
            {
                var request = new HttpRequestMessage(HttpMethod.Get, $"https://api.github.com/user/repos?per_page=100&page={page}");
                request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", decryptedToken);
                request.Headers.UserAgent.ParseAdd("CVerify-Core");

                var response = await httpClient.SendAsync(request, cancellationToken);
                if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized && !tokenRefreshed)
                {
                    _logger.LogWarning("GitHub API returned Unauthorized. Attempting reactive token refresh.");
                    try
                    {
                        decryptedToken = await RefreshTokenInternalAsync(provider, cancellationToken);
                        tokenRefreshed = true;
                        continue;
                    }
                    catch (Exception refreshEx)
                    {
                        _logger.LogError(refreshEx, "Reactive token refresh failed for GitHub provider.");
                    }
                }

                if (!response.IsSuccessStatusCode)
                {
                    var errContent = await response.Content.ReadAsStringAsync(cancellationToken);
                    throw new HttpRequestException($"GitHub API returned status {response.StatusCode}: {errContent}");
                }

                var responseJson = await response.Content.ReadAsStringAsync(cancellationToken);
                using var doc = JsonDocument.Parse(responseJson);

                if (doc.RootElement.ValueKind != JsonValueKind.Array || doc.RootElement.GetArrayLength() == 0)
                {
                    hasMore = false;
                    break;
                }

                foreach (var repoElement in doc.RootElement.EnumerateArray())
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

                    fetchedRepos.Add(new SourceCodeRepository
                    {
                        AuthProviderId = provider.Id,
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
                    });
                }

                if (doc.RootElement.GetArrayLength() < 100)
                {
                    hasMore = false;
                }
                else
                {
                    page++;
                }
            }
        }
        else if (string.Equals(provider.ProviderName, "gitlab", StringComparison.OrdinalIgnoreCase))
        {
            int page = 1;
            bool hasMore = true;

            while (hasMore)
            {
                var request = new HttpRequestMessage(HttpMethod.Get, $"https://gitlab.com/api/v4/projects?membership=true&per_page=100&page={page}");
                request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", decryptedToken);

                var response = await httpClient.SendAsync(request, cancellationToken);
                if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized && !tokenRefreshed)
                {
                    _logger.LogWarning("GitLab API returned Unauthorized. Attempting reactive token refresh.");
                    try
                    {
                        decryptedToken = await RefreshTokenInternalAsync(provider, cancellationToken);
                        tokenRefreshed = true;
                        continue;
                    }
                    catch (Exception refreshEx)
                    {
                        _logger.LogError(refreshEx, "Reactive token refresh failed for GitLab provider.");
                    }
                }

                if (!response.IsSuccessStatusCode)
                {
                    var errContent = await response.Content.ReadAsStringAsync(cancellationToken);
                    throw new HttpRequestException($"GitLab API returned status {response.StatusCode}: {errContent}");
                }

                var responseJson = await response.Content.ReadAsStringAsync(cancellationToken);
                using var doc = JsonDocument.Parse(responseJson);

                if (doc.RootElement.ValueKind != JsonValueKind.Array || doc.RootElement.GetArrayLength() == 0)
                {
                    hasMore = false;
                    break;
                }

                foreach (var projectElement in doc.RootElement.EnumerateArray())
                {
                    var extId = projectElement.GetProperty("id").GetInt64().ToString();
                    var name = projectElement.GetProperty("name").GetString() ?? "";
                    
                    var namespaceObj = projectElement.GetProperty("namespace");
                    var ownerLogin = namespaceObj.GetProperty("path").GetString() ?? "";
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

                    fetchedRepos.Add(new SourceCodeRepository
                    {
                        AuthProviderId = provider.Id,
                        ExternalRepositoryId = extId,
                        Name = name,
                        Owner = owner,
                        Description = description,
                        HtmlUrl = htmlUrl,
                        DefaultBranch = defaultBranch,
                        OwnerLogin = ownerLogin,
                        OwnerType = ownerType,
                        IsPrivate = isPrivate,
                        PrimaryLanguage = null, // Set to null for GitLab to prevent N+1 queries
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
                }

                if (doc.RootElement.GetArrayLength() < 100)
                {
                    hasMore = false;
                }
                else
                {
                    page++;
                }
            }
        }

        // Save fetched repositories to PostgreSQL database
        var externalIds = fetchedRepos.Select(r => r.ExternalRepositoryId).ToList();
        
        var existingRepos = await _context.SourceCodeRepositories
            .Where(r => r.AuthProviderId == provider.Id)
            .ToListAsync(cancellationToken);

        var existingMap = existingRepos.ToDictionary(r => r.ExternalRepositoryId);

        foreach (var fetched in fetchedRepos)
        {
            if (existingMap.TryGetValue(fetched.ExternalRepositoryId, out var existing))
            {
                // Update immutable provider metadata fields in-place
                existing.Name = fetched.Name;
                existing.Owner = fetched.Owner;
                existing.Description = fetched.Description;
                existing.HtmlUrl = fetched.HtmlUrl;
                existing.DefaultBranch = fetched.DefaultBranch;
                existing.OwnerLogin = fetched.OwnerLogin;
                existing.OwnerType = fetched.OwnerType;
                existing.IsPrivate = fetched.IsPrivate;
                existing.StarsCount = fetched.StarsCount;
                existing.ForksCount = fetched.ForksCount;
                existing.OpenIssuesCount = fetched.OpenIssuesCount;
                existing.WatchersCount = fetched.WatchersCount;
                existing.LastCommitAt = fetched.LastCommitAt;
                existing.LastUpdatedUtc = fetched.LastUpdatedUtc;
                existing.ArchivedExternally = fetched.ArchivedExternally;
                
                // Track accessibility and sync times
                existing.IsAccessible = true;
                existing.LastSeenAt = _timeProvider.GetUtcNow();
                existing.LastSyncedAt = _timeProvider.GetUtcNow();
            }
            else
            {
                // Insert new repository record
                fetched.Id = Guid.CreateVersion7();
                fetched.IsAccessible = true;
                fetched.IsEnabled = true;
                fetched.IsVerified = false;
                fetched.TrustScore = 0.0;
                fetched.LastSeenAt = _timeProvider.GetUtcNow();
                fetched.LastSyncedAt = _timeProvider.GetUtcNow();
                _context.SourceCodeRepositories.Add(fetched);
            }
        }

        // Handle soft deletion strategy:
        // Repositories previously synced for this connection that are no longer returned are marked IsAccessible = false
        var fetchedExtIds = new HashSet<string>(externalIds);
        foreach (var existing in existingRepos)
        {
            if (!fetchedExtIds.Contains(existing.ExternalRepositoryId))
            {
                existing.IsAccessible = false;
                existing.LastSyncedAt = _timeProvider.GetUtcNow();
            }
        }
    }
}
