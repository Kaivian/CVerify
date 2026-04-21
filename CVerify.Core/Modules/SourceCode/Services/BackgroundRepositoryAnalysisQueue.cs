using System;
using System.Threading.Tasks;
using StackExchange.Redis;

namespace CVerify.API.Modules.SourceCode.Services;

public class BackgroundRepositoryAnalysisQueue : IRepositoryAnalysisQueue
{
    private readonly IDatabase _db;
    private const string QueueKey = "repository:analysis:queue";

    public BackgroundRepositoryAnalysisQueue(IConnectionMultiplexer redis)
    {
        _db = redis.GetDatabase();
    }

    public async Task EnqueueJobAsync(Guid jobId)
    {
        await _db.ListLeftPushAsync(QueueKey, jobId.ToString());
    }

    public async Task<Guid?> DequeueJobAsync()
    {
        var value = await _db.ListRightPopAsync(QueueKey);
        if (value.IsNullOrEmpty)
        {
            return null;
        }

        if (Guid.TryParse(value.ToString(), out var jobId))
        {
            return jobId;
        }

        return null;
    }
}
