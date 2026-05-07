using System;
using System.Threading;
using System.Threading.Tasks;
using StackExchange.Redis;

namespace CVerify.API.Pipelines.Shared.Queue;

public class PipelineQueue : IPipelineQueue
{
    private readonly IDatabase _db;

    public PipelineQueue(IConnectionMultiplexer redis)
    {
        _db = redis.GetDatabase();
    }

    public async Task EnqueueTaskAsync(string queueName, Guid taskId, CancellationToken cancellationToken = default)
    {
        var key = $"pipeline:queue:{queueName}";
        await _db.ListLeftPushAsync(key, taskId.ToString());
    }

    public async Task<Guid?> DequeueTaskAsync(string queueName, CancellationToken cancellationToken = default)
    {
        var key = $"pipeline:queue:{queueName}";
        var value = await _db.ListRightPopAsync(key);
        if (value.IsNullOrEmpty)
        {
            return null;
        }

        if (Guid.TryParse(value.ToString(), out var taskId))
        {
            return taskId;
        }

        return null;
    }
}
