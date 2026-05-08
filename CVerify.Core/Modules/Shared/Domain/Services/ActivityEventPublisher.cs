using System;
using System.Text.Json;
using System.Threading.Tasks;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Persistence;

namespace CVerify.API.Modules.Shared.Domain.Services;

public class ActivityEventPublisher : IActivityEventPublisher
{
    private readonly ApplicationDbContext _context;

    public ActivityEventPublisher(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<ActivityEvent> PublishAsync(
        string eventType,
        string resourceType,
        Guid? resourceId,
        Guid? organizationId,
        Guid? actorUserId,
        object? payload = null,
        Guid? correlationId = null,
        Guid? causationId = null,
        string visibility = "organization")
    {
        var activityEvent = new ActivityEvent
        {
            Id = Guid.CreateVersion7(),
            CorrelationId = correlationId ?? Guid.NewGuid(),
            CausationId = causationId,
            OrganizationId = organizationId,
            ActorUserId = actorUserId,
            EventType = eventType,
            ResourceType = resourceType,
            ResourceId = resourceId,
            Visibility = visibility,
            PayloadJson = payload != null ? JsonSerializer.Serialize(payload) : null,
            IsProjected = false,
            CreatedAt = DateTimeOffset.UtcNow
        };

        _context.ActivityEvents.Add(activityEvent);
        return await Task.FromResult(activityEvent);
    }
}
