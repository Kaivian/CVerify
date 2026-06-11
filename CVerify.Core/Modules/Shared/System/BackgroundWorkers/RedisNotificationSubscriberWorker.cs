using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;
using CVerify.API.Modules.Shared.Hubs;
using CVerify.API.Modules.Shared.Domain.Services;

namespace CVerify.API.Modules.Shared.System.BackgroundWorkers;

public class RedisNotificationSubscriberWorker : BackgroundService
{
    private readonly IConnectionMultiplexer _redis;
    private readonly IHubContext<NotificationHub> _hubContext;
    private readonly ILogger<RedisNotificationSubscriberWorker> _logger;
    private const string RedisChannelName = "cverify:notifications";

    public RedisNotificationSubscriberWorker(
        IConnectionMultiplexer redis,
        IHubContext<NotificationHub> hubContext,
        ILogger<RedisNotificationSubscriberWorker> logger)
    {
        _redis = redis;
        _hubContext = hubContext;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var subscriber = _redis.GetSubscriber();
        
        await subscriber.SubscribeAsync(RedisChannelName, async (channel, message) =>
        {
            try
            {
                var notificationMessage = JsonSerializer.Deserialize<RedisNotificationMessage>(message.ToString());
                if (notificationMessage != null)
                {
                    // Send notification to the specific user connection
                    await _hubContext.Clients.User(notificationMessage.UserId.ToString())
                        .SendAsync("ReceiveNotification", notificationMessage.PayloadJson, stoppingToken);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing Redis notification message.");
            }
        });

        // Keep the background service running
        while (!stoppingToken.IsCancellationRequested)
        {
            await Task.Delay(1000, stoppingToken);
        }
    }
}
