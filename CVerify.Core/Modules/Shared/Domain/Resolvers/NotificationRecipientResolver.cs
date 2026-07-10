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

        // Forum Recipient Resolution Rules
        if (activityEvent.EventType == ActivityEventTypes.ForumReplyCreated)
        {
            var reply = await _context.ForumReplies
                .Include(r => r.Topic)
                .FirstOrDefaultAsync(r => r.Id == activityEvent.ResourceId);

            if (reply != null)
            {
                // Notify topic author
                if (reply.Topic.AuthorId != activityEvent.ActorUserId)
                {
                    recipients.Add(reply.Topic.AuthorId);
                }

                // Notify parent reply author (if any)
                if (reply.ParentReplyId.HasValue)
                {
                    var parent = await _context.ForumReplies.FindAsync(reply.ParentReplyId.Value);
                    if (parent != null && parent.AuthorId != activityEvent.ActorUserId)
                    {
                        recipients.Add(parent.AuthorId);
                    }
                }

                // Notify followers
                var followers = await _context.ForumFollows
                    .Where(f => f.TopicId == reply.TopicId && f.UserId != activityEvent.ActorUserId)
                    .Select(f => f.UserId)
                    .ToListAsync();

                foreach (var fid in followers)
                {
                    recipients.Add(fid);
                }
            }
            return recipients.Where(r => r != Guid.Empty);
        }

        if (activityEvent.EventType == ActivityEventTypes.ForumAnswerAccepted)
        {
            var reply = await _context.ForumReplies.FindAsync(activityEvent.ResourceId);
            if (reply != null && reply.AuthorId != activityEvent.ActorUserId)
            {
                recipients.Add(reply.AuthorId);
            }
            return recipients.Where(r => r != Guid.Empty);
        }

        if (activityEvent.EventType == ActivityEventTypes.ForumTopicModerated)
        {
            var topic = await _context.ForumTopics.FindAsync(activityEvent.ResourceId);
            if (topic != null && topic.AuthorId != activityEvent.ActorUserId)
            {
                recipients.Add(topic.AuthorId);
            }
            return recipients.Where(r => r != Guid.Empty);
        }

        if (activityEvent.EventType == ActivityEventTypes.ForumContentReported)
        {
            var adminUserIds = await _context.RoleAssignments
                .Include(ra => ra.Role)
                .Where(ra => ra.Role.Name == "ADMIN" || ra.Role.Name == "MODERATOR")
                .Select(ra => ra.UserId)
                .ToListAsync();
            foreach (var id in adminUserIds)
            {
                recipients.Add(id);
            }
            return recipients.Where(r => r != Guid.Empty);
        }

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

        if (activityEvent.EventType == ActivityEventTypes.InvitationDiscovered)
        {
            var invite = await _context.OrganizationInvitations.FindAsync(activityEvent.ResourceId);
            if (invite != null)
            {
                var user = await _context.FindUserByVerifiedEmailAsync(invite.InviteeEmail);
                if (user != null)
                {
                    recipients.Add(user.Id);
                }
            }
            return recipients;
        }

        if (activityEvent.EventType == ActivityEventTypes.RepresentativeActivated ||
            activityEvent.EventType == ActivityEventTypes.RepresentativeAssigned)
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
