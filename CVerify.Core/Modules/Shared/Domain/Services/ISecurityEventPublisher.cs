using System;
using System.Threading.Tasks;
using CVerify.API.Modules.Shared.Domain.Enums;

namespace CVerify.API.Modules.Shared.Domain.Services;

public interface ISecurityEventPublisher
{
    /// <summary>
    /// Publishes a security event to the processing pipeline.
    /// </summary>
    Task PublishAsync(
        string eventType,
        SecurityEventCategory category,
        string description,
        Guid? actorUserId = null,
        Guid? targetUserId = null,
        Guid? organizationId = null,
        object? details = null,
        SecuritySeverity? overrideSeverity = null);
}
