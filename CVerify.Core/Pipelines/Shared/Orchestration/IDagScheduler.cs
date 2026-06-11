using System;
using System.Threading;
using System.Threading.Tasks;

namespace CVerify.API.Pipelines.Shared.Orchestration;

public interface IDagScheduler
{
    Task ScheduleNextTasksAsync(Guid jobId, CancellationToken cancellationToken = default);
}
