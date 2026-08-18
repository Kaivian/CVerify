using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.Admin.DTOs;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Exceptions;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.System.DTOs;

namespace CVerify.API.Modules.Admin.Services;

public class UserAdministrationService : IUserAdministrationService
{
    private readonly ApplicationDbContext _context;
    private readonly IAdminAuthorizationService _authService;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<UserAdministrationService> _logger;

    public UserAdministrationService(
        ApplicationDbContext context,
        IAdminAuthorizationService authService,
        TimeProvider timeProvider,
        ILogger<UserAdministrationService> logger)
    {
        _context = context;
        _authService = authService;
        _timeProvider = timeProvider;
        _logger = logger;
    }

    public async Task<PaginatedResultDto<UserListItemDto>> GetPlatformUsersAsync(
        string? search, string? status, string? roleName, int page, int pageSize, CancellationToken cancellationToken)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 20;

        var query = _context.Users
            .AsNoTracking()
            .Where(u => u.DeletedAt == null);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.Trim().ToLowerInvariant();
            query = query.Where(u =>
                u.Email.ToLower().Contains(searchLower) ||
                u.FullName.ToLower().Contains(searchLower)
            );
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            var statusStr = status.Trim();
            if (Enum.TryParse<UserStatus>(statusStr, true, out var parsedStatus))
            {
                query = query.Where(u => u.Status == parsedStatus);
            }
        }

        if (!string.IsNullOrWhiteSpace(roleName))
        {
            var roleLower = roleName.Trim().ToLowerInvariant();
            query = query.Where(u =>
                u.RoleAssignments.Any(ra => ra.Role.Name.ToLower() == roleLower) ||
                u.Roles.Any(r => r.Name.ToLower() == roleLower)
            );
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(u => u.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new UserListItemDto(
                u.Id,
                u.Email,
                u.FullName,
                u.Status.ToString(),
                u.LastLoginAt,
                u.RoleAssignments
                    .Select(ra => ra.Role.Name)
                    .Concat(u.Roles.Select(r => r.Name))
                    .Distinct()
                    .ToList(),
                u.SessionVersion,
                u.CreatedAt
            ))
            .ToListAsync(cancellationToken);

        return new PaginatedResultDto<UserListItemDto>(items, totalCount, page, pageSize);
    }

    public async Task<UserListItemDto> GetPlatformUserByIdAsync(Guid userId, CancellationToken cancellationToken)
    {
        var userDto = await _context.Users
            .AsNoTracking()
            .Where(u => u.Id == userId && u.DeletedAt == null)
            .Select(u => new UserListItemDto(
                u.Id,
                u.Email,
                u.FullName,
                u.Status.ToString(),
                u.LastLoginAt,
                u.RoleAssignments
                    .Select(ra => ra.Role.Name)
                    .Concat(u.Roles.Select(r => r.Name))
                    .Distinct()
                    .ToList(),
                u.SessionVersion,
                u.CreatedAt
            ))
            .FirstOrDefaultAsync(cancellationToken);

        if (userDto == null)
        {
            throw new ValidationException($"Platform user with ID {userId} was not found.");
        }

        return userDto;
    }

    public async Task<UserListItemDto> UpdatePlatformUserStatusAndRolesAsync(
        Guid actorUserId, Guid targetUserId, UpdateUserDto dto, CancellationToken cancellationToken)
    {
        if (actorUserId == targetUserId)
        {
            throw new ValidationException("You cannot modify your own administrative account status or system roles.");
        }

        var user = await _context.Users
            .Include(u => u.RoleAssignments)
                .ThenInclude(ra => ra.Role)
            .FirstOrDefaultAsync(u => u.Id == targetUserId && u.DeletedAt == null, cancellationToken);

        if (user == null)
        {
            throw new ValidationException($"Platform user with ID {targetUserId} was not found.");
        }

        var oldStatus = user.Status;
        UserStatus targetStatus = oldStatus;
        if (!string.IsNullOrWhiteSpace(dto.Status) && Enum.TryParse<UserStatus>(dto.Status, true, out var parsedStatus))
        {
            targetStatus = parsedStatus;
        }

        var isSuperAdmin = user.RoleAssignments.Any(ra => ra.ScopeType == "SYSTEM" && ra.Role.Name == "SUPER_ADMIN");
        var willBeSuperAdmin = dto.Roles != null && dto.Roles.Contains("SUPER_ADMIN");
        var isDeactivating = targetStatus == UserStatus.SUSPENDED || targetStatus == UserStatus.BANNED || targetStatus == UserStatus.DELETED;

        if (isSuperAdmin && (isDeactivating || !willBeSuperAdmin))
        {
            var activeSuperAdminCount = await _context.RoleAssignments
                .Include(ra => ra.Role)
                .CountAsync(ra => ra.ScopeType == "SYSTEM" && ra.Role.Name == "SUPER_ADMIN" &&
                    _context.Users.Any(u => u.Id == ra.UserId && u.Status == UserStatus.ACTIVE && u.DeletedAt == null), cancellationToken);

            if (activeSuperAdminCount <= 1)
            {
                throw new ValidationException("Cannot modify or deactivate this user because they are the last active Super Administrator in the system.");
            }
        }

        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            // Execute domain state machine transition if status changed
            if (oldStatus != targetStatus)
            {
                user.TransitionTo(targetStatus);
            }

            // Sync SYSTEM domain role assignments
            if (dto.Roles != null && dto.Roles.Any())
            {
                var requestedRoles = await _context.Roles
                    .Where(r => dto.Roles.Contains(r.Name) && r.Domain == "SYSTEM" && r.IsActive)
                    .ToListAsync(cancellationToken);

                var currentSystemAssignments = user.RoleAssignments.Where(ra => ra.ScopeType == "SYSTEM").ToList();
                _context.RoleAssignments.RemoveRange(currentSystemAssignments);

                foreach (var role in requestedRoles)
                {
                    _context.RoleAssignments.Add(new RoleAssignment
                    {
                        Id = Guid.CreateVersion7(),
                        UserId = user.Id,
                        RoleId = role.Id,
                        ScopeType = "SYSTEM",
                        ScopeId = Guid.Empty,
                        AssignedAt = _timeProvider.GetUtcNow()
                    });
                }
            }

            // Increment session version to force token & session invalidation
            user.SessionVersion += 1;
            user.UpdatedAt = _timeProvider.GetUtcNow();

            // Sync AdminMember status if an entry exists
            var adminMember = await _context.AdminMembers.FirstOrDefaultAsync(am => am.UserId == targetUserId, cancellationToken);
            if (adminMember != null)
            {
                adminMember.Status = targetStatus.ToString();
                adminMember.SessionVersion += 1;
                adminMember.UpdatedAt = _timeProvider.GetUtcNow();
            }

            // Create structured audit log
            var auditLog = new AuditLog
            {
                Id = Guid.CreateVersion7(),
                ActorUserId = actorUserId,
                UserId = actorUserId,
                TargetUserId = targetUserId,
                EventType = "USER_PROFILE_UPDATED",
                Category = AuditCategory.IdentityAndAccess,
                Description = $"User {user.Email} status updated from {oldStatus} to {targetStatus}.",
                DetailsJson = JsonSerializer.Serialize(new
                {
                    oldStatus = oldStatus.ToString(),
                    newStatus = targetStatus.ToString(),
                    roles = dto.Roles,
                    sessionVersion = user.SessionVersion
                }),
                CreatedAt = _timeProvider.GetUtcNow()
            };
            _context.AuditLogs.Add(auditLog);

            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            await _authService.InvalidateCacheAsync(user.Id);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            _logger.LogError(ex, "Failed to update platform user {UserId}", targetUserId);
            throw;
        }

        return await GetPlatformUserByIdAsync(targetUserId, cancellationToken);
    }

    public async Task DeletePlatformUserAsync(Guid actorUserId, Guid targetUserId, CancellationToken cancellationToken)
    {
        if (actorUserId == targetUserId)
        {
            throw new ValidationException("You cannot delete your own administrative user account.");
        }

        var user = await _context.Users
            .Include(u => u.RoleAssignments)
                .ThenInclude(ra => ra.Role)
            .FirstOrDefaultAsync(u => u.Id == targetUserId && u.DeletedAt == null, cancellationToken);

        if (user == null)
        {
            throw new ValidationException($"Platform user with ID {targetUserId} was not found.");
        }

        var isSuperAdmin = user.RoleAssignments.Any(ra => ra.ScopeType == "SYSTEM" && ra.Role.Name == "SUPER_ADMIN");
        if (isSuperAdmin)
        {
            var activeSuperAdminCount = await _context.RoleAssignments
                .Include(ra => ra.Role)
                .CountAsync(ra => ra.ScopeType == "SYSTEM" && ra.Role.Name == "SUPER_ADMIN" &&
                    _context.Users.Any(u => u.Id == ra.UserId && u.Status == UserStatus.ACTIVE && u.DeletedAt == null), cancellationToken);

            if (activeSuperAdminCount <= 1)
            {
                throw new ValidationException("Cannot delete this user because they are the last active Super Administrator in the system.");
            }
        }

        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var utcNow = _timeProvider.GetUtcNow();
            user.TransitionTo(UserStatus.DELETED);
            user.DeletedAt = utcNow;
            user.SessionVersion += 1;
            user.UpdatedAt = utcNow;

            var adminMember = await _context.AdminMembers.FirstOrDefaultAsync(am => am.UserId == targetUserId, cancellationToken);
            if (adminMember != null)
            {
                _context.AdminMembers.Remove(adminMember);
            }

            var auditLog = new AuditLog
            {
                Id = Guid.CreateVersion7(),
                ActorUserId = actorUserId,
                UserId = actorUserId,
                TargetUserId = targetUserId,
                EventType = "USER_DELETED",
                Category = AuditCategory.IdentityAndAccess,
                Description = $"User {user.Email} was soft deleted by administrator.",
                DetailsJson = JsonSerializer.Serialize(new { email = user.Email, deletedAt = utcNow }),
                CreatedAt = utcNow
            };
            _context.AuditLogs.Add(auditLog);

            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            await _authService.InvalidateCacheAsync(user.Id);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            _logger.LogError(ex, "Failed to delete platform user {UserId}", targetUserId);
            throw;
        }
    }
}
