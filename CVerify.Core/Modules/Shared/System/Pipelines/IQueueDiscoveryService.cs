using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace CVerify.API.Modules.Shared.System.Pipelines;

public interface IQueueDiscoveryService
{
    Task<IEnumerable<string>> DiscoverActiveQueuesAsync(CancellationToken cancellationToken = default);
    Task<long> GetQueueLengthAsync(string queueName, CancellationToken cancellationToken = default);
    Task<bool> IsQueuePausedAsync(string queueName, CancellationToken cancellationToken = default);
    Task PauseQueueAsync(string queueName, CancellationToken cancellationToken = default);
    Task ResumeQueueAsync(string queueName, CancellationToken cancellationToken = default);
    Task ClearQueueAsync(string queueName, CancellationToken cancellationToken = default);
}
