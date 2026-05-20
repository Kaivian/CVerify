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
using CVerify.API.Modules.Shared.System.DTOs;
using CVerify.API.Modules.SourceCode.Clients;
using CVerify.API.Modules.Profiles.Entities;
using CVerify.API.Modules.Profiles.Services;

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
    private readonly IEnumerable<ISourceCodeClient> _clients;
    private readonly ICvRepositoryIndexer _cvRepositoryIndexer;

    public SourceCodeProviderService(
        ApplicationDbContext context,
        ICacheService cacheService,
        IRepositorySyncQueue syncQueue,
        EnvConfiguration envConfig,
        IHttpClientFactory httpClientFactory,
        ILogger<SourceCodeProviderService> logger,
        TimeProvider timeProvider,
        IEnumerable<ISourceCodeClient> clients,
        ICvRepositoryIndexer cvRepositoryIndexer)
    {
        _context = context;
        _cacheService = cacheService;
        _syncQueue = syncQueue;
        _envConfig = envConfig;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _timeProvider = timeProvider;
        _clients = clients;
        _cvRepositoryIndexer = cvRepositoryIndexer;
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
        string? category, 
        string? ownerType,
        Guid? organizationId,
        string? mode,
        int page, 
        int pageSize)
    {
        // Auto-heal/backfill: mark repositories as verified if they have a completed analysis report
        // but are currently marked as not verified due to a parsing discrepancy.
        var unverifiedWithReports = await _context.SourceCodeRepositories
            .Where(r => !r.IsVerified && r.AuthProvider.UserId == userId)
            .Join(_context.AnalysisReports,
                r => r.Id,
                rep => rep.RepositoryId,
                (r, rep) => new { Repository = r, Report = rep })
            .ToListAsync();

        if (unverifiedWithReports.Any())
        {
            foreach (var item in unverifiedWithReports)
            {
                try
                {
                    using var reportDoc = JsonDocument.Parse(item.Report.ReportData);
                    JsonElement confidenceProp = default;
                    bool hasConfidence = false;

                    if (reportDoc.RootElement.TryGetProperty("ai_conclusions", out var aiConclusionsProp) &&
                        aiConclusionsProp.TryGetProperty("trust", out var trustProp) &&
                        trustProp.TryGetProperty("confidence", out confidenceProp))
                    {
                        hasConfidence = true;
                    }
                    else if (reportDoc.RootElement.TryGetProperty("trust", out var rootTrustProp) &&
                             rootTrustProp.TryGetProperty("confidence", out confidenceProp))
                    {
                        hasConfidence = true;
                    }

                    if (hasConfidence)
                    {
                        var confidence = confidenceProp.GetDouble();
                        item.Repository.IsVerified = confidence >= 50.0;
                        item.Repository.TrustScore = confidence / 100.0;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to parse report data during auto-heal for repository {RepositoryId}", item.Repository.Id);
                }
            }
            await _context.SaveChangesAsync();
        }

        var query = _context.SourceCodeRepositories
            .Include(r => r.AuthProvider)
            .Where(r => r.AuthProvider.UserId == userId && r.AuthProvider.DeletedAt == null && r.IsAccessible);

        if (string.Equals(mode, "cv_linked", StringComparison.OrdinalIgnoreCase))
        {
            var cvLinkedRepoIds = _context.CvRepositoryMappings
                .Where(m => m.UserId == userId)
                .Select(m => m.SourceCodeRepositoryId);
            query = query.Where(r => cvLinkedRepoIds.Contains(r.Id));
        }

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

        if (!string.IsNullOrWhiteSpace(category) && !string.Equals(category, "all", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(r => r.Classification != null && EF.Functions.ILike(r.Classification, category));
        }

        if (!string.IsNullOrWhiteSpace(ownerType) && !string.Equals(ownerType, "all", StringComparison.OrdinalIgnoreCase))
        {
            if (string.Equals(ownerType, "personal", StringComparison.OrdinalIgnoreCase) || 
                string.Equals(ownerType, "user", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(r => EF.Functions.ILike(r.OwnerType, "user"));
            }
            else if (string.Equals(ownerType, "organization", StringComparison.OrdinalIgnoreCase) || 
                     string.Equals(ownerType, "org", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(r => EF.Functions.ILike(r.OwnerType, "organization") || 
                                         EF.Functions.ILike(r.OwnerType, "group"));
            }
        }

        if (organizationId.HasValue)
        {
            query = query.Where(r => r.ExternalOrganizationId == organizationId.Value);
        }

        // Apply Sorting:
        // Priority 1: Completed
        // Priority 2: Pending
        // Priority 3: Others
        var orderedQuery = query
            .OrderByDescending(r => r.LatestAnalysisStatus == "Completed")
            .ThenByDescending(r => r.LatestAnalysisStatus == "Pending");

        query = sort?.ToLowerInvariant() switch
        {
            "stars" => orderedQuery.ThenByDescending(r => r.StarsCount),
            "name_asc" => orderedQuery.ThenBy(r => r.Name),
            "name_desc" => orderedQuery.ThenByDescending(r => r.Name),
            "updated" => orderedQuery.ThenByDescending(r => r.LastUpdatedUtc),
            _ => orderedQuery.ThenByDescending(r => r.LastUpdatedUtc) // default
        };

        var totalCount = await query.CountAsync();
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new RepositoryDto(
                r.Id,
                r.AuthProviderId,
                r.ExternalOrganizationId,
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
                r.Classification,
                r.AuthenticityType,
                r.LatestRiskScore,
                r.LatestRiskLevel,
                r.LatestAnalysisStatus,
                r.LatestAnalysisCompletedAtUtc,
                r.LatestRiskFactorsJson,
                r.CreatedAtUtc,
                r.LastSyncedAt
            ))
            .ToListAsync();

        return new PaginatedResultDto<RepositoryDto>(items, totalCount, page, pageSize);
    }

    public async Task<IEnumerable<ExternalOrganizationResponseDto>> GetOrganizationsAsync(Guid userId)
    {
        return await _context.ExternalOrganizations
            .Where(eo => eo.AuthProvider.UserId == userId && eo.AuthProvider.DeletedAt == null && eo.IsActive)
            .Select(eo => new ExternalOrganizationResponseDto(
                eo.Id,
                eo.AuthProviderId,
                eo.ExternalId,
                eo.Name,
                eo.Login,
                eo.Type,
                eo.AvatarUrl,
                eo.HtmlUrl,
                eo.Description,
                eo.IsActive
            ))
            .ToListAsync();
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
            MaxPages = 10,
            PageSize = 100,
            TotalSyncedCount = 0,
            IsPartial = false,
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
                    .FirstOrDefaultAsync(ap => ap.Id == job.AuthProviderId.Value && ap.UserId == job.UserId && ap.DeletedAt == null, cancellationToken);
                
                providersToSync = matched != null ? new List<AuthProvider> { matched } : new List<AuthProvider>();
            }
            else
            {
                providersToSync = await _context.AuthProviders
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
                    var (syncedCount, isPartial) = await SyncProviderRepositoriesAsync(provider, status.MaxPages, status.PageSize, cancellationToken);
                    
                    status.TotalSyncedCount += syncedCount;
                    if (isPartial)
                    {
                        status.IsPartial = true;
                    }

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

            // Run CV repository indexing as a post-processing step right before completing the job
            try
            {
                _logger.LogInformation("Running CV repository indexing as a post-processing step for user {UserId}", job.UserId);
                await _cvRepositoryIndexer.IndexUserCvRepositoriesAsync(job.UserId, cancellationToken);
            }
            catch (Exception indexerEx)
            {
                _logger.LogError(indexerEx, "Failed to run CV repository indexing post-sync for user {UserId}", job.UserId);
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
        if (provider.ExpiresAt.HasValue && 
            provider.ExpiresAt.Value - _timeProvider.GetUtcNow() < TimeSpan.FromMinutes(5))
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

        if (string.IsNullOrEmpty(provider.EncryptedAccessToken))
        {
            throw new InvalidOperationException("OAuth connection credentials are missing.");
        }

        return EncryptionHelper.Decrypt(provider.EncryptedAccessToken, _envConfig.Security.TokenEncryptionKey);
    }

    private async Task<string> RefreshTokenInternalAsync(AuthProvider provider, CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(_envConfig.Security.TokenEncryptionKey))
        {
            throw new InvalidOperationException("Token encryption key is not configured on server.");
        }

        if (string.IsNullOrEmpty(provider.EncryptedRefreshToken))
        {
            throw new InvalidOperationException("OAuth refresh token is missing. Re-authorization is required.");
        }

        var client = _clients.FirstOrDefault(c => string.Equals(c.ProviderName, provider.ProviderName, StringComparison.OrdinalIgnoreCase));
        if (client == null)
        {
            throw new NotSupportedException($"Token refresh is not supported for provider '{provider.ProviderName}'.");
        }

        var decryptedRefreshToken = EncryptionHelper.Decrypt(provider.EncryptedRefreshToken, _envConfig.Security.TokenEncryptionKey);

        TokenRefreshResult refreshResult;
        try
        {
            refreshResult = await client.RefreshTokenAsync(decryptedRefreshToken, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Token refresh failed for provider {ProviderName}.", provider.ProviderName);
            
            provider.RefreshFailureCount++;
            provider.SyncStatus = "Failed";
            provider.SyncError = $"Token refresh failed: {ex.Message}. Please re-connect account.";
            await _context.SaveChangesAsync(cancellationToken);
            throw;
        }

        var encryptedAccess = EncryptionHelper.Encrypt(refreshResult.AccessToken, _envConfig.Security.TokenEncryptionKey);
        provider.EncryptedAccessToken = encryptedAccess;

        if (!string.IsNullOrEmpty(refreshResult.RefreshToken))
        {
            provider.EncryptedRefreshToken = EncryptionHelper.Encrypt(refreshResult.RefreshToken, _envConfig.Security.TokenEncryptionKey);
        }

        if (refreshResult.ExpiresInSeconds.HasValue)
        {
            provider.ExpiresAt = _timeProvider.GetUtcNow().AddSeconds(refreshResult.ExpiresInSeconds.Value);
        }
        else
        {
            provider.ExpiresAt = null;
        }

        provider.TokenUpdatedAt = _timeProvider.GetUtcNow();
        provider.LastSuccessfulRefreshAt = _timeProvider.GetUtcNow();
        provider.RefreshFailureCount = 0;

        await _context.SaveChangesAsync(cancellationToken);

        return refreshResult.AccessToken;
    }

    private async Task<(int syncedCount, bool isPartial)> SyncProviderRepositoriesAsync(
        AuthProvider provider,
        int maxPages,
        int pageSize,
        CancellationToken cancellationToken)
    {
        var decryptedToken = await GetOrRefreshAccessTokenAsync(provider, cancellationToken);
        
        var client = _clients.FirstOrDefault(c => string.Equals(c.ProviderName, provider.ProviderName, StringComparison.OrdinalIgnoreCase));
        if (client == null)
        {
            throw new NotSupportedException($"Sync is not supported for provider '{provider.ProviderName}'.");
        }

        var allRepos = new List<SourceCodeRepository>();
        var allOrgs = new List<ExternalOrganizationDto>();
        bool isPartial = false;

        for (int page = 1; page <= maxPages; page++)
        {
            SyncResult syncResult;
            try
            {
                syncResult = await client.SyncRepositoriesAsync(decryptedToken, page, pageSize, cancellationToken);
            }
            catch (Exception ex) when (ex.Message.Contains("Unauthorized", StringComparison.OrdinalIgnoreCase) || ex.Message.Contains("401"))
            {
                _logger.LogWarning("API returned Unauthorized. Attempting reactive token refresh.");
                try
                {
                    decryptedToken = await RefreshTokenInternalAsync(provider, cancellationToken);
                    syncResult = await client.SyncRepositoriesAsync(decryptedToken, page, pageSize, cancellationToken);
                }
                catch (Exception refreshEx)
                {
                    _logger.LogError(refreshEx, "Reactive token refresh failed for provider {ProviderName}.", provider.ProviderName);
                    throw;
                }
            }

            if (!string.IsNullOrEmpty(syncResult.SyncError))
            {
                throw new InvalidOperationException($"Provider synchronization failed on page {page}: {syncResult.SyncError}");
            }

            if (syncResult.Repositories == null || !syncResult.Repositories.Any())
            {
                break;
            }

            allRepos.AddRange(syncResult.Repositories);
            if (syncResult.Organizations != null)
            {
                allOrgs.AddRange(syncResult.Organizations);
            }

            if (syncResult.Repositories.Count < pageSize)
            {
                break;
            }

            if (page == maxPages)
            {
                isPartial = true;
            }
        }

        // 1. Process Organizations
        var existingOrgs = await _context.ExternalOrganizations
            .Where(eo => eo.AuthProviderId == provider.Id)
            .ToListAsync(cancellationToken);

        var existingOrgsMap = existingOrgs.ToDictionary(eo => eo.ExternalId);
        var activeOrgsList = new List<ExternalOrganization>();

        // Deduplicate fetched organizations
        var uniqueOrgs = allOrgs
            .GroupBy(o => o.ExternalId)
            .Select(g => g.First())
            .ToList();

        foreach (var orgDto in uniqueOrgs)
        {
            if (existingOrgsMap.TryGetValue(orgDto.ExternalId, out var existingOrg))
            {
                existingOrg.Name = orgDto.Name;
                existingOrg.Login = orgDto.Login;
                existingOrg.AvatarUrl = orgDto.AvatarUrl;
                existingOrg.HtmlUrl = orgDto.HtmlUrl;
                existingOrg.Description = orgDto.Description;
                existingOrg.IsActive = true;
                existingOrg.LastSyncedAt = _timeProvider.GetUtcNow();
                activeOrgsList.Add(existingOrg);
            }
            else
            {
                var newOrg = new ExternalOrganization
                {
                    Id = Guid.CreateVersion7(),
                    AuthProviderId = provider.Id,
                    ExternalId = orgDto.ExternalId,
                    Name = orgDto.Name,
                    Login = orgDto.Login,
                    Type = provider.ProviderName.ToLowerInvariant(),
                    AvatarUrl = orgDto.AvatarUrl,
                    HtmlUrl = orgDto.HtmlUrl,
                    Description = orgDto.Description,
                    IsActive = true,
                    LastSyncedAt = _timeProvider.GetUtcNow()
                };
                _context.ExternalOrganizations.Add(newOrg);
                activeOrgsList.Add(newOrg);
            }
        }

        // Soft delete/deactivate organizations not returned
        var activeOrgsExtIds = new HashSet<string>(uniqueOrgs.Select(o => o.ExternalId));
        foreach (var org in existingOrgs)
        {
            if (!activeOrgsExtIds.Contains(org.ExternalId))
            {
                org.IsActive = false;
                org.LastSyncedAt = _timeProvider.GetUtcNow();
            }
        }

        // Save organizations so that we have their IDs to link to repositories
        await _context.SaveChangesAsync(cancellationToken);

        // Map organizations by Login for fast lookup when linking repositories
        var orgsByLogin = activeOrgsList.ToDictionary(o => o.Login, StringComparer.OrdinalIgnoreCase);

        // 2. Process Repositories
        var existingRepos = await _context.SourceCodeRepositories
            .Where(r => r.AuthProviderId == provider.Id)
            .ToListAsync(cancellationToken);

        var existingReposMap = existingRepos.ToDictionary(r => r.ExternalRepositoryId);
        var externalIds = new List<string>();

        // Deduplicate fetched repositories by ExternalRepositoryId to avoid unique key constraint violations
        var uniqueFetchedRepos = allRepos
            .GroupBy(r => r.ExternalRepositoryId)
            .Select(g => g.First())
            .ToList();

        foreach (var fetched in uniqueFetchedRepos)
        {
            externalIds.Add(fetched.ExternalRepositoryId);

            // Resolve organization linkage if owner type is organization/group
            Guid? orgId = null;
            if (fetched.OwnerType != null && 
                (string.Equals(fetched.OwnerType, "organization", StringComparison.OrdinalIgnoreCase) || 
                 string.Equals(fetched.OwnerType, "group", StringComparison.OrdinalIgnoreCase)))
            {
                if (orgsByLogin.TryGetValue(fetched.OwnerLogin ?? "", out var org))
                {
                    orgId = org.Id;
                }
            }

            if (existingReposMap.TryGetValue(fetched.ExternalRepositoryId, out var existing))
            {
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
                existing.ExternalOrganizationId = orgId;
                
                existing.IsAccessible = true;
                existing.LastSeenAt = _timeProvider.GetUtcNow();
                existing.LastSyncedAt = _timeProvider.GetUtcNow();
            }
            else
            {
                fetched.Id = Guid.CreateVersion7();
                fetched.AuthProviderId = provider.Id;
                fetched.ExternalOrganizationId = orgId;
                fetched.IsAccessible = true;
                fetched.IsEnabled = true;
                fetched.IsVerified = false;
                fetched.TrustScore = 0.0;
                fetched.LastSeenAt = _timeProvider.GetUtcNow();
                fetched.LastSyncedAt = _timeProvider.GetUtcNow();
                _context.SourceCodeRepositories.Add(fetched);
            }
        }

        // Soft delete repositories not returned in this sync run
        var fetchedExtIds = new HashSet<string>(externalIds);
        foreach (var existing in existingRepos)
        {
            if (!fetchedExtIds.Contains(existing.ExternalRepositoryId))
            {
                existing.IsAccessible = false;
                existing.LastSyncedAt = _timeProvider.GetUtcNow();
            }
        }

        await _context.SaveChangesAsync(cancellationToken);

        return (uniqueFetchedRepos.Count, isPartial);
    }


    public async Task<IEnumerable<string>> GetDistinctCategoriesAsync(Guid userId)
    {
        return await _context.SourceCodeRepositories
            .Where(r => r.AuthProvider.UserId == userId && r.AuthProvider.DeletedAt == null && r.Classification != null && r.Classification != "" && r.IsAccessible)
            .Select(r => r.Classification!)
            .Distinct()
            .OrderBy(c => c)
            .ToListAsync();
    }
}
