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
using CVerify.API.Modules.Shared.Domain.Services;
using CVerify.API.Modules.Shared.Domain.Constants;
using CVerify.API.Modules.Shared.Email.Services;
using CVerify.API.Modules.Shared.Configuration;

namespace CVerify.API.Modules.Auth.Services;

public class OrganizationInvitationService : IOrganizationInvitationService
{
    private readonly ApplicationDbContext _context;
    private readonly TimeProvider _timeProvider;
    private readonly ICacheService _cacheService;
    private readonly IEmailService _emailService;
    private readonly ILogger<OrganizationInvitationService> _logger;
    private readonly IActivityEventPublisher _activityEventPublisher;
    private readonly IOrganizationAuthorizationService _authService;
    private readonly EnvConfiguration _envConfig;

    public OrganizationInvitationService(
        ApplicationDbContext context,
        TimeProvider timeProvider,
        ICacheService cacheService,
        IEmailService emailService,
        ILogger<OrganizationInvitationService> logger,
        IActivityEventPublisher activityEventPublisher,
        IOrganizationAuthorizationService authService,
        EnvConfiguration envConfig)
    {
        _context = context;
        _timeProvider = timeProvider;
        _cacheService = cacheService;
        _emailService = emailService;
        _logger = logger;
        _activityEventPublisher = activityEventPublisher;
        _authService = authService;
        _envConfig = envConfig;
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

    public async Task InviteMembersAsync(Guid orgId, Guid? actorUserId, CreateInvitationsDto dto, CancellationToken cancellationToken)
    {
        var org = await _context.Organizations
            .FirstOrDefaultAsync(o => o.Id == orgId && o.DeletedAt == null, cancellationToken);

        if (org == null)
        {
            throw new ValidationException("Organization not found.");
        }

        var utcNow = _timeProvider.GetUtcNow();
        var expiresAt = utcNow.AddDays(7);

        // Fetch actor permissions once for role escalation checks
        var actorPerms = actorUserId.HasValue
            ? await _authService.GetPermissionsAsync(actorUserId.Value, orgId, cancellationToken)
            : new List<string>();
        bool isSuperAdmin = actorPerms.Contains("*:*:*");

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

            // Pre-validate all pre-assigned roles and perform escalation checks
            foreach (var roleDto in invitee.Roles)
            {
                var targetRole = await _context.Roles
                    .Include(r => r.Permissions)
                    .FirstOrDefaultAsync(r => r.Id == roleDto.RoleId && r.TenantId == orgId && r.Domain == "TENANT" && r.IsActive, cancellationToken);

                if (targetRole == null)
                {
                    throw new ValidationException($"Selected business role {roleDto.RoleId} is invalid or inactive.");
                }

                if (actorUserId.HasValue && !isSuperAdmin)
                {
                    foreach (var perm in targetRole.Permissions)
                    {
                        var expectedMatch = $"{perm.Name}:{roleDto.ScopeType}:{roleDto.ScopeId}".ToLowerInvariant();
                        var globalMatch = $"{perm.Name}:ORGANIZATION:{orgId}".ToLowerInvariant();

                        bool hasPermission = actorPerms.Any(p => p.ToLowerInvariant() == expectedMatch || p.ToLowerInvariant() == globalMatch);
                        if (!hasPermission)
                        {
                            throw new ValidationException($"Role escalation detected: You do not have permission '{perm.DisplayName}' in the requested scope to assign this role.");
                        }
                    }
                }
            }

            // Generate secure random token
            var rawToken = Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N");
            var tokenHash = ComputeSha256(rawToken);

            // Check if the user already has a registered account on the platform
            var targetUser = await _context.FindUserByVerifiedEmailAsync(normalizedEmail, cancellationToken);
            bool isExistingUser = targetUser != null;

            // Enforce only one active Pending invitation per Organization + Email
            var existingPending = await _context.OrganizationInvitations
                .Include(oi => oi.PreAssignedRoles)
                .FirstOrDefaultAsync(oi => oi.OrganizationId == orgId && oi.InviteeEmail == normalizedEmail && oi.Status == "Pending", cancellationToken);

            Guid invitationId;

            if (existingPending != null)
            {
                invitationId = existingPending.Id;
                existingPending.TokenHash = tokenHash;
                existingPending.ExpiresAt = expiresAt;
                existingPending.DiscoveryNotifiedAt = isExistingUser ? utcNow : null;
                existingPending.InvitedByUserId = actorUserId;

                // Re-seed roles if they differ
                var rolesDiffer = existingPending.PreAssignedRoles.Count != invitee.Roles.Count ||
                    invitee.Roles.Any(r => !existingPending.PreAssignedRoles.Any(pr =>
                        pr.RoleId == r.RoleId &&
                        pr.ScopeType.Equals(r.ScopeType, StringComparison.OrdinalIgnoreCase) &&
                        pr.ScopeId == r.ScopeId));

                if (rolesDiffer)
                {
                    _context.OrganizationInvitationRoles.RemoveRange(existingPending.PreAssignedRoles);
                    foreach (var roleDto in invitee.Roles)
                    {
                        var invitationRole = new OrganizationInvitationRole
                        {
                            Id = Guid.CreateVersion7(),
                            InvitationId = existingPending.Id,
                            RoleId = roleDto.RoleId,
                            ScopeType = roleDto.ScopeType.Trim().ToUpperInvariant(),
                            ScopeId = roleDto.ScopeId
                        };

                        _context.OrganizationInvitationRoles.Add(invitationRole);
                    }
                }
            }
            else
            {
                var invitation = new OrganizationInvitation
                {
                    Id = Guid.CreateVersion7(),
                    OrganizationId = orgId,
                    InviteeEmail = normalizedEmail,
                    TokenHash = tokenHash,
                    InvitedByUserId = actorUserId,
                    Status = "Pending",
                    CreatedAt = utcNow,
                    ExpiresAt = expiresAt,
                    DiscoveryNotifiedAt = isExistingUser ? utcNow : null
                };

                _context.OrganizationInvitations.Add(invitation);
                invitationId = invitation.Id;

                // Pre-assign roles and scopes
                foreach (var roleDto in invitee.Roles)
                {
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
            }

            // Publish Platform Event (InvitationCreated)
            await _activityEventPublisher.PublishAsync(
                eventType: ActivityEventTypes.InvitationCreated,
                resourceType: "organization_invitation",
                resourceId: invitationId,
                organizationId: orgId,
                actorUserId: actorUserId,
                payload: new { inviteeEmail = normalizedEmail, isResend = (existingPending != null), rolesCount = invitee.Roles.Count }
            );

            // If user is already registered, dispatch an immediate InvitationDiscovered event to trigger the in-app notification
            if (isExistingUser)
            {
                await _activityEventPublisher.PublishAsync(
                    eventType: ActivityEventTypes.InvitationDiscovered,
                    resourceType: "organization_invitation",
                    resourceId: invitationId,
                    organizationId: orgId,
                    actorUserId: actorUserId,
                    payload: new { inviteeEmail = normalizedEmail }
                );
            }

            // Send Email (Enqueue or Send directly)
            var onboardingUrl = $"{_envConfig.Auth.FrontendUrl.TrimEnd('/')}/invitations/accept?token={rawToken}";
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

    public async Task<PaginatedInvitationsResponseDto> GetInvitationsAsync(Guid orgId, string? status, int page, int pageSize, CancellationToken cancellationToken)
    {
        var utcNow = _timeProvider.GetUtcNow();
        var query = _context.OrganizationInvitations
            .Where(oi => oi.OrganizationId == orgId)
            .Include(oi => oi.InvitedByUser)
            .Include(oi => oi.PreAssignedRoles)
                .ThenInclude(pr => pr.Role)
            .AsNoTracking();

        var statusLower = status?.Trim().ToLowerInvariant() ?? "active";
        if (statusLower == "active")
        {
            query = query.Where(oi => oi.Status == "Pending" && oi.ExpiresAt > utcNow);
        }
        else if (statusLower == "history")
        {
            query = query.Where(oi => oi.Status != "Pending" || oi.ExpiresAt <= utcNow);
        }

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

        var mapped = items.Select(oi => {
            var displayStatus = oi.Status;
            if (oi.Status == "Pending" && oi.ExpiresAt <= utcNow)
            {
                displayStatus = "Expired";
            }
            return new OrganizationInvitationDto(
                oi.Id,
                oi.InviteeEmail,
                displayStatus,
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
            );
        }).ToList();

        return new PaginatedInvitationsResponseDto(mapped, totalItems, page, pageSize);
    }

    public async Task ResendInvitationAsync(Guid orgId, Guid? actorUserId, Guid invitationId, CancellationToken cancellationToken)
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

        // Check if the user already has a registered account on the platform
        var targetUser = await _context.FindUserByVerifiedEmailAsync(invite.InviteeEmail, cancellationToken);
        bool isExistingUser = targetUser != null;

        invite.TokenHash = tokenHash;
        invite.ExpiresAt = expiresAt;
        invite.Status = "Pending";
        invite.DiscoveryNotifiedAt = isExistingUser ? utcNow : null;

        await _activityEventPublisher.PublishAsync(
            eventType: ActivityEventTypes.InvitationResent,
            resourceType: "organization_invitation",
            resourceId: invitationId,
            organizationId: orgId,
            actorUserId: actorUserId,
            payload: new { inviteeEmail = invite.InviteeEmail }
        );

        // If user is already registered, dispatch an immediate InvitationDiscovered event to trigger the in-app notification
        if (isExistingUser)
        {
            await _activityEventPublisher.PublishAsync(
                eventType: ActivityEventTypes.InvitationDiscovered,
                resourceType: "organization_invitation",
                resourceId: invitationId,
                organizationId: orgId,
                actorUserId: actorUserId,
                payload: new { inviteeEmail = invite.InviteeEmail }
            );
        }

        var onboardingUrl = $"{_envConfig.Auth.FrontendUrl.TrimEnd('/')}/invitations/accept?token={rawToken}";
        var emailBody = $"Hi there,\n\nYour invitation to join {invite.Organization.Name} on CVerify has been resent.\n\nTo accept and configure your account, please click the link below:\n{onboardingUrl}\n\nThis invitation will expire on {expiresAt:MMMM dd, yyyy}.";

        await _emailService.SendSecurityAlertEmailAsync(
            invite.InviteeEmail,
            $"Resent: Invitation to join {invite.Organization.Name}",
            emailBody,
            cancellationToken: cancellationToken
        );

        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task CancelInvitationAsync(Guid orgId, Guid? actorUserId, Guid invitationId, CancellationToken cancellationToken)
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

        await _activityEventPublisher.PublishAsync(
            eventType: ActivityEventTypes.InvitationCancelled,
            resourceType: "organization_invitation",
            resourceId: invitationId,
            organizationId: orgId,
            actorUserId: actorUserId,
            payload: new { inviteeEmail = invite.InviteeEmail }
        );

        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<string> AcceptInvitationAsync(Guid userId, string token, CancellationToken cancellationToken)
    {
        var tokenHash = ComputeSha256(token);
        
        using var transaction = await _context.Database.BeginTransactionAsync(System.Data.IsolationLevel.RepeatableRead, cancellationToken);
        try
        {
            var invite = await _context.OrganizationInvitations
                .Include(oi => oi.Organization)
                .Include(oi => oi.PreAssignedRoles)
                .FirstOrDefaultAsync(oi => oi.TokenHash == tokenHash, cancellationToken);

            if (invite == null)
            {
                throw new ValidationException("Invalid invitation token.");
            }

            if (invite.Status == "Accepted")
            {
                if (invite.ConsumedByUserId == userId)
                {
                    await transaction.RollbackAsync(cancellationToken);
                    return invite.Organization.Username;
                }
                throw new ValidationException("This invitation has already been accepted.");
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
                await transaction.CommitAsync(cancellationToken);
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

            var verifiedEmails = new List<string> { user.Email.Trim().ToLowerInvariant() };
            if (user.LinkedEmails != null)
            {
                verifiedEmails.AddRange(user.LinkedEmails
                    .Where(le => le.IsVerified)
                    .Select(le => le.Email.Trim().ToLowerInvariant()));
            }
            verifiedEmails = verifiedEmails.Distinct(StringComparer.OrdinalIgnoreCase).ToList();

            if (!verifiedEmails.Contains(invite.InviteeEmail.Trim().ToLowerInvariant()))
            {
                throw new ValidationException("You can only accept invitations sent to your verified email address.");
            }

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
                    Role = "MEMBER",
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

            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            // Invalidate Redis permissions cache for user
            var cacheKey = $"auth:org:{invite.OrganizationId}:user:{userId}:scoped_perms";
            await _cacheService.DeleteAsync(cacheKey);

            // Publish Platform Event
            await _activityEventPublisher.PublishAsync(
                eventType: ActivityEventTypes.InvitationAccepted,
                resourceType: "organization_invitation",
                resourceId: invite.Id,
                organizationId: invite.OrganizationId,
                actorUserId: userId,
                payload: new { inviteeEmail = invite.InviteeEmail }
            );

            return invite.Organization.Username;
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            _logger.LogError(ex, "Transaction failed while accepting invitation for user {UserId}", userId);
            throw;
        }
    }

    public async Task<string> DeclineInvitationAsync(Guid userId, string token, CancellationToken cancellationToken)
    {
        var tokenHash = ComputeSha256(token);
        
        using var transaction = await _context.Database.BeginTransactionAsync(System.Data.IsolationLevel.RepeatableRead, cancellationToken);
        try
        {
            var invite = await _context.OrganizationInvitations
                .Include(oi => oi.Organization)
                .FirstOrDefaultAsync(oi => oi.TokenHash == tokenHash, cancellationToken);

            if (invite == null)
            {
                throw new ValidationException("Invalid invitation token.");
            }

            if (invite.Status == "Declined")
            {
                await transaction.RollbackAsync(cancellationToken);
                return invite.Organization.Username;
            }

            if (invite.Status != "Pending")
            {
                throw new ValidationException($"This invitation has already been {invite.Status.ToLower()}.");
            }

            var user = await _context.Users.FindAsync(new object[] { userId }, cancellationToken);
            if (user == null)
            {
                throw new ValidationException("User not found.");
            }

            if (user.Status != Shared.Domain.Enums.UserStatus.ACTIVE)
            {
                throw new ValidationException("You must verify your identity and activate your account before declining an invitation.");
            }

            var verifiedEmails = new List<string> { user.Email.Trim().ToLowerInvariant() };
            if (user.LinkedEmails != null)
            {
                verifiedEmails.AddRange(user.LinkedEmails
                    .Where(le => le.IsVerified)
                    .Select(le => le.Email.Trim().ToLowerInvariant()));
            }
            verifiedEmails = verifiedEmails.Distinct(StringComparer.OrdinalIgnoreCase).ToList();

            if (!verifiedEmails.Contains(invite.InviteeEmail.Trim().ToLowerInvariant()))
            {
                throw new ValidationException("You can only decline invitations sent to your verified email address.");
            }

            var utcNow = _timeProvider.GetUtcNow();
            invite.Status = "Declined";
            invite.DeclinedAt = utcNow;

            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            // Publish Platform Event
            await _activityEventPublisher.PublishAsync(
                eventType: ActivityEventTypes.InvitationDeclined,
                resourceType: "organization_invitation",
                resourceId: invite.Id,
                organizationId: invite.OrganizationId,
                actorUserId: userId,
                payload: new { inviteeEmail = invite.InviteeEmail }
            );

            return invite.Organization.Username;
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            _logger.LogError(ex, "Transaction failed while declining invitation for user {UserId}", userId);
            throw;
        }
    }

    public async Task<string> AcceptInvitationByIdAsync(Guid userId, Guid invitationId, CancellationToken cancellationToken)
    {
        using var transaction = await _context.Database.BeginTransactionAsync(System.Data.IsolationLevel.RepeatableRead, cancellationToken);
        try
        {
            var invite = await _context.OrganizationInvitations
                .Include(oi => oi.Organization)
                .Include(oi => oi.PreAssignedRoles)
                .FirstOrDefaultAsync(oi => oi.Id == invitationId, cancellationToken);

            if (invite == null)
            {
                throw new ValidationException("Invitation not found.");
            }

            if (invite.Status == "Accepted")
            {
                if (invite.ConsumedByUserId == userId)
                {
                    await transaction.RollbackAsync(cancellationToken);
                    return invite.Organization.Username;
                }
                throw new ValidationException("This invitation has already been accepted.");
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
                await transaction.CommitAsync(cancellationToken);
                throw new ValidationException("This invitation has expired.");
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

            var verifiedEmails = new List<string> { user.Email.Trim().ToLowerInvariant() };
            if (user.LinkedEmails != null)
            {
                verifiedEmails.AddRange(user.LinkedEmails
                    .Where(le => le.IsVerified)
                    .Select(le => le.Email.Trim().ToLowerInvariant()));
            }
            verifiedEmails = verifiedEmails.Distinct(StringComparer.OrdinalIgnoreCase).ToList();

            if (!verifiedEmails.Contains(invite.InviteeEmail.Trim().ToLowerInvariant()))
            {
                throw new ValidationException("You can only accept invitations sent to your verified email address.");
            }

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
                    Role = "MEMBER",
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

            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            // Invalidate Redis permissions cache for user
            var cacheKey = $"auth:org:{invite.OrganizationId}:user:{userId}:scoped_perms";
            await _cacheService.DeleteAsync(cacheKey);

            // Publish Platform Event
            await _activityEventPublisher.PublishAsync(
                eventType: ActivityEventTypes.InvitationAccepted,
                resourceType: "organization_invitation",
                resourceId: invite.Id,
                organizationId: invite.OrganizationId,
                actorUserId: userId,
                payload: new { inviteeEmail = invite.InviteeEmail }
            );

            return invite.Organization.Username;
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            _logger.LogError(ex, "Transaction failed while accepting invitation for user {UserId}", userId);
            throw;
        }
    }

    public async Task<string> DeclineInvitationByIdAsync(Guid userId, Guid invitationId, CancellationToken cancellationToken)
    {
        using var transaction = await _context.Database.BeginTransactionAsync(System.Data.IsolationLevel.RepeatableRead, cancellationToken);
        try
        {
            var invite = await _context.OrganizationInvitations
                .Include(oi => oi.Organization)
                .FirstOrDefaultAsync(oi => oi.Id == invitationId, cancellationToken);

            if (invite == null)
            {
                throw new ValidationException("Invitation not found.");
            }

            if (invite.Status == "Declined")
            {
                await transaction.RollbackAsync(cancellationToken);
                return invite.Organization.Username;
            }

            if (invite.Status != "Pending")
            {
                throw new ValidationException($"This invitation has already been {invite.Status.ToLower()}.");
            }

            var user = await _context.Users.FindAsync(new object[] { userId }, cancellationToken);
            if (user == null)
            {
                throw new ValidationException("User not found.");
            }

            if (user.Status != Shared.Domain.Enums.UserStatus.ACTIVE)
            {
                throw new ValidationException("You must verify your identity and activate your account before declining an invitation.");
            }

            var verifiedEmails = new List<string> { user.Email.Trim().ToLowerInvariant() };
            if (user.LinkedEmails != null)
            {
                verifiedEmails.AddRange(user.LinkedEmails
                    .Where(le => le.IsVerified)
                    .Select(le => le.Email.Trim().ToLowerInvariant()));
            }
            verifiedEmails = verifiedEmails.Distinct(StringComparer.OrdinalIgnoreCase).ToList();

            if (!verifiedEmails.Contains(invite.InviteeEmail.Trim().ToLowerInvariant()))
            {
                throw new ValidationException("You can only decline invitations sent to your verified email address.");
            }

            var utcNow = _timeProvider.GetUtcNow();
            invite.Status = "Declined";
            invite.DeclinedAt = utcNow;

            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            // Publish Platform Event
            await _activityEventPublisher.PublishAsync(
                eventType: ActivityEventTypes.InvitationDeclined,
                resourceType: "organization_invitation",
                resourceId: invite.Id,
                organizationId: invite.OrganizationId,
                actorUserId: userId,
                payload: new { inviteeEmail = invite.InviteeEmail }
            );

            return invite.Organization.Username;
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            _logger.LogError(ex, "Transaction failed while declining invitation for user {UserId}", userId);
            throw;
        }
    }
}
