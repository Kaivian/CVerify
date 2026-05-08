using System;
using System.Text.Json;
using System.Threading.Tasks;
using StackExchange.Redis;

namespace CVerify.API.Modules.Shared.Domain.Services;

public class RedisNotificationDispatcher : INotificationDispatcher
{
    private readonly IConnectionMultiplexer _redis;
    private const string RedisChannelName = "cverify:notifications";

    public RedisNotificationDispatcher(IConnectionMultiplexer redis)
    {
        _redis = redis;
    }

    public async Task PublishNotificationAsync(Guid userId, object notificationDto)
    {
        var db = _redis.GetDatabase();
        var message = new RedisNotificationMessage
        {
            UserId = userId,
            PayloadJson = JsonSerializer.Serialize(notificationDto)
        };
        await _redis.GetSubscriber().PublishAsync(RedisChannelName, JsonSerializer.Serialize(message));
    }
}

public class RedisNotificationMessage
{
    public Guid UserId { get; set; }
    public string PayloadJson { get; set; } = null!;
}
