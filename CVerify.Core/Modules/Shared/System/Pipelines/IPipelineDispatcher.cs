using System;
using System.Threading;
using System.Threading.Tasks;

namespace CVerify.API.Modules.Shared.System.Pipelines;

public interface IPipelineDispatcher
{
    Task<bool> CancelAsync(string pipelineType, Guid executionId, CancellationToken cancellationToken = default);
    Task<bool> RetryAsync(string pipelineType, Guid executionId, Guid? taskId = null, CancellationToken cancellationToken = default);
    Task<bool> PauseAsync(string pipelineType, Guid executionId, CancellationToken cancellationToken = default);
    Task<bool> ResumeAsync(string pipelineType, Guid executionId, CancellationToken cancellationToken = default);
}
