using System;
using System.Threading;
using System.Threading.Tasks;

namespace CVerify.API.Modules.Shared.System.Pipelines;

public interface IPipelineOrchestrator
{
    string PipelineType { get; }

    Task<bool> CancelAsync(Guid executionId, CancellationToken cancellationToken = default);
    Task<bool> RetryAsync(Guid executionId, Guid? taskId = null, CancellationToken cancellationToken = default);
    Task<bool> PauseAsync(Guid executionId, CancellationToken cancellationToken = default);
    Task<bool> ResumeAsync(Guid executionId, CancellationToken cancellationToken = default);
}
