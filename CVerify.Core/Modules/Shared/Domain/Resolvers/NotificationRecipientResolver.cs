using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Constants;
using CVerify.API.Modules.Shared.Persistence;

namespace CVerify.API.Modules.Shared.Domain.Resolvers;

public class NotificationRecipientResolver : INotificationRecipientResolver
{
    private readonly ApplicationDbContext _context;

    public NotificationRecipientResolver(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<Guid>> ResolveRecipientsAsync(ActivityEvent activityEvent)
    {
        var recipients = new HashSet<Guid>();

        // 1. Direct Actor / Subject Routing (Security Alerts go to Actor)
        if (activityEvent.EventType == ActivityEventTypes.PasswordChanged ||
            activityEvent.EventType == ActivityEventTypes.IpVerified)
        {
            if (activityEvent.ActorUserId.HasValue)
            {
                recipients.Add(activityEvent.ActorUserId.Value);
            }
            return recipients;
        }

        // 2. Organization / Workspace Scoped Routing
        if (activityEvent.OrganizationId.HasValue)
        {
            var orgId = activityEvent.OrganizationId.Value;

            // Fetch all active organization membership user IDs
            var memberIds = await _context.OrganizationMemberships
                .Where(om => om.OrganizationId == orgId && om.Status == "active")
                .Select(om => om.UserId)
                .ToListAsync();

            // Notify owners, organization owners, and workspace admins
            var targetRoles = new[] { "owner", "organization_owner", "workspace_admin" };
            
            var adminUserIds = await _context.RoleAssignments
                .Include(ra => ra.Role)
                .Where(ra => memberIds.Contains(ra.UserId) &&
                             ((ra.ScopeType == "ORGANIZATION" && ra.ScopeId == orgId) ||
                              (ra.ScopeType == "WORKSPACE" && activityEvent.ResourceType == "workspace" && ra.ScopeId == activityEvent.ResourceId)) &&
                             targetRoles.Contains(ra.Role.Name.ToLower()))
                .Select(ra => ra.UserId)
                .ToListAsync();

            foreach (var id in adminUserIds)
            {
                recipients.Add(id);
            }
        }

        // 3. Affected Target Member Routing (e.g. user being promoted/suspended)
        if ((activityEvent.EventType == ActivityEventTypes.RoleAssigned ||
             activityEvent.EventType == ActivityEventTypes.RoleUpdated ||
             activityEvent.EventType == ActivityEventTypes.MemberSuspended ||
             activityEvent.EventType == ActivityEventTypes.MemberActivated) &&
            activityEvent.ResourceId.HasValue)
        {
            recipients.Add(activityEvent.ResourceId.Value);
        }

        return recipients.Where(r => r != Guid.Empty);
    }
}
