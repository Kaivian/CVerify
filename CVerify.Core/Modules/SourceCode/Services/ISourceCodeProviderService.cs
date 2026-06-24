using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Modules.SourceCode.DTOs;
using CVerify.API.Modules.Shared.System.DTOs;

namespace CVerify.API.Modules.SourceCode.Services;

public class RepositorySyncJobStatus
{
    public Guid JobId { get; set; }
    public Guid UserId { get; set; }
    public Guid? AuthProviderId { get; set; }
    public string Status { get; set; } = "Pending"; // Pending, Syncing, Completed, Failed
    public double Progress { get; set; } = 0.0;
    public string? Error { get; set; }
    public int MaxPages { get; set; }
    public int PageSize { get; set; }
    public int TotalSyncedCount { get; set; }
    public bool IsPartial { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public interface ISourceCodeProviderService
{
    Task<IEnumerable<SourceCodeProviderDto>> GetProvidersAsync(Guid userId);
    Task<PaginatedResultDto<RepositoryDto>> GetRepositoriesAsync(
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
        int pageSize);
    Task<IEnumerable<UserRepositoryIdentityDto>> GetUserRepositoriesForIndexingAsync(Guid userId, CancellationToken cancellationToken);
    Task<IEnumerable<ExternalOrganizationResponseDto>> GetOrganizationsAsync(Guid userId);
    Task<IEnumerable<string>> GetDistinctCategoriesAsync(Guid userId);
    Task<Guid> EnqueueSyncJobAsync(Guid userId, Guid? providerId);
    Task<RepositorySyncJobStatus?> GetSyncStatusAsync(Guid userId, Guid jobId);
    Task ExecuteSyncJobAsync(RepositorySyncJob job, CancellationToken cancellationToken);
}
