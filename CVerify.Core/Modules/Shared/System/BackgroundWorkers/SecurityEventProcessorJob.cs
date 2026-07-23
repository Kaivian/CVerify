using System;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;
using CVerify.API.Modules.Shared.Domain.Constants;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Domain.Models;
using CVerify.API.Modules.Shared.Domain.Services;
using CVerify.API.Modules.Shared.Persistence;

namespace CVerify.API.Modules.Shared.System.BackgroundWorkers;

public class SecurityEventProcessorJob : BackgroundService
{
    private readonly SecurityEventChannel _channel;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly INotificationDispatcher _notificationDispatcher;
    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<SecurityEventProcessorJob> _logger;

    public SecurityEventProcessorJob(
        SecurityEventChannel channel,
        IServiceScopeFactory scopeFactory,
        INotificationDispatcher notificationDispatcher,
        IConnectionMultiplexer redis,
        ILogger<SecurityEventProcessorJob> logger)
    {
        _channel = channel;
        _scopeFactory = scopeFactory;
        _notificationDispatcher = notificationDispatcher;
        _redis = redis;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Security Event Processor Job started.");

        try
        {
            await foreach (var context in _channel.Reader.ReadAllAsync(stoppingToken))
            {
                try
                {
                    await ProcessEventAsync(context, stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error processing security event from channel. EventType: {EventType}", context.EventType);
                }
            }
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("Security Event Processor Job is stopping.");
        }
        catch (Exception ex)
        {
            _logger.LogCritical(ex, "Critical failure in Security Event Processor Job.");
        }
    }

    private async Task ProcessEventAsync(SecurityEventCreationContext context, CancellationToken stoppingToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var detectionEngine = scope.ServiceProvider.GetRequiredService<ISecurityDetectionEngine>();

        // 1. Run detection rules evaluation
        var ruleResult = await detectionEngine.ProcessAndEvaluateAsync(context);

        SecurityEvent securityEvent;

        if (ruleResult.DuplicateEventId.HasValue)
        {
            // Update existing unacknowledged duplicate
            var duplicate = await dbContext.SecurityEvents.FindAsync(ruleResult.DuplicateEventId.Value);
            if (duplicate != null)
            {
                duplicate.OccurrenceCount++;
                duplicate.UpdatedAt = DateTimeOffset.UtcNow;

                // Append details
                if (context.Details != null)
                {
                    duplicate.DetailsJson = MergeDetailsJson(duplicate.DetailsJson, context.Details);
                }

                await dbContext.SaveChangesAsync(stoppingToken);
                _logger.LogInformation("Deduplicated and aggregated security event ID {EventId} (Type: {EventType})", duplicate.Id, duplicate.EventType);

                // Direct return since we updated existing row
                return;
            }
        }

        // Create new SecurityEvent record
        var severityStr = ruleResult.AutoEscalatedSeverity.ToString();
        var riskScore = CalculateRiskScore(context.EventType, ruleResult.AutoEscalatedSeverity);

        securityEvent = new SecurityEvent
        {
            Id = Guid.CreateVersion7(),
            EventType = context.EventType,
            Category = context.Category.ToString(),
            Severity = severityStr,
            Status = "New",
            RiskScore = riskScore,
            ConfidenceScore = 95, // Default confidence metric
            Description = context.Description,
            ActorUserId = context.ActorUserId,
            TargetUserId = context.TargetUserId,
            OrganizationId = context.OrganizationId,
            IpAddress = context.IpAddress,
            CountryCode = ruleResult.GeoLocation?.CountryCode,
            Device = context.Device,
            Browser = context.Browser,
            SessionId = context.SessionId,
            DetailsJson = context.Details != null ? JsonSerializer.Serialize(context.Details) : null,
            CorrelationId = context.CorrelationId,
            OccurrenceCount = 1,
            CreatedAt = context.CreatedAt,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        // 2. Automated Incident Creation
        if (ruleResult.ShouldCreateIncident)
        {
            var incident = new SecurityIncident
            {
                Id = Guid.CreateVersion7(),
                Title = $"Security Incident: {context.EventType.Replace("_", " ")}",
                Description = $"System raised automatically from Correlation {context.CorrelationId}. Detail: {context.Description}",
                Status = "Open",
                Severity = severityStr,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };

            dbContext.SecurityIncidents.Add(incident);
            securityEvent.IncidentId = incident.Id;
        }

        dbContext.SecurityEvents.Add(securityEvent);
        await dbContext.SaveChangesAsync(stoppingToken);

        // 3. Automated Containment Trigger for Critical Events
        if (ruleResult.AutoEscalatedSeverity == SecuritySeverity.Critical)
        {
            await TriggerAutomatedContainmentAsync(context, dbContext, stoppingToken);
        }

        // 4. Real-time Notification Dispatch to Admin Users
        if (ruleResult.AutoEscalatedSeverity == SecuritySeverity.High || ruleResult.AutoEscalatedSeverity == SecuritySeverity.Critical)
        {
            await DispatchAdminNotificationAsync(securityEvent, dbContext);
        }
    }

    private static int CalculateRiskScore(string eventType, SecuritySeverity severity)
    {
        int baseScore = severity switch
        {
            SecuritySeverity.Critical => 90,
            SecuritySeverity.High => 70,
            SecuritySeverity.Medium => 40,
            SecuritySeverity.Low => 15,
            _ => 5
        };

        // Modify slightly based on specific high-risk triggers
        if (eventType == SecurityEventTypes.AuthTokenAbuse || eventType == SecurityEventTypes.ApiInjectionAttempt)
        {
            baseScore = Math.Min(100, baseScore + 10);
        }

        return baseScore;
    }

    private static string? MergeDetailsJson(string? existingJson, object newDetails)
    {
        try
        {
            var newSerialized = JsonSerializer.Serialize(newDetails);
            if (string.IsNullOrEmpty(existingJson))
            {
                return $"[{newSerialized}]";
            }

            using var doc = JsonDocument.Parse(existingJson);
            if (doc.RootElement.ValueKind == JsonValueKind.Array)
            {
                var list = doc.RootElement.EnumerateArray().Select(x => x.ToString()).ToList();
                list.Add(newSerialized);
                return $"[{string.Join(",", list)}]";
            }

            return $"[{existingJson},{newSerialized}]";
        }
        catch
        {
            return existingJson;
        }
    }

    private async Task TriggerAutomatedContainmentAsync(
        SecurityEventCreationContext context,
        ApplicationDbContext dbContext,
        CancellationToken stoppingToken)
    {
        _logger.LogWarning("CRITICAL SECURITY EVENT - Automated Containment triggered. Correlation: {CorrelationId}", context.CorrelationId);

        // A. User Lockout & Session version bump
        if (context.ActorUserId.HasValue)
        {
            var user = await dbContext.Users.FindAsync(context.ActorUserId.Value);
            if (user != null && user.Status == UserStatus.ACTIVE)
            {
                user.TransitionTo(UserStatus.SUSPENDED);
                user.SessionVersion++; // Invalidates active JWT cookies globally

                // Clear user auth cache state
                var cacheKey = $"auth:user:{user.Id}:session_version";
                await _redis.GetDatabase().KeyDeleteAsync(cacheKey);

                await dbContext.SaveChangesAsync(stoppingToken);
                _logger.LogCritical("Containment Action Successful: User ID {UserId} was SUSPENDED due to critical threat signals.", user.Id);
            }
        }

        // B. IP Temporary Blocking
        if (!string.IsNullOrEmpty(context.IpAddress) && context.IpAddress != "127.0.0.1" && context.IpAddress != "::1")
        {
            var ipBanKey = $"sec:ip_ban:{context.IpAddress}";
            // Ban the offending IP address in Redis for 30 minutes
            await _redis.GetDatabase().StringSetAsync(ipBanKey, "banned", TimeSpan.FromMinutes(30));
            _logger.LogCritical("Containment Action Successful: IP Address {IpAddress} banned from routing APIs for 30 minutes.", context.IpAddress);
        }
    }

    private async Task DispatchAdminNotificationAsync(SecurityEvent securityEvent, ApplicationDbContext dbContext)
    {
        try
        {
            // Fetch all active Administrators
            var adminUserIds = await dbContext.AdminMembers
                .Where(am => am.Status.ToUpper() == "ACTIVE")
                .Select(am => am.UserId)
                .ToListAsync();

            var notificationPayload = new
            {
                Id = securityEvent.Id,
                UserId = Guid.Empty, // Broadcast-scoped payload
                NotificationType = "SECURITY_ALERT",
                ResourceType = "SecurityEvent",
                ResourceId = securityEvent.Id,
                Payload = new
                {
                    Count = 1,
                    Actors = new[] { new { Id = securityEvent.ActorUserId ?? Guid.Empty, FullName = "Security Event Engine" } }
                },
                IsRead = false,
                CreatedAt = DateTimeOffset.UtcNow.ToString("o")
            };

            foreach (var adminId in adminUserIds)
            {
                await _notificationDispatcher.PublishNotificationAsync(adminId, notificationPayload);
            }

            _logger.LogInformation("Dispatched real-time SignalR alerts to {AdminCount} active admin connections.", adminUserIds.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to dispatch admin real-time SignalR notifications.");
        }
    }
}
