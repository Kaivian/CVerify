using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.Shared.Domain.Services;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Constants;

namespace CVerify.API.Modules.Shared.System.BackgroundWorkers;

public class ActivityEventProjectionWorker : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<ActivityEventProjectionWorker> _logger;

    public ActivityEventProjectionWorker(
        IServiceProvider serviceProvider,
        ILogger<ActivityEventProjectionWorker> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessPendingEventsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing pending activity events in background worker.");
            }

            await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
        }
    }

    private async Task ProcessPendingEventsAsync(CancellationToken stoppingToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var deliveryService = scope.ServiceProvider.GetRequiredService<INotificationDeliveryService>();

        var pendingEvents = await context.ActivityEvents
            .Where(ae => !ae.IsProjected)
            .OrderBy(ae => ae.CreatedAt)
            .Take(50)
            .ToListAsync(stoppingToken);

        if (!pendingEvents.Any())
        {
            return;
        }

        _logger.LogInformation("Processing {Count} pending activity events for projection.", pendingEvents.Count);

        foreach (var activityEvent in pendingEvents)
        {
            await deliveryService.RouteAndDeliverAsync(activityEvent);
            await ProjectToAuditLogAsync(context, activityEvent, stoppingToken);
            activityEvent.IsProjected = true;
        }

        await context.SaveChangesAsync(stoppingToken);
    }

    private async Task ProjectToAuditLogAsync(ApplicationDbContext context, ActivityEvent ae, CancellationToken cancellationToken)
    {
        // Only project events that belong to organizations (workspace activity logs)
        if (!ae.OrganizationId.HasValue)
        {
            return;
        }

        string eventTypeStr = ae.EventType;
        string description = "";
        Guid? targetUserId = null;
        string? detailsJson = ae.PayloadJson;

        string inviteeEmail = "";
        bool isResend = false;
        if (!string.IsNullOrEmpty(ae.PayloadJson))
        {
            try
            {
                using var doc = global::System.Text.Json.JsonDocument.Parse(ae.PayloadJson);
                var root = doc.RootElement;
                if (root.TryGetProperty("inviteeEmail", out var emailProp))
                {
                    inviteeEmail = emailProp.GetString() ?? "";
                }
                else if (root.TryGetProperty("email", out var emailProp2))
                {
                    inviteeEmail = emailProp2.GetString() ?? "";
                }

                if (root.TryGetProperty("isResend", out var resendProp))
                {
                    isResend = resendProp.GetBoolean();
                }
            }
            catch
            {
                // Ignore parsing errors
            }
        }

        switch (ae.EventType)
        {
            case ActivityEventTypes.InvitationCreated:
                eventTypeStr = isResend ? "INVITATION_RESENT" : "MEMBER_INVITED";
                description = isResend ? $"Invitation resent to {inviteeEmail}." : $"Member {inviteeEmail} invited.";
                break;

            case ActivityEventTypes.InvitationResent:
                eventTypeStr = "INVITATION_RESENT";
                description = $"Invitation resent to {inviteeEmail}.";
                break;

            case ActivityEventTypes.InvitationCancelled:
                eventTypeStr = "INVITATION_CANCELLED";
                description = $"Invitation cancelled for {inviteeEmail}.";
                break;

            case ActivityEventTypes.InvitationAccepted:
                eventTypeStr = "MEMBER_JOINED";
                description = $"Member joined organization: {inviteeEmail}.";
                targetUserId = ae.ActorUserId;
                break;

            case ActivityEventTypes.InvitationDeclined:
                eventTypeStr = "INVITATION_DECLINED";
                description = $"Invitation declined by {inviteeEmail}.";
                targetUserId = ae.ActorUserId;
                break;

            case ActivityEventTypes.MemberSuspended:
                eventTypeStr = "MEMBER_SUSPENDED";
                targetUserId = ae.ResourceId;
                description = $"Member {targetUserId} suspended.";
                if (targetUserId.HasValue)
                {
                    var user = await context.Users.FindAsync(new object[] { targetUserId.Value }, cancellationToken);
                    if (user != null)
                    {
                        description = $"Member {user.Email} suspended.";
                    }
                }
                break;

            case ActivityEventTypes.MemberActivated:
                eventTypeStr = "MEMBER_ACTIVATED";
                targetUserId = ae.ResourceId;
                description = $"Member {targetUserId} activated.";
                if (targetUserId.HasValue)
                {
                    var user = await context.Users.FindAsync(new object[] { targetUserId.Value }, cancellationToken);
                    if (user != null)
                    {
                        description = $"Member {user.Email} activated.";
                    }
                }
                break;

            case ActivityEventTypes.MemberRemoved:
                eventTypeStr = "MEMBER_REMOVED";
                targetUserId = ae.ResourceId;
                description = $"Member {targetUserId} removed from organization.";
                if (targetUserId.HasValue)
                {
                    var user = await context.Users.FindAsync(new object[] { targetUserId.Value }, cancellationToken);
                    if (user != null)
                    {
                        description = $"Member {user.Email} removed from organization.";
                    }
                }
                break;

            case ActivityEventTypes.EnterpriseRequestSubmitted:
                eventTypeStr = "ENTERPRISE_REQUEST_SUBMITTED";
                description = "Enterprise request submitted.";
                break;

            case ActivityEventTypes.EnterpriseRequestClaimed:
                eventTypeStr = "ENTERPRISE_REQUEST_CLAIMED";
                description = "Enterprise request claimed by reviewer.";
                break;

            case ActivityEventTypes.EnterpriseRequestReleased:
                eventTypeStr = "ENTERPRISE_REQUEST_RELEASED";
                description = "Enterprise request released by reviewer.";
                break;

            case ActivityEventTypes.EnterpriseRequestResolved:
                eventTypeStr = "ENTERPRISE_REQUEST_RESOLVED";
                description = "Enterprise request resolved.";
                break;

            case ActivityEventTypes.OrganizationSuspended:
                eventTypeStr = "ORGANIZATION_SUSPENDED";
                description = "Organization suspended.";
                break;

            case ActivityEventTypes.OrganizationReactivated:
                eventTypeStr = "ORGANIZATION_REACTIVATED";
                description = "Organization reactivated.";
                break;

            default:
                // Not a workspace membership event to project
                return;
        }

        var auditLog = new AuditLog
        {
            Id = Guid.CreateVersion7(),
            OrganizationId = ae.OrganizationId,
            ActorUserId = ae.ActorUserId,
            UserId = ae.ActorUserId,
            EventType = eventTypeStr,
            Description = description,
            TargetUserId = targetUserId,
            ScopeType = ae.ResourceType?.ToUpperInvariant() ?? "ORGANIZATION",
            ScopeId = ae.ResourceId ?? ae.OrganizationId,
            Category = (ae.EventType.StartsWith("ENTERPRISE_") || ae.EventType.StartsWith("ORGANIZATION_"))
                ? CVerify.API.Modules.Shared.Domain.Enums.AuditCategory.VerificationOperations
                : CVerify.API.Modules.Shared.Domain.Enums.AuditCategory.IdentityAndAccess,
            DetailsJson = detailsJson,
            CreatedAt = ae.CreatedAt
        };

        context.AuditLogs.Add(auditLog);
    }
}
