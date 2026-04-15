using System;
using System.Text.Json;
using CVerify.API.Modules.Shared.Email.Entities;
using CVerify.API.Modules.Shared.Email.Services;

namespace CVerify.API.Modules.Shared.Persistence;

/// <summary>
/// Provides extension methods for transactional outbox message creation and auditing.
/// </summary>
public static class OutboxExtensions
{
    /// <summary>
    /// Serializes the payload, adds the outbox message, and records the serialization stage trace.
    /// </summary>
    public static void AddAndAuditOutboxMessage(
        this ApplicationDbContext context,
        string type,
        string recipient,
        string correlationId,
        object payload,
        DateTimeOffset? createdAt = null)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentException.ThrowIfNullOrWhiteSpace(type);
        ArgumentException.ThrowIfNullOrWhiteSpace(recipient);
        ArgumentException.ThrowIfNullOrWhiteSpace(correlationId);
        ArgumentNullException.ThrowIfNull(payload);

        var json = JsonSerializer.Serialize(payload);
        
        var message = new OutboxMessage
        {
            Id = Guid.CreateVersion7(),
            Type = type,
            Payload = json,
            CreatedAt = createdAt ?? DateTimeOffset.UtcNow
        };

        context.OutboxMessages.Add(message);
        
        // Log the Serialization stage for delivery auditing
        StructuredEmailAuditLogger.LogDeliveryStage("Serialization", message.Id.ToString(), type, recipient, correlationId);
    }
}
