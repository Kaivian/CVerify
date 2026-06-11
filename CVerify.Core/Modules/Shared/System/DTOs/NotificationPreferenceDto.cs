using System;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Shared.System.DTOs;

public class NotificationPreferenceDto
{
    public Guid Id { get; set; }
    public string NotificationType { get; set; } = null!;
    public string Channel { get; set; } = null!;
    public bool IsEnabled { get; set; }

    public static NotificationPreferenceDto FromEntity(NotificationPreference entity)
    {
        return new NotificationPreferenceDto
        {
            Id = entity.Id,
            NotificationType = entity.NotificationType,
            Channel = entity.Channel,
            IsEnabled = entity.IsEnabled
        };
    }
}
