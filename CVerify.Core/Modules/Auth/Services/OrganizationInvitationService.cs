using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.Auth.DTOs;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Exceptions;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.System.Services;
using CVerify.API.Modules.Shared.Email.Services;

namespace CVerify.API.Modules.Auth.Services;

public class OrganizationInvitationService : IOrganizationInvitationService
{
    private readonly ApplicationDbContext _context;
    private readonly TimeProvider _timeProvider;
    private readonly ICacheService _cacheService;
    private readonly IEmailService _emailService;
    private readonly ILogger<OrganizationInvitationService> _logger;

    public OrganizationInvitationService(
        ApplicationDbContext context,
        TimeProvider timeProvider,
        ICacheService cacheService,
        IEmailService emailService,
        ILogger<OrganizationInvitationService> logger)
    {
        _context = context;
        _timeProvider = timeProvider;
        _cacheService = cacheService;
        _emailService = emailService;
        _logger = logger;
    }

    private string NormalizeEmail(string email)
    {
        return email.Trim().ToLowerInvariant();
    }

    private string ComputeSha256(string token)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    public async Task InviteMembersAsync(Guid orgId, Guid actorUserId, CreateInvitationsDto dto, CancellationToken cancellationToken)
    {
        var org = await _context.Organizations
            .FirstOrDefaultAsync(o => o.Id == orgId && o.DeletedAt == null, cancellationToken);

        if (org == null)
        {
            throw new ValidationException("Organization not found.");
        }

        var utcNow = _timeProvider.GetUtcNow();
        var expiresAt = utcNow.AddDays(7);

        foreach (var invitee in dto.Invitees)
        {
            var normalizedEmail = NormalizeEmail(invitee.Email);

            // Check if user is already a member
            var isMember = await _context.OrganizationMemberships
                .AnyAsync(om => om.OrganizationId == orgId && om.User.Email == normalizedEmail && om.Status == "active", cancellationToken);

            if (isMember)
            {
                throw new ValidationException($"User with email {invitee.Email} is already a member of this organization.");
            }

            // Revoke any existing pending invitations for this email in the organization
            var existingPending = await _context.OrganizationInvitations
                .Where(oi => oi.OrganizationId == orgId && oi.InviteeEmail == normalizedEmail && oi.Status == "Pending")
                .ToListAsync(cancellationToken);

            foreach (var invite in existingPending)
            {
                invite.Status = "Cancelled";
            }

            // Generate secure random token
            var rawToken = Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N");
            var tokenHash = ComputeSha256(rawToken);

            var invitation = new OrganizationInvitation
            {
                Id = Guid.CreateVersion7(),
                OrganizationId = orgId,
                InviteeEmail = normalizedEmail,
                TokenHash = tokenHash,
                InvitedByUserId = actorUserId,
                Status = "Pending",
                CreatedAt = utcNow,
                ExpiresAt = expiresAt
            };

            _context.OrganizationInvitations.Add(invitation);

            // Pre-assign roles and scopes
            foreach (var roleDto in invitee.Roles)
            {
                var roleExists = await _context.Roles
                    .AnyAsync(r => r.Id == roleDto.RoleId && r.TenantId == orgId && r.Domain == "TENANT" && r.IsActive, cancellationToken);

                if (!roleExists)
                {
                    throw new ValidationException($"Selected business role {roleDto.RoleId} is invalid or inactive.");
                }

                var invitationRole = new OrganizationInvitationRole
                {
                    Id = Guid.CreateVersion7(),
                    InvitationId = invitation.Id,
                    RoleId = roleDto.RoleId,
                    ScopeType = roleDto.ScopeType.Trim().ToUpperInvariant(),
                    ScopeId = roleDto.ScopeId
                };

                _context.OrganizationInvitationRoles.Add(invitationRole);
            }

            // Log Audit Event
            var actor = await _context.Users.FindAsync(new object[] { actorUserId }, cancellationToken);
            var auditLog = new AuditLog
            {
                Id = Guid.CreateVersion7(),
                OrganizationId = orgId,
                ActorUserId = actorUserId,
                UserId = actorUserId,
                EventType = "MEMBER_INVITED",
                Description = $"Member {normalizedEmail} invited.",
                TargetRoleName = invitee.Roles.FirstOrDefault() != null 
                    ? (await _context.Roles.FindAsync(new object[] { invitee.Roles.First().RoleId }, cancellationToken))?.DisplayName ?? "Multiple"
                    : "No Roles Assigned",
                TargetUserId = null,
                ScopeType = "ORGANIZATION",
                ScopeId = orgId,
                DetailsJson = System.Text.Json.JsonSerializer.Serialize(new { inviteeEmail = normalizedEmail, rolesCount = invitee.Roles.Count }),
                CreatedAt = utcNow
            };
            _context.AuditLogs.Add(auditLog);

            // Send Email (Enqueue or Send directly)
            var onboardingUrl = $"https://cverify.com/invitations/accept?token={rawToken}";
            var emailBody = $"Hi there,\n\nYou have been invited to join {org.Name} on CVerify.\n\nTo accept this invitation and configure your account, please click the link below:\n{onboardingUrl}\n\nThis invitation will expire on {expiresAt:MMMM dd, yyyy}.";

            await _emailService.SendSecurityAlertEmailAsync(
                normalizedEmail,
                $"Invitation to join {org.Name}",
                emailBody,
                cancellationToken: cancellationToken
            );
        }

        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<PaginatedInvitationsResponseDto> GetInvitationsAsync(Guid orgId, int page, int pageSize, CancellationToken cancellationToken)
    {
        var query = _context.OrganizationInvitations
            .Where(oi => oi.OrganizationId == orgId)
            .Include(oi => oi.InvitedByUser)
            .Include(oi => oi.PreAssignedRoles)
                .ThenInclude(pr => pr.Role)
            .AsNoTracking();

        var totalItems = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(oi => oi.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        // Map Workspace scope names dynamically
        var workspaceIds = items
            .SelectMany(oi => oi.PreAssignedRoles)
            .Where(r => r.ScopeType == "WORKSPACE")
            .Select(r => r.ScopeId)
            .Distinct()
            .ToList();

        var workspaces = await _context.Workspaces
            .Where(w => workspaceIds.Contains(w.Id))
            .ToDictionaryAsync(w => w.Id, w => w.DisplayName, cancellationToken);

        var mapped = items.Select(oi => new OrganizationInvitationDto(
            oi.Id,
            oi.InviteeEmail,
            oi.Status,
            oi.CreatedAt,
            oi.ExpiresAt,
            oi.AcceptedAt,
            oi.InvitedByUserId,
            oi.InvitedByUser?.FullName ?? "System",
            oi.PreAssignedRoles.Select(pr => new PreAssignedRoleDetailsDto(
                pr.RoleId,
                pr.Role.Name,
                pr.Role.DisplayName,
                pr.ScopeType,
                pr.ScopeId,
                pr.ScopeType == "ORGANIZATION" ? "Global Organization" : workspaces.GetValueOrDefault(pr.ScopeId, "Unknown Workspace")
            )).ToList()
        )).ToList();

        return new PaginatedInvitationsResponseDto(mapped, totalItems, page, pageSize);
    }

    public async Task ResendInvitationAsync(Guid orgId, Guid actorUserId, Guid invitationId, CancellationToken cancellationToken)
    {
        var invite = await _context.OrganizationInvitations
            .Include(oi => oi.Organization)
            .FirstOrDefaultAsync(oi => oi.Id == invitationId && oi.OrganizationId == orgId, cancellationToken);

        if (invite == null)
        {
            throw new ValidationException("Invitation not found.");
        }

        if (invite.Status != "Pending" && invite.Status != "Expired")
        {
            throw new ValidationException($"Cannot resend an invitation with status '{invite.Status}'.");
        }

        var utcNow = _timeProvider.GetUtcNow();
        var expiresAt = utcNow.AddDays(7);

        // Generate new token
        var rawToken = Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N");
        var tokenHash = ComputeSha256(rawToken);

        invite.TokenHash = tokenHash;
        invite.ExpiresAt = expiresAt;
        invite.Status = "Pending";

        await LogAuditAsync(orgId, actorUserId, "INVITATION_RESENT", "Multiple", null, "ORGANIZATION", orgId, new { inviteeEmail = invite.InviteeEmail });

        var onboardingUrl = $"https://cverify.com/invitations/accept?token={rawToken}";
        var emailBody = $"Hi there,\n\nYour invitation to join {invite.Organization.Name} on CVerify has been resent.\n\nTo accept and configure your account, please click the link below:\n{onboardingUrl}\n\nThis invitation will expire on {expiresAt:MMMM dd, yyyy}.";

        await _emailService.SendSecurityAlertEmailAsync(
            invite.InviteeEmail,
            $"Resent: Invitation to join {invite.Organization.Name}",
            emailBody,
            cancellationToken: cancellationToken
        );

        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task CancelInvitationAsync(Guid orgId, Guid actorUserId, Guid invitationId, CancellationToken cancellationToken)
    {
        var invite = await _context.OrganizationInvitations
            .FirstOrDefaultAsync(oi => oi.Id == invitationId && oi.OrganizationId == orgId, cancellationToken);

        if (invite == null)
        {
            throw new ValidationException("Invitation not found.");
        }

        if (invite.Status != "Pending")
        {
            throw new ValidationException("Only pending invitations can be cancelled.");
        }

        invite.Status = "Cancelled";

        await LogAuditAsync(orgId, actorUserId, "INVITATION_CANCELLED", "Multiple", null, "ORGANIZATION", orgId, new { inviteeEmail = invite.InviteeEmail });

        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task AcceptInvitationAsync(Guid userId, string token, CancellationToken cancellationToken)
    {
        var tokenHash = ComputeSha256(token);
        var invite = await _context.OrganizationInvitations
            .Include(oi => oi.PreAssignedRoles)
            .FirstOrDefaultAsync(oi => oi.TokenHash == tokenHash, cancellationToken);

        if (invite == null)
        {
            throw new ValidationException("Invalid invitation token.");
        }

        if (invite.Status != "Pending")
        {
            throw new ValidationException($"This invitation has already been {invite.Status.ToLower()}.");
        }

        var utcNow = _timeProvider.GetUtcNow();
        if (invite.ExpiresAt < utcNow)
        {
            invite.Status = "Expired";
            await _context.SaveChangesAsync(cancellationToken);
            throw new ValidationException("This invitation token has expired. Please contact your administrator to request a new invite.");
        }

        var user = await _context.Users.FindAsync(new object[] { userId }, cancellationToken);
        if (user == null)
        {
            throw new ValidationException("User not found.");
        }

        if (user.Status != Shared.Domain.Enums.UserStatus.ACTIVE)
        {
            throw new ValidationException("You must verify your identity and activate your account before joining an organization.");
        }

        // Transaction block to insert membership and role assignments atomically
        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            // Create membership
            var membership = await _context.OrganizationMemberships
                .FirstOrDefaultAsync(om => om.OrganizationId == invite.OrganizationId && om.UserId == userId, cancellationToken);

            if (membership == null)
            {
                membership = new OrganizationMembership
                {
                    Id = Guid.CreateVersion7(),
                    OrganizationId = invite.OrganizationId,
                    UserId = userId,
                    Role = "MEMBER", // Backward compatibility fallback (deprecated)
                    Status = "active",
                    JoinedAt = utcNow
                };
                _context.OrganizationMemberships.Add(membership);
            }
            else
            {
                membership.Status = "active";
                membership.JoinedAt = utcNow;
            }

            // Create Organization Role Assignments
            foreach (var preRole in invite.PreAssignedRoles)
            {
                var roleExists = await _context.RoleAssignments
                    .AnyAsync(ra => ra.UserId == userId &&
                                    ra.RoleId == preRole.RoleId &&
                                    ra.ScopeType == preRole.ScopeType &&
                                    ra.ScopeId == preRole.ScopeId, cancellationToken);

                if (!roleExists)
                {
                    var assignment = new RoleAssignment
                    {
                        Id = Guid.CreateVersion7(),
                        UserId = userId,
                        RoleId = preRole.RoleId,
                        ScopeType = preRole.ScopeType,
                        ScopeId = preRole.ScopeId,
                        AssignedAt = utcNow
                    };
                    _context.RoleAssignments.Add(assignment);
                }
            }

            // Mark invitation consumed
            invite.Status = "Accepted";
            invite.AcceptedAt = utcNow;
            invite.ConsumedByUserId = userId;

            // Log Audit
            var auditLog = new AuditLog
            {
                Id = Guid.CreateVersion7(),
                OrganizationId = invite.OrganizationId,
                ActorUserId = userId,
                UserId = userId,
                EventType = "MEMBER_JOINED",
                Description = $"Member joined organization: {invite.InviteeEmail}.",
                TargetRoleName = "Multiple",
                TargetUserId = userId,
                ScopeType = "ORGANIZATION",
                ScopeId = invite.OrganizationId,
                DetailsJson = System.Text.Json.JsonSerializer.Serialize(new { email = invite.InviteeEmail }),
                CreatedAt = utcNow
            };
            _context.AuditLogs.Add(auditLog);

            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            // Invalidate Redis permissions cache for user
            var cacheKey = $"auth:org:{invite.OrganizationId}:user:{userId}:scoped_perms";
            await _cacheService.DeleteAsync(cacheKey);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            _logger.LogError(ex, "Transaction failed while accepting invitation for user {UserId}", userId);
            throw;
        }
    }

    private async Task LogAuditAsync(
        Guid orgId,
        Guid actorUserId,
        string action,
        string targetRoleName,
        Guid? targetUserId = null,
        string? scopeType = null,
        Guid? scopeId = null,
        object? details = null)
    {
        var log = new AuditLog
        {
            Id = Guid.CreateVersion7(),
            OrganizationId = orgId,
            ActorUserId = actorUserId,
            UserId = actorUserId,
            EventType = action,
            Description = $"Business role action {action} performed.",
            TargetRoleName = targetRoleName,
            TargetUserId = targetUserId,
            ScopeType = scopeType,
            ScopeId = scopeId,
            DetailsJson = details != null ? System.Text.Json.JsonSerializer.Serialize(details) : null,
            CreatedAt = _timeProvider.GetUtcNow()
        };
        _context.AuditLogs.Add(log);
    }
}
