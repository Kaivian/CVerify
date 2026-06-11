using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.Modules.Auth.Services;

public class WorkspaceMembershipService : IWorkspaceMembershipService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<WorkspaceMembershipService> _logger;
    private readonly TimeProvider _timeProvider;
    private readonly IIdentityStateResolver _identityStateResolver;

    public WorkspaceMembershipService(
        ApplicationDbContext context,
        ILogger<WorkspaceMembershipService> logger,
        TimeProvider timeProvider,
        IIdentityStateResolver identityStateResolver)
    {
        _context = context;
        _logger = logger;
        _timeProvider = timeProvider;
        _identityStateResolver = identityStateResolver;
    }

    private string NormalizeEmailPolicy(string email)
    {
        return email.Trim().ToLowerInvariant();
    }

    public async Task ClaimPendingRelationshipsAsync(Guid userId)
    {
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
        {
            _logger.LogWarning("ClaimPendingRelationshipsAsync: User {UserId} not found.", userId);
            return;
        }

        if (user.Status != Shared.Domain.Enums.UserStatus.ACTIVE)
        {
            _logger.LogInformation("ClaimPendingRelationshipsAsync: User {UserId} is not ACTIVE (Status: {Status}). Skipping claim.", userId, user.Status);
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

        var pendingInvitations = await _context.WorkspaceInvitations
            .Where(wi => wi.ConsumedAt == null && wi.ExpiresAt > utcNow && verifiedEmails.Contains(wi.InviteeEmail))
            .ToListAsync();

        if (!pendingInvitations.Any())
        {
            return;
        }

        var hasActiveTransaction = _context.Database.CurrentTransaction != null;
        var transaction = hasActiveTransaction ? null : await _context.Database.BeginTransactionAsync();
        try
        {
            var workspaceIds = pendingInvitations.Select(wi => wi.WorkspaceId).Distinct().ToList();
            var workspaces = await _context.Workspaces
                .Where(w => workspaceIds.Contains(w.Id))
                .ToListAsync();

            foreach (var invitation in pendingInvitations)
            {
                var ws = workspaces.FirstOrDefault(w => w.Id == invitation.WorkspaceId);
                if (ws != null)
                {
                    var isOrgMember = await _context.OrganizationMemberships
                        .AnyAsync(om => om.OrganizationId == ws.OrganizationId && om.UserId == userId);

                    if (!isOrgMember)
                    {
                        var orgMembership = new OrganizationMembership
                        {
                            OrganizationId = ws.OrganizationId,
                            UserId = userId,
                            Role = "MEMBER",
                            Status = "active",
                            JoinedAt = utcNow
                        };
                        _context.OrganizationMemberships.Add(orgMembership);
                    }
                }

                var isMember = await _context.WorkspaceMembers
                    .AnyAsync(wm => wm.WorkspaceId == invitation.WorkspaceId && wm.UserId == userId);

                if (!isMember)
                {
                    var member = new WorkspaceMember
                    {
                        WorkspaceId = invitation.WorkspaceId,
                        UserId = userId,
                        Role = invitation.Role,
                        JoinedAt = utcNow
                    };
                    _context.WorkspaceMembers.Add(member);
                }

                invitation.ConsumedAt = utcNow;
                invitation.ConsumedByUserId = userId;
            }

            await _context.SaveChangesAsync();

            if (transaction != null)
            {
                await transaction.CommitAsync();
            }

            foreach (var email in verifiedEmails)
            {
                await _identityStateResolver.InvalidateCacheAsync(email);
            }
        }
        catch (Exception ex)
        {
            if (transaction != null)
            {
                await transaction.RollbackAsync();
            }
            _logger.LogError(ex, "Failed to claim pending relationships for user {UserId}", userId);
            throw;
        }
    }

    public async Task BootstrapInitialAdminAsync(string email, CancellationToken cancellationToken = default)
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
        }

        await _context.SaveChangesAsync(cancellationToken);
        await _identityStateResolver.InvalidateCacheAsync(normalizedEmail);
        _logger.LogInformation("Bootstrapped initial workspace_admin for user {Email} in organizations {OrgIds}", normalizedEmail, string.Join(",", updatedOrgIds));
    }
}
