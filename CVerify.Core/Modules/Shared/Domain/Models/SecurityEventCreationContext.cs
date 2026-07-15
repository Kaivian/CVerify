using System;
using CVerify.API.Modules.Shared.Domain.Enums;

namespace CVerify.API.Modules.Shared.Domain.Models;

public class SecurityEventCreationContext
{
    public string EventType { get; set; } = null!;
    public SecurityEventCategory Category { get; set; }
    public string Description { get; set; } = null!;
    public Guid? ActorUserId { get; set; }
    public Guid? TargetUserId { get; set; }
    public Guid? OrganizationId { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public string? Device { get; set; }
    public string? Browser { get; set; }
    public object? Details { get; set; }
    public SecuritySeverity? OverrideSeverity { get; set; }
    public Guid CorrelationId { get; set; }
    public Guid? SessionId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
