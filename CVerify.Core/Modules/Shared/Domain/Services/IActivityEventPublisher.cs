using System;
using System.Threading.Tasks;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Shared.Domain.Services;

public interface IActivityEventPublisher
{
    Task<ActivityEvent> PublishAsync(
        string eventType,
        string resourceType,
        Guid? resourceId,
        Guid? organizationId,
        Guid? actorUserId,
        object? payload = null,
        Guid? correlationId = null,
        Guid? causationId = null,
        string visibility = "organization");
}
