using System.ComponentModel.DataAnnotations;

namespace CVerify.API.Modules.Shared.System.DTOs;

public class UpdateNotificationPreferenceRequest
{
    [Required]
    public string NotificationType { get; set; } = null!;

    [Required]
    public string Channel { get; set; } = null!; // "in_app", "email", "push"

    [Required]
    public bool IsEnabled { get; set; }
}
