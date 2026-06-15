using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace CVerify.API.Modules.Shared.System.Services;

public interface ICandidateRepositoryProvider
{
    Task<DateTimeOffset> GetLastRepositoryAnalysisAtAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<bool> HasCompletedRepositoriesAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<List<string>> GetCompletedAnalysisJobIdsAsync(Guid userId, CancellationToken cancellationToken = default);
}
