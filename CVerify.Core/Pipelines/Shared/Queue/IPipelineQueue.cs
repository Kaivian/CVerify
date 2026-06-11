using System;
using System.Threading;
using System.Threading.Tasks;

namespace CVerify.API.Pipelines.Shared.Queue;

public interface IPipelineQueue
{
    Task EnqueueTaskAsync(string queueName, Guid taskId, CancellationToken cancellationToken = default);
    Task<Guid?> DequeueTaskAsync(string queueName, CancellationToken cancellationToken = default);
}
