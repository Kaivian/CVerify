using System;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Constants;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.System.DTOs;

namespace CVerify.API.Modules.Shared.Domain.Services;

public class InAppNotificationChannel : INotificationChannel
{
    private readonly ApplicationDbContext _context;
    private readonly INotificationDispatcher _dispatcher;

    public string Name => "in_app";

    public InAppNotificationChannel(ApplicationDbContext context, INotificationDispatcher dispatcher)
    {
        _context = context;
        _dispatcher = dispatcher;
    }

    public async Task DeliverAsync(ActivityEvent activityEvent, Guid recipientUserId)
    {
        // 1. Check user preferences
        var isEnabled = await _context.NotificationPreferences
            .Where(np => np.UserId == recipientUserId &&
                        np.NotificationType == activityEvent.EventType &&
                        np.Channel == "in_app")
            .Select(np => (bool?)np.IsEnabled)
            .FirstOrDefaultAsync();

        if (isEnabled == false)
        {
            return;
        }

        // 2. Resolve aggregate key
        var aggregateKey = GetAggregateKey(activityEvent);
        InAppNotification? notification = null;

        if (!string.IsNullOrEmpty(aggregateKey))
        {
            // Check for similar unread notification in the last 4 hours
            var fourHoursAgo = DateTimeOffset.UtcNow.AddHours(-4);
            notification = await _context.InAppNotifications
                .Where(n => n.UserId == recipientUserId &&
                            n.AggregateKey == aggregateKey &&
                            !n.IsRead &&
                            n.DeletedAt == null &&
                            n.CreatedAt >= fourHoursAgo)
                .OrderByDescending(n => n.CreatedAt)
                .FirstOrDefaultAsync();
        }

        if (notification != null)
        {
            // Update existing (aggregate)
            var payload = string.IsNullOrEmpty(notification.PayloadJson)
                ? new NotificationPayload()
                : JsonSerializer.Deserialize<NotificationPayload>(notification.PayloadJson) ?? new NotificationPayload();

            if (activityEvent.ActorUserId.HasValue)
            {
                var actorUser = await _context.Users.FindAsync(activityEvent.ActorUserId.Value);
                if (actorUser != null)
                {
                    if (!payload.Actors.Any(a => a.Id == actorUser.Id))
                    {
                        payload.Actors.Add(new ActorInfo { Id = actorUser.Id, FullName = actorUser.FullName });
                    }
                }
            }
            payload.Count++;

            notification.PayloadJson = JsonSerializer.Serialize(payload);
            notification.IsAggregated = true;
            notification.ActivityEventId = activityEvent.Id; // Point to latest event
            notification.CreatedAt = DateTimeOffset.UtcNow; // Slide window

            _context.InAppNotifications.Update(notification);
        }
        else
        {
            // Create new
            var payload = new NotificationPayload();
            if (activityEvent.ActorUserId.HasValue)
            {
                var actorUser = await _context.Users.FindAsync(activityEvent.ActorUserId.Value);
                if (actorUser != null)
                {
                    payload.Actors.Add(new ActorInfo { Id = actorUser.Id, FullName = actorUser.FullName });
                }
            }
            payload.Count = 1;

            notification = new InAppNotification
            {
                Id = Guid.CreateVersion7(),
                UserId = recipientUserId,
                ActivityEventId = activityEvent.Id,
                NotificationType = activityEvent.EventType,
                ResourceType = activityEvent.ResourceType,
                ResourceId = activityEvent.ResourceId,
                PayloadJson = JsonSerializer.Serialize(payload),
                IsRead = false,
                IsAggregated = false,
                AggregateKey = aggregateKey,
                CreatedAt = DateTimeOffset.UtcNow
            };

            _context.InAppNotifications.Add(notification);
        }

        // Save changes to database before publishing
        await _context.SaveChangesAsync();

        // 3. Publish via broker for real-time delivery
        var dto = NotificationDto.FromEntity(notification);
        await _dispatcher.PublishNotificationAsync(recipientUserId, dto);
    }

    private string? GetAggregateKey(ActivityEvent activityEvent)
    {
        if (activityEvent.EventType == ActivityEventTypes.MemberJoined ||
            activityEvent.EventType == ActivityEventTypes.MemberLeft ||
            activityEvent.EventType == ActivityEventTypes.RoleAssigned ||
            activityEvent.EventType == ActivityEventTypes.VerificationStarted ||
            activityEvent.EventType == ActivityEventTypes.VerificationCompleted)
        {
            return $"{activityEvent.EventType}:{activityEvent.OrganizationId}:{activityEvent.ResourceId}";
        }
        return null;
    }
}
