using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using StackExchange.Redis;

namespace CVerify.API.Modules.Shared.System.Pipelines;

public class QueueDiscoveryService : IQueueDiscoveryService
{
    private readonly IConnectionMultiplexer _redis;

    public QueueDiscoveryService(IConnectionMultiplexer redis)
    {
        _redis = redis;
    }

    public async Task<IEnumerable<string>> DiscoverActiveQueuesAsync(CancellationToken cancellationToken = default)
    {
        var endpoints = _redis.GetEndPoints();
        var server = _redis.GetServer(endpoints[0]);

        // Scan keys in Redis
        var keys = server.Keys(pattern: "pipeline:queue:*").Select(k => k.ToString()).ToList();

        var queues = keys
            .Select(k => k.Replace("pipeline:queue:", ""))
            .Where(q => !q.Contains(":paused:") && !q.StartsWith("paused:")) // Excludepaused state keys
            .Distinct()
            .ToList();

        // Ensure CVerify default queues are always registered
        var defaultQueues = new[] { "git", "static", "aggregation", "ai" };
        foreach (var def in defaultQueues)
        {
            if (!queues.Contains(def))
            {
                queues.Add(def);
            }
        }

        return await Task.FromResult(queues);
    }

    public async Task<long> GetQueueLengthAsync(string queueName, CancellationToken cancellationToken = default)
    {
        var db = _redis.GetDatabase();
        var key = $"pipeline:queue:{queueName}";
        return await db.ListLengthAsync(key);
    }

    public async Task<bool> IsQueuePausedAsync(string queueName, CancellationToken cancellationToken = default)
    {
        var db = _redis.GetDatabase();
        var key = $"pipeline:queue:paused:{queueName}";
        return await db.KeyExistsAsync(key);
    }

    public async Task PauseQueueAsync(string queueName, CancellationToken cancellationToken = default)
    {
        var db = _redis.GetDatabase();
        var key = $"pipeline:queue:paused:{queueName}";
        await db.StringSetAsync(key, "true");
    }

    public async Task ResumeQueueAsync(string queueName, CancellationToken cancellationToken = default)
    {
        var db = _redis.GetDatabase();
        var key = $"pipeline:queue:paused:{queueName}";
        await db.KeyDeleteAsync(key);
    }

    public async Task ClearQueueAsync(string queueName, CancellationToken cancellationToken = default)
    {
        var db = _redis.GetDatabase();
        var key = $"pipeline:queue:{queueName}";
        await db.KeyDeleteAsync(key);
    }
}
