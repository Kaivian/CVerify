using System;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Shared.System.DTOs;

public class NotificationDto
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid? ActivityEventId { get; set; }
    public string NotificationType { get; set; } = null!;
    public string ResourceType { get; set; } = null!;
    public Guid? ResourceId { get; set; }
    public NotificationPayload? Payload { get; set; }
    public bool IsRead { get; set; }
    public bool IsAggregated { get; set; }
    public string? AggregateKey { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public static NotificationDto FromEntity(InAppNotification entity)
    {
        NotificationPayload? payload = null;
        if (!string.IsNullOrEmpty(entity.PayloadJson))
        {
            try
            {
                payload = global::System.Text.Json.JsonSerializer.Deserialize<NotificationPayload>(entity.PayloadJson);
            }
            catch
            {
                // Fallback or ignore
            }
        }

        return new NotificationDto
        {
            Id = entity.Id,
            UserId = entity.UserId,
            ActivityEventId = entity.ActivityEventId,
            NotificationType = entity.NotificationType,
            ResourceType = entity.ResourceType,
            ResourceId = entity.ResourceId,
            Payload = payload,
            IsRead = entity.IsRead,
            IsAggregated = entity.IsAggregated,
            AggregateKey = entity.AggregateKey,
            CreatedAt = entity.CreatedAt
        };
    }
}
