using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.Admin.DTOs;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.System.DTOs;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Exceptions;
using CVerify.API.Modules.Shared.Email.Services;
using CVerify.API.Modules.Shared.Configuration;

namespace CVerify.API.Modules.Admin.Services;

public class AdminMemberService : IAdminMemberService
{
    private readonly ApplicationDbContext _context;
    private readonly IAdminAuthorizationService _authService;
    private readonly IEmailService _emailService;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<AdminMemberService> _logger;
    private readonly EnvConfiguration _envConfig;

    public AdminMemberService(
        ApplicationDbContext context,
        IAdminAuthorizationService authService,
        IEmailService emailService,
        TimeProvider timeProvider,
        ILogger<AdminMemberService> logger,
        EnvConfiguration envConfig)
    {
        _context = context;
        _authService = authService;
        _emailService = emailService;
        _timeProvider = timeProvider;
        _logger = logger;
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

    private async Task<int> GetActiveSuperAdminCountAsync(CancellationToken cancellationToken)
    {
        return await _context.RoleAssignments
            .Include(ra => ra.Role)
            .CountAsync(ra => ra.ScopeType == "SYSTEM" && ra.Role.Name == "SUPER_ADMIN" &&
                _context.AdminMembers.Any(am => am.UserId == ra.UserId && am.Status.ToUpper() == "ACTIVE"), cancellationToken);
    }

    private async Task LogAuditAsync(
        Guid? actorUserId,
        string action,
        string? targetRoleName,
        Guid? targetUserId,
        object? details)
    {
        var log = new AuditLog
        {
            Id = Guid.CreateVersion7(),
            ActorUserId = actorUserId,
            UserId = actorUserId,
            EventType = action,
            Description = $"Admin action {action} performed.",
            TargetRoleName = targetRoleName,
            TargetUserId = targetUserId,
            DetailsJson = details != null ? System.Text.Json.JsonSerializer.Serialize(details) : null,
            CreatedAt = _timeProvider.GetUtcNow()
        };
        _context.AuditLogs.Add(log);
    }

    public async Task<PaginatedResultDto<AdminMemberListItemDto>> GetMembersAsync(
        string? search, string? status, int page, int pageSize, CancellationToken cancellationToken)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 20;

        var query = _context.AdminMembers
            .Include(am => am.User)
                .ThenInclude(u => u.RoleAssignments)
                    .ThenInclude(ra => ra.Role)
            .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLowerInvariant();
            query = query.Where(am =>
                am.User.Email.ToLower().Contains(searchLower) ||
                am.User.FullName.ToLower().Contains(searchLower)
            );
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            var statusLower = status.Trim().ToLowerInvariant();
            query = query.Where(am => am.Status.ToLower() == statusLower);
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(am => am.JoinedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(am => new AdminMemberListItemDto(
                am.Id,
                am.UserId,
                am.User.Email,
                am.User.FullName,
                am.Status,
                am.User.LastLoginAt,
                am.SessionVersion,
                am.JoinedAt,
                am.User.RoleAssignments
                    .Where(ra => ra.ScopeType == "SYSTEM")
                    .Select(ra => new AdminMemberRoleDto(
                        ra.RoleId,
                        ra.Role.Name,
                        ra.Role.DisplayName,
                        ra.ScopeType,
                        ra.ScopeId
                    )).ToList()
            ))
            .ToListAsync(cancellationToken);

        return new PaginatedResultDto<AdminMemberListItemDto>(items, totalCount, page, pageSize);
    }

    public async Task InviteMemberAsync(Guid actorUserId, InviteAdminDto dto, CancellationToken cancellationToken)
    {
        if (dto.RoleIds == null || !dto.RoleIds.Any())
        {
            throw new ValidationException("At least one admin role must be selected.");
        }

        var normalizedEmail = NormalizeEmail(dto.Email);

        // Check if user is already an admin member
        var existingMember = await _context.AdminMembers
            .Include(am => am.User)
            .FirstOrDefaultAsync(am => am.User.Email == normalizedEmail, cancellationToken);

        if (existingMember != null)
        {
            throw new ValidationException($"User with email {dto.Email} is already an admin member (Status: {existingMember.Status}).");
        }

        // Verify roles exist and are active
        var roles = await _context.Roles
            .Where(r => dto.RoleIds.Contains(r.Id) && r.Domain == "SYSTEM" && r.IsActive)
            .ToListAsync(cancellationToken);

        if (roles.Count != dto.RoleIds.Distinct().Count())
        {
            throw new ValidationException("One or more selected roles are invalid or inactive.");
        }

        // Partial unique index / active pending check
        var pendingInvitationExists = await _context.AdminInvitations
            .AnyAsync(ai => ai.InviteeEmail == normalizedEmail && ai.Status == "Pending", cancellationToken);

        if (pendingInvitationExists)
        {
            throw new ValidationException($"There is already a pending invitation active for email {dto.Email}.");
        }

        var utcNow = _timeProvider.GetUtcNow();
        var expiresAt = utcNow.AddDays(7);
        var rawToken = Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N");
        var tokenHash = ComputeSha256(rawToken);

        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var invitation = new AdminInvitation
            {
                Id = Guid.CreateVersion7(),
                InviteeEmail = normalizedEmail,
                TokenHash = tokenHash,
                InvitedByUserId = actorUserId,
                Status = "Pending",
                CreatedAt = utcNow,
                ExpiresAt = expiresAt
            };
            _context.AdminInvitations.Add(invitation);

            foreach (var role in roles)
            {
                var inviteRole = new AdminInvitationRole
                {
                    Id = Guid.CreateVersion7(),
                    InvitationId = invitation.Id,
                    RoleId = role.Id
                };
                _context.AdminInvitationRoles.Add(inviteRole);
            }

            var roleNames = string.Join(", ", roles.Select(r => r.DisplayName));
            await LogAuditAsync(actorUserId, "MEMBER_INVITED", roleNames, null, new { inviteeEmail = normalizedEmail });

            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            // Send invitation email
            var onboardingUrl = $"{_envConfig.Auth.FrontendUrl.TrimEnd('/')}/admin/invitations/accept?token={rawToken}";
            var emailBody = $"Hello,\n\nYou have been invited to join the CVerify Admin portal.\n\nTo accept this invitation and set up your admin privileges, please click the link below:\n{onboardingUrl}\n\nThis invitation will expire on {expiresAt:MMMM dd, yyyy}.";

            await _emailService.SendSecurityAlertEmailAsync(
                normalizedEmail,
                "Invitation to join CVerify Admin Portal",
                emailBody,
                cancellationToken: cancellationToken
            );
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            _logger.LogError(ex, "Failed to invite admin member {Email}", dto.Email);
            throw;
        }
    }

    public async Task AcceptInvitationAsync(Guid userId, string token, CancellationToken cancellationToken)
    {
        var tokenHash = ComputeSha256(token);
        var invite = await _context.AdminInvitations
            .Include(ai => ai.PreAssignedRoles)
                .ThenInclude(pr => pr.Role)
            .FirstOrDefaultAsync(ai => ai.TokenHash == tokenHash, cancellationToken);

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
            throw new ValidationException("This invitation token has expired. Please contact an administrator to request a new invite.");
        }

        var user = await _context.Users.FindAsync(new object[] { userId }, cancellationToken);
        if (user == null)
        {
            throw new ValidationException("User not found.");
        }

        if (user.Status != Shared.Domain.Enums.UserStatus.ACTIVE)
        {
            throw new ValidationException("You must activate your account and verify your identity before onboarding as an administrator.");
        }

        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            invite.Status = "Accepted";
            invite.AcceptedAt = utcNow;
            invite.ConsumedByUserId = userId;

            var adminMember = await _context.AdminMembers
                .FirstOrDefaultAsync(am => am.UserId == userId, cancellationToken);

            if (adminMember == null)
            {
                adminMember = new AdminMember
                {
                    Id = Guid.CreateVersion7(),
                    UserId = userId,
                    Status = "Active",
                    SessionVersion = 1,
                    JoinedAt = utcNow,
                    UpdatedAt = utcNow,
                    AssignedByUserId = invite.InvitedByUserId
                };
                _context.AdminMembers.Add(adminMember);
            }
            else
            {
                adminMember.Status = "Active";
                adminMember.UpdatedAt = utcNow;
            }

            // Create Role Assignments (SYSTEM Scope only)
            foreach (var preRole in invite.PreAssignedRoles)
            {
                var roleExists = await _context.RoleAssignments
                    .AnyAsync(ra => ra.UserId == userId && ra.RoleId == preRole.RoleId && ra.ScopeType == "SYSTEM", cancellationToken);

                if (!roleExists)
                {
                    var assignment = new RoleAssignment
                    {
                        Id = Guid.CreateVersion7(),
                        UserId = userId,
                        RoleId = preRole.RoleId,
                        ScopeType = "SYSTEM",
                        ScopeId = Guid.Empty,
                        AssignedAt = utcNow
                    };
                    _context.RoleAssignments.Add(assignment);
                }
            }

            var roleNames = string.Join(", ", invite.PreAssignedRoles.Select(pr => pr.Role.DisplayName));
            await LogAuditAsync(userId, "MEMBER_JOINED", roleNames, userId, new { email = invite.InviteeEmail });

            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            // Invalidate authorization caches
            await _authService.InvalidateCacheAsync(userId);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            _logger.LogError(ex, "Transaction failed while accepting admin invitation for user {UserId}", userId);
            throw;
        }
    }

    public async Task UpdateMemberAsync(Guid actorUserId, Guid memberId, UpdateAdminMemberDto dto, CancellationToken cancellationToken)
    {
        var member = await _context.AdminMembers
            .Include(am => am.User)
                .ThenInclude(u => u.RoleAssignments)
                    .ThenInclude(ra => ra.Role)
            .FirstOrDefaultAsync(am => am.Id == memberId, cancellationToken);

        if (member == null)
        {
            throw new ValidationException("Admin member not found.");
        }

        var isSuspending = dto.Status.Equals("Suspended", StringComparison.OrdinalIgnoreCase);
        var currentlyActive = member.Status.Equals("Active", StringComparison.OrdinalIgnoreCase);

        // Lockout protection on suspension
        if (currentlyActive && isSuspending)
        {
            var isSuperAdmin = member.User.RoleAssignments.Any(ra => ra.ScopeType == "SYSTEM" && ra.Role.Name == "SUPER_ADMIN");
            if (isSuperAdmin)
            {
                var activeSuperAdminCount = await GetActiveSuperAdminCountAsync(cancellationToken);
                if (activeSuperAdminCount <= 1)
                {
                    throw new ValidationException("Cannot suspend this member because they are the last active Super Administrator in the system.");
                }
            }
        }

        // Verify requested roles exist and are active
        if (dto.RoleIds == null || !dto.RoleIds.Any())
        {
            throw new ValidationException("At least one admin role must be selected.");
        }

        var newRoles = await _context.Roles
            .Where(r => dto.RoleIds.Contains(r.Id) && r.Domain == "SYSTEM" && r.IsActive)
            .ToListAsync(cancellationToken);

        if (newRoles.Count != dto.RoleIds.Distinct().Count())
        {
            throw new ValidationException("One or more selected roles are invalid or inactive.");
        }

        // Lockout protection on role revocation/modification
        var currentlySuperAdmin = member.User.RoleAssignments.Any(ra => ra.ScopeType == "SYSTEM" && ra.Role.Name == "SUPER_ADMIN");
        var willBeSuperAdmin = newRoles.Any(r => r.Name == "SUPER_ADMIN");
        if (currentlyActive && currentlySuperAdmin && !willBeSuperAdmin)
        {
            var activeSuperAdminCount = await GetActiveSuperAdminCountAsync(cancellationToken);
            if (activeSuperAdminCount <= 1)
            {
                throw new ValidationException("Cannot remove the Super Administrator role from this member because they are the last active Super Administrator in the system.");
            }
        }

        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            // Update status
            var oldStatus = member.Status;
            member.Status = dto.Status;
            member.UpdatedAt = _timeProvider.GetUtcNow();

            // Revoke current assignments
            var oldAssignments = member.User.RoleAssignments.Where(ra => ra.ScopeType == "SYSTEM").ToList();
            _context.RoleAssignments.RemoveRange(oldAssignments);

            // Add new assignments
            foreach (var r in newRoles)
            {
                _context.RoleAssignments.Add(new RoleAssignment
                {
                    Id = Guid.CreateVersion7(),
                    UserId = member.UserId,
                    RoleId = r.Id,
                    ScopeType = "SYSTEM",
                    ScopeId = Guid.Empty,
                    AssignedAt = _timeProvider.GetUtcNow()
                });
            }

            // Increment session version to force active session invalidation (decoupled from user.SessionVersion)
            member.SessionVersion += 1;

            var roleNames = string.Join(", ", newRoles.Select(r => r.DisplayName));
            await LogAuditAsync(actorUserId, "MEMBER_UPDATED", roleNames, member.UserId, new
            {
                oldStatus,
                newStatus = dto.Status,
                roles = newRoles.Select(r => r.Name).ToList()
            });

            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            // Invalidate caches
            await _authService.InvalidateCacheAsync(member.UserId);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            _logger.LogError(ex, "Failed to update admin member {MemberId}", memberId);
            throw;
        }
    }

    public async Task RemoveMemberAsync(Guid actorUserId, Guid memberId, CancellationToken cancellationToken)
    {
        var member = await _context.AdminMembers
            .Include(am => am.User)
                .ThenInclude(u => u.RoleAssignments)
                    .ThenInclude(ra => ra.Role)
            .FirstOrDefaultAsync(am => am.Id == memberId, cancellationToken);

        if (member == null)
        {
            throw new ValidationException("Admin member not found.");
        }

        // Lockout protection on delete
        if (member.Status.Equals("Active", StringComparison.OrdinalIgnoreCase))
        {
            var isSuperAdmin = member.User.RoleAssignments.Any(ra => ra.ScopeType == "SYSTEM" && ra.Role.Name == "SUPER_ADMIN");
            if (isSuperAdmin)
            {
                var activeSuperAdminCount = await GetActiveSuperAdminCountAsync(cancellationToken);
                if (activeSuperAdminCount <= 1)
                {
                    throw new ValidationException("Cannot remove this member because they are the last active Super Administrator in the system.");
                }
            }
        }

        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var oldAssignments = member.User.RoleAssignments.Where(ra => ra.ScopeType == "SYSTEM").ToList();
            _context.RoleAssignments.RemoveRange(oldAssignments);
            _context.AdminMembers.Remove(member);

            await LogAuditAsync(actorUserId, "MEMBER_REMOVED", null, member.UserId, new { email = member.User.Email });

            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            // Invalidate caches
            await _authService.InvalidateCacheAsync(member.UserId);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            _logger.LogError(ex, "Failed to remove admin member {MemberId}", memberId);
            throw;
        }
    }

    public async Task<PaginatedResultDto<AdminInvitationListItemDto>> GetInvitationsAsync(
        string? search, int page, int pageSize, CancellationToken cancellationToken)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 20;

        var query = _context.AdminInvitations
            .Include(ai => ai.InvitedByUser)
            .Include(ai => ai.PreAssignedRoles)
                .ThenInclude(pr => pr.Role)
            .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLowerInvariant();
            query = query.Where(ai => ai.InviteeEmail.ToLower().Contains(searchLower));
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(ai => ai.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(ai => new AdminInvitationListItemDto(
                ai.Id,
                ai.InviteeEmail,
                ai.Status,
                ai.CreatedAt,
                ai.ExpiresAt,
                ai.AcceptedAt,
                ai.InvitedByUserId,
                ai.InvitedByUser != null ? ai.InvitedByUser.Email : "System",
                ai.PreAssignedRoles.Select(pr => new AdminInvitationRoleDto(
                    pr.RoleId,
                    pr.Role.Name,
                    pr.Role.DisplayName
                )).ToList()
            ))
            .ToListAsync(cancellationToken);

        return new PaginatedResultDto<AdminInvitationListItemDto>(items, totalCount, page, pageSize);
    }

    public async Task CancelInvitationAsync(Guid actorUserId, Guid invitationId, CancellationToken cancellationToken)
    {
        var invite = await _context.AdminInvitations
            .FirstOrDefaultAsync(ai => ai.Id == invitationId, cancellationToken);

        if (invite == null)
        {
            throw new ValidationException("Invitation not found.");
        }

        if (invite.Status != "Pending")
        {
            throw new ValidationException("Only pending invitations can be cancelled.");
        }

        invite.Status = "Cancelled";
        await LogAuditAsync(actorUserId, "INVITATION_CANCELLED", null, null, new { inviteeEmail = invite.InviteeEmail });

        await _context.SaveChangesAsync(cancellationToken);
    }
}
