using System;
using System.Threading.Tasks;
using StackExchange.Redis;

namespace CVerify.API.Modules.Profiles.Services;

public class BackgroundCandidateAssessmentQueue : ICandidateAssessmentQueue
{
    private readonly IDatabase _db;
    private const string QueueKey = "candidate:assessment:queue";

    public BackgroundCandidateAssessmentQueue(IConnectionMultiplexer redis)
    {
        _db = redis.GetDatabase();
    }

    public async Task EnqueueAssessmentAsync(Guid assessmentId)
    {
        await _db.ListLeftPushAsync(QueueKey, assessmentId.ToString());
    }

    public async Task<Guid?> DequeueAssessmentAsync()
    {
        var value = await _db.ListRightPopAsync(QueueKey);
        if (value.IsNullOrEmpty)
        {
            return null;
        }

        if (Guid.TryParse(value.ToString(), out var assessmentId))
        {
            return assessmentId;
        }

        return null;
    }
}
