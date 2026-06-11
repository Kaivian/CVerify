using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Constants;
using CVerify.API.Modules.Shared.Domain.Services;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.Modules.Auth.Services;

public class WorkspaceMembershipService : IWorkspaceMembershipService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<WorkspaceMembershipService> _logger;
    private readonly TimeProvider _timeProvider;
    private readonly IIdentityStateResolver _identityStateResolver;
    private readonly IOrganizationBootstrapService _bootstrapService;
    private readonly IActivityEventPublisher _activityEventPublisher;

    public WorkspaceMembershipService(
        ApplicationDbContext context,
        ILogger<WorkspaceMembershipService> logger,
        TimeProvider timeProvider,
        IIdentityStateResolver identityStateResolver,
        IOrganizationBootstrapService bootstrapService,
        IActivityEventPublisher activityEventPublisher)
    {
        _context = context;
        _logger = logger;
        _timeProvider = timeProvider;
        _identityStateResolver = identityStateResolver;
        _bootstrapService = bootstrapService;
        _activityEventPublisher = activityEventPublisher;
    }

    private string NormalizeEmailPolicy(string email)
    {
        return email.Trim().ToLowerInvariant();
    }

    public async Task DiscoverPendingInvitationsAsync(Guid userId)
    {
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
        {
            _logger.LogWarning("DiscoverPendingInvitationsAsync: User {UserId} not found.", userId);
            return;
        }

        if (user.Status != Shared.Domain.Enums.UserStatus.ACTIVE)
        {
            _logger.LogInformation("DiscoverPendingInvitationsAsync: User {UserId} is not ACTIVE (Status: {Status}). Skipping discovery.", userId, user.Status);
            return;
        }

        var verifiedEmails = new List<string> { NormalizeEmailPolicy(user.Email) };
        if (user.LinkedEmails != null)
        {
            var linkedVerified = user.LinkedEmails
                .Where(le => le.IsVerified)
                .Select(le => NormalizeEmailPolicy(le.Email))
                .ToList();
            verifiedEmails.AddRange(linkedVerified);
        }
        verifiedEmails = verifiedEmails.Distinct(StringComparer.OrdinalIgnoreCase).ToList();

        var utcNow = _timeProvider.GetUtcNow();

        // 1. Discover Pending Representative Ownerships (Auto-provision ownership on registration)
        var pendingOwnerships = await _context.PendingOrganizationOwnerships
            .Where(po => po.ConsumedAt == null && po.ExpiresAt > utcNow && verifiedEmails.Contains(po.OwnerEmail))
            .ToListAsync();

        foreach (var po in pendingOwnerships)
        {
            po.ConsumedAt = utcNow;
            po.ConsumedByUserId = userId;
            po.DiscoveryNotifiedAt = utcNow;

            await BootstrapInitialAdminAsync(po.OwnerEmail, true);

            // Accept and consume matching OrganizationInvitation if exists
            var matchingInvite = await _context.OrganizationInvitations
                .FirstOrDefaultAsync(oi => oi.OrganizationId == po.OrganizationId && 
                                           oi.InviteeEmail == po.OwnerEmail && 
                                           oi.Status == "Pending");
            if (matchingInvite != null)
            {
                matchingInvite.Status = "Accepted";
                matchingInvite.AcceptedAt = utcNow;
                matchingInvite.ConsumedByUserId = userId;
            }
        }

        // 2. Discover Pending Organization Invitations
        var pendingInvitations = await _context.OrganizationInvitations
            .Where(oi => oi.Status == "Pending" && oi.ExpiresAt > utcNow && verifiedEmails.Contains(oi.InviteeEmail) && oi.DiscoveryNotifiedAt == null)
            .ToListAsync();

        foreach (var invitation in pendingInvitations)
        {
            invitation.DiscoveryNotifiedAt = utcNow;

            // Publish InvitationDiscovered event (which generates in-app notification)
            await _activityEventPublisher.PublishAsync(
                eventType: ActivityEventTypes.InvitationDiscovered,
                resourceType: "organization_invitation",
                resourceId: invitation.Id,
                organizationId: invitation.OrganizationId,
                actorUserId: invitation.InvitedByUserId,
                payload: new { inviteeEmail = invitation.InviteeEmail }
            );
        }

        await _context.SaveChangesAsync();

        foreach (var email in verifiedEmails)
        {
            await _identityStateResolver.InvalidateCacheAsync(email);
        }
    }

    public async Task BootstrapInitialAdminAsync(string email, bool isRegistrationActivation = false, CancellationToken cancellationToken = default)
    {
        var normalizedEmail = NormalizeEmailPolicy(email);
        var utcNow = _timeProvider.GetUtcNow();

        // Find the user to assign
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail, cancellationToken);
        if (user == null)
        {
            _logger.LogWarning("BootstrapInitialAdminAsync: User with email {Email} not found.", normalizedEmail);
            return;
        }

        if (user.Status != Shared.Domain.Enums.UserStatus.ACTIVE)
        {
            _logger.LogInformation("BootstrapInitialAdminAsync: User {UserId} is not ACTIVE (Status: {Status}). Skipping bootstrap.", user.Id, user.Status);
            return;
        }

        // Perform the atomic single-database UPDATE...RETURNING command
        var updatedOrgIds = await _context.Database.SqlQueryRaw<Guid>(
            "UPDATE organizations SET initial_admin_assigned_at = {0} WHERE email = {1} AND initial_admin_assigned_at IS NULL RETURNING id",
            utcNow, normalizedEmail
        ).ToListAsync(cancellationToken);

        if (!updatedOrgIds.Any())
        {
            return;
        }

        foreach (var orgId in updatedOrgIds)
        {
            // Seed default roles and assign Owner role to the creator in RBAC
            await _bootstrapService.BootstrapOrganizationAsync(orgId, user.Id, cancellationToken);

            // Create Organization Membership as OWNER if not exists
            var isOrgMember = await _context.OrganizationMemberships
                .AnyAsync(om => om.OrganizationId == orgId && om.UserId == user.Id, cancellationToken);

            if (!isOrgMember)
            {
                var orgMembership = new OrganizationMembership
                {
                    OrganizationId = orgId,
                    UserId = user.Id,
                    Role = "OWNER",
                    Status = "active",
                    JoinedAt = utcNow
                };
                _context.OrganizationMemberships.Add(orgMembership);
            }

            // Create Organization Authority if not exists
            var isOrgAuthority = await _context.OrganizationAuthorities
                .AnyAsync(oa => oa.OrganizationId == orgId && oa.UserId == user.Id, cancellationToken);

            if (!isOrgAuthority)
            {
                var authority = new OrganizationAuthority
                {
                    OrganizationId = orgId,
                    UserId = user.Id,
                    Role = "organization_owner",
                    JoinedAt = utcNow
                };
                _context.OrganizationAuthorities.Add(authority);
            }

            var workspaces = await _context.Workspaces
                .Where(w => w.OrganizationId == orgId && w.DeletedAt == null)
                .ToListAsync(cancellationToken);

            foreach (var ws in workspaces)
            {
                var isMember = await _context.WorkspaceMembers
                    .AnyAsync(wm => wm.WorkspaceId == ws.Id && wm.UserId == user.Id, cancellationToken);

                if (!isMember)
                {
                    var member = new WorkspaceMember
                    {
                        WorkspaceId = ws.Id,
                        UserId = user.Id,
                        Role = "workspace_admin",
                        JoinedAt = utcNow
                    };
                    _context.WorkspaceMembers.Add(member);
                }
            }

            // Publish RepresentativeAssigned / RepresentativeActivated event
            var eventType = isRegistrationActivation
                ? ActivityEventTypes.RepresentativeActivated
                : ActivityEventTypes.RepresentativeAssigned;

            await _activityEventPublisher.PublishAsync(
                eventType: eventType,
                resourceType: "organization",
                resourceId: orgId,
                organizationId: orgId,
                actorUserId: user.Id,
                payload: new { representativeEmail = normalizedEmail }
            );
        }

        await _context.SaveChangesAsync(cancellationToken);
        await _identityStateResolver.InvalidateCacheAsync(normalizedEmail);
        _logger.LogInformation("Bootstrapped initial workspace_admin for user {Email} in organizations {OrgIds}", normalizedEmail, string.Join(",", updatedOrgIds));
    }
}
