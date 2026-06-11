using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Resolvers;
using Microsoft.Extensions.Logging;

namespace CVerify.API.Modules.Shared.Domain.Services;

public class NotificationDeliveryService : INotificationDeliveryService
{
    private readonly IEnumerable<INotificationChannel> _channels;
    private readonly INotificationRecipientResolver _recipientResolver;
    private readonly ILogger<NotificationDeliveryService> _logger;

    public NotificationDeliveryService(
        IEnumerable<INotificationChannel> channels,
        INotificationRecipientResolver recipientResolver,
        ILogger<NotificationDeliveryService> logger)
    {
        _channels = channels;
        _recipientResolver = recipientResolver;
        _logger = logger;
    }

    public async Task RouteAndDeliverAsync(ActivityEvent activityEvent)
    {
        try
        {
            var recipientIds = await _recipientResolver.ResolveRecipientsAsync(activityEvent);
            foreach (var recipientId in recipientIds)
            {
                foreach (var channel in _channels)
                {
                    try
                    {
                        await channel.DeliverAsync(activityEvent, recipientId);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error delivering event {EventId} via channel {ChannelName} to recipient {RecipientId}",
                            activityEvent.Id, channel.Name, recipientId);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error routing and delivering activity event {EventId}", activityEvent.Id);
        }
    }
}
