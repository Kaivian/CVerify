using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Modules.SourceCode.DTOs;

namespace CVerify.API.Modules.SourceCode.Services;

public interface IRepositoryAnalysisService
{
    Task<Guid> EnqueueAnalysisJobAsync(Guid userId, Guid repositoryId);
    Task<AnalysisJobDto?> GetJobStatusAsync(Guid userId, Guid jobId);
    Task<IEnumerable<AnalysisJobEventDto>> GetJobEventsAsync(Guid userId, Guid jobId);
    Task<string?> GetLatestReportAsync(Guid userId, Guid repositoryId);
    Task<bool> CancelJobAsync(Guid userId, Guid jobId);
    Task ExecuteAnalysisJobAsync(Guid jobId, CancellationToken cancellationToken);
    Task<bool> RetryTaskAsync(Guid userId, Guid jobId, Guid taskId);
    Task<IEnumerable<AnalysisTaskEventDto>> GetTaskEventsAsync(Guid userId, Guid jobId, Guid taskId);
    Task<string?> GetJobSnapshotAsync(Guid userId, Guid jobId);
    Task<bool> ResetRepositoryAnalysisAsync(Guid userId, Guid repositoryId, CancellationToken cancellationToken = default);
}
