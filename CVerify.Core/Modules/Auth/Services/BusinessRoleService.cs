using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Auth.DTOs;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Exceptions;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.Modules.Auth.Services;

public class BusinessRoleService : IBusinessRoleService
{
    private readonly ApplicationDbContext _context;
    private readonly ICacheService _cacheService;

    public BusinessRoleService(ApplicationDbContext context, ICacheService cacheService)
    {
        _context = context;
        _cacheService = cacheService;
    }

    public async Task<List<BusinessRoleDetailsDto>> GetRolesAsync(Guid orgId, CancellationToken cancellationToken)
    {
        var roles = await _context.OrganizationBusinessRoles
            .Where(r => r.OrganizationId == orgId && r.IsActive)
            .Include(r => r.ParentRole)
            .Include(r => r.RolePermissions)
                .ThenInclude(rp => rp.Permission)
            .ToListAsync(cancellationToken);

        var assignments = await _context.OrganizationRoleAssignments
            .Where(ra => ra.OrganizationId == orgId)
            .GroupBy(ra => ra.RoleId)
            .Select(g => new { RoleId = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        var memberCounts = assignments.ToDictionary(a => a.RoleId, a => a.Count);

        return roles.Select(r => new BusinessRoleDetailsDto(
            r.Id,
            r.Name,
            r.DisplayName,
            r.Description,
            r.ParentRoleId,
            r.ParentRole?.DisplayName,
            r.IsSystem,
            r.IsActive,
            memberCounts.GetValueOrDefault(r.Id, 0),
            r.RolePermissions.Select(rp => rp.Permission.Name).ToList(),
            r.CreatedAt
        )).ToList();
    }

    public async Task<Guid> CreateRoleAsync(Guid orgId, Guid? actorUserId, CreateBusinessRoleDto dto, CancellationToken cancellationToken)
    {
        var cleanName = dto.Name.Trim().ToLowerInvariant();
        
        var nameExists = await _context.OrganizationBusinessRoles
            .AnyAsync(r => r.OrganizationId == orgId && r.Name == cleanName, cancellationToken);

        if (nameExists)
        {
            throw new ValidationException($"A business role with the identifier '{cleanName}' already exists in this organization.");
        }

        if (dto.ParentRoleId.HasValue)
        {
            await ValidateNoCircularityAsync(Guid.Empty, dto.ParentRoleId, cancellationToken);
        }

        var newRole = new OrganizationBusinessRole
        {
            OrganizationId = orgId,
            Name = cleanName,
            DisplayName = dto.DisplayName.Trim(),
            Description = dto.Description?.Trim(),
            ParentRoleId = dto.ParentRoleId,
            IsSystem = false,
            IsActive = true
        };

        _context.OrganizationBusinessRoles.Add(newRole);

        // Bind permissions
        if (dto.PermissionNames.Any())
        {
            var dbPerms = await _context.BusinessPermissions
                .Where(p => dto.PermissionNames.Contains(p.Name))
                .ToListAsync(cancellationToken);

            foreach (var perm in dbPerms)
            {
                _context.OrganizationRolePermissions.Add(new OrganizationRolePermission
                {
                    Role = newRole,
                    PermissionId = perm.Id
                });
            }
        }

        await LogAuditAsync(orgId, actorUserId, "ROLE_CREATED", newRole.DisplayName, details: new { permissions = dto.PermissionNames, parentId = dto.ParentRoleId });
        await _context.SaveChangesAsync(cancellationToken);

        return newRole.Id;
    }

    public async Task UpdateRoleAsync(Guid orgId, Guid? actorUserId, Guid roleId, CreateBusinessRoleDto dto, CancellationToken cancellationToken)
    {
        var role = await _context.OrganizationBusinessRoles
            .FirstOrDefaultAsync(r => r.Id == roleId && r.OrganizationId == orgId, cancellationToken);

        if (role == null)
        {
            throw new ValidationException("Target business role not found.");
        }

        if (role.IsSystem)
        {
            throw new ValidationException("System default business roles cannot be modified.");
        }

        if (dto.ParentRoleId.HasValue)
        {
            await ValidateNoCircularityAsync(roleId, dto.ParentRoleId, cancellationToken);
        }

        role.DisplayName = dto.DisplayName.Trim();
        role.Description = dto.Description?.Trim();
        role.ParentRoleId = dto.ParentRoleId;
        role.UpdatedAt = DateTimeOffset.UtcNow;

        // Sync permissions (delete old mappings and add new ones)
        var oldMappings = await _context.OrganizationRolePermissions
            .Where(rp => rp.RoleId == roleId)
            .ToListAsync(cancellationToken);

        _context.OrganizationRolePermissions.RemoveRange(oldMappings);

        var newPerms = await _context.BusinessPermissions
            .Where(p => dto.PermissionNames.Contains(p.Name))
            .ToListAsync(cancellationToken);

        foreach (var perm in newPerms)
        {
            _context.OrganizationRolePermissions.Add(new OrganizationRolePermission
            {
                RoleId = roleId,
                PermissionId = perm.Id
            });
        }

        await LogAuditAsync(orgId, actorUserId, "ROLE_UPDATED", role.DisplayName, details: new { permissions = dto.PermissionNames, parentId = dto.ParentRoleId });
        await _context.SaveChangesAsync(cancellationToken);

        // Invalidate Redis permissions cache for all members holding this role
        await InvalidateCacheForRoleUsersAsync(orgId, roleId, cancellationToken);
    }

    public async Task DeleteRoleAsync(Guid orgId, Guid? actorUserId, Guid roleId, CancellationToken cancellationToken)
    {
        var role = await _context.OrganizationBusinessRoles
            .FirstOrDefaultAsync(r => r.Id == roleId && r.OrganizationId == orgId, cancellationToken);

        if (role == null)
        {
            throw new ValidationException("Target business role not found.");
        }

        if (role.IsSystem)
        {
            throw new ValidationException("System default business roles cannot be deleted.");
        }

        // Check active assignments
        var hasAssignments = await _context.OrganizationRoleAssignments
            .AnyAsync(ra => ra.RoleId == roleId, cancellationToken);

        if (hasAssignments)
        {
            throw new ValidationException("Cannot delete role because it is currently assigned to one or more members.");
        }

        // Check if role is used as a parent by other roles
        var isParent = await _context.OrganizationBusinessRoles
            .AnyAsync(r => r.ParentRoleId == roleId, cancellationToken);

        if (isParent)
        {
            throw new ValidationException("Cannot delete role because other business roles inherit from it.");
        }

        _context.OrganizationBusinessRoles.Remove(role);

        await LogAuditAsync(orgId, actorUserId, "ROLE_DELETED", role.DisplayName);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<List<RoleAssignmentDto>> GetRoleAssignmentsAsync(Guid orgId, CancellationToken cancellationToken)
    {
        var assignments = await _context.OrganizationRoleAssignments
            .Where(ra => ra.OrganizationId == orgId)
            .Include(ra => ra.User)
            .Include(ra => ra.Role)
            .ToListAsync(cancellationToken);

        // Batch resolve scope names for workspaces
        var workspaceIds = assignments
            .Where(ra => ra.ScopeType == "WORKSPACE")
            .Select(ra => ra.ScopeId)
            .Distinct()
            .ToList();

        var workspaces = await _context.Workspaces
            .Where(w => workspaceIds.Contains(w.Id))
            .ToDictionaryAsync(w => w.Id, w => w.DisplayName, cancellationToken);

        var result = new List<RoleAssignmentDto>();
        foreach (var ra in assignments)
        {
            string scopeName = ra.ScopeType switch
            {
                "ORGANIZATION" => "Global Organization",
                "WORKSPACE" => workspaces.GetValueOrDefault(ra.ScopeId, "Unknown Workspace"),
                _ => $"{ra.ScopeType} ({ra.ScopeId})"
            };

            result.Add(new RoleAssignmentDto(
                ra.Id,
                ra.UserId,
                ra.User.FullName,
                ra.User.Email,
                ra.RoleId,
                ra.Role.DisplayName,
                ra.ScopeType,
                ra.ScopeId,
                scopeName,
                ra.AssignedAt
            ));
        }

        return result;
    }

    public async Task AssignRoleAsync(Guid orgId, Guid? actorUserId, AssignScopedRoleDto dto, CancellationToken cancellationToken)
    {
        // Check if role exists in org
        var role = await _context.OrganizationBusinessRoles
            .FirstOrDefaultAsync(r => r.Id == dto.RoleId && r.OrganizationId == orgId, cancellationToken);

        if (role == null)
        {
            throw new ValidationException("Selected business role was not found.");
        }

        // Validate target member exists in org
        var isMember = await _context.OrganizationMemberships
            .AnyAsync(om => om.OrganizationId == orgId && om.UserId == dto.UserId, cancellationToken);

        if (!isMember)
        {
            throw new ValidationException("Target user is not a member of this organization.");
        }

        // Validate unique assignment constraint
        var scopeTypeNormalized = dto.ScopeType.Trim().ToUpperInvariant();
        var assignmentExists = await _context.OrganizationRoleAssignments
            .AnyAsync(ra => ra.OrganizationId == orgId &&
                            ra.UserId == dto.UserId &&
                            ra.RoleId == dto.RoleId &&
                            ra.ScopeType == scopeTypeNormalized &&
                            ra.ScopeId == dto.ScopeId, cancellationToken);

        if (assignmentExists)
        {
            throw new ValidationException("This role assignment already exists.");
        }

        var assignment = new OrganizationRoleAssignment
        {
            OrganizationId = orgId,
            UserId = dto.UserId,
            RoleId = dto.RoleId,
            ScopeType = scopeTypeNormalized,
            ScopeId = dto.ScopeId
        };

        _context.OrganizationRoleAssignments.Add(assignment);

        await LogAuditAsync(orgId, actorUserId, "ROLE_ASSIGNED", role.DisplayName, targetUserId: dto.UserId, scopeType: scopeTypeNormalized, scopeId: dto.ScopeId);
        await _context.SaveChangesAsync(cancellationToken);

        // Invalidate Redis permissions cache
        await InvalidatePermissionsCacheAsync(orgId, dto.UserId);
    }

    public async Task RevokeRoleAsync(Guid orgId, Guid? actorUserId, AssignScopedRoleDto dto, CancellationToken cancellationToken)
    {
        var scopeTypeNormalized = dto.ScopeType.Trim().ToUpperInvariant();
        
        var assignment = await _context.OrganizationRoleAssignments
            .Include(ra => ra.Role)
            .FirstOrDefaultAsync(ra => ra.OrganizationId == orgId &&
                                       ra.UserId == dto.UserId &&
                                       ra.RoleId == dto.RoleId &&
                                       ra.ScopeType == scopeTypeNormalized &&
                                       ra.ScopeId == dto.ScopeId, cancellationToken);

        if (assignment == null)
        {
            throw new ValidationException("Specified role assignment was not found.");
        }

        // Owner security boundary check: Cannot revoke the last Owner assignment in organization
        if (assignment.Role.Name == "owner")
        {
            var ownerCount = await _context.OrganizationRoleAssignments
                .CountAsync(ra => ra.OrganizationId == orgId && ra.Role.Name == "owner", cancellationToken);
            
            if (ownerCount <= 1)
            {
                throw new ValidationException("Cannot revoke role assignment because organizations must have at least one active Owner.");
            }
        }

        _context.OrganizationRoleAssignments.Remove(assignment);

        await LogAuditAsync(orgId, actorUserId, "ROLE_REVOKED", assignment.Role.DisplayName, targetUserId: dto.UserId, scopeType: scopeTypeNormalized, scopeId: dto.ScopeId);
        await _context.SaveChangesAsync(cancellationToken);

        // Invalidate Redis permissions cache
        await InvalidatePermissionsCacheAsync(orgId, dto.UserId);
    }

    public async Task<PaginatedAuditLogsResponseDto> GetAuditLogsAsync(Guid orgId, int page, int pageSize, CancellationToken cancellationToken)
    {
        var query = _context.BusinessRoleAuditLogs
            .Where(al => al.OrganizationId == orgId)
            .Include(al => al.ActorUser)
            .Include(al => al.TargetUser)
            .AsNoTracking();

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(al => al.Timestamp)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(al => new RoleAuditLogDto(
                al.Id,
                al.ActorUserId,
                al.ActorUser != null ? al.ActorUser.FullName : "Business System",
                al.Action,
                al.TargetRoleName,
                al.TargetUserId,
                al.TargetUser != null ? al.TargetUser.FullName : null,
                al.ScopeType,
                al.ScopeId,
                al.DetailsJson,
                al.Timestamp
            ))
            .ToListAsync(cancellationToken);

        return new PaginatedAuditLogsResponseDto(items, totalCount, page, pageSize);
    }

    public async Task<List<PermissionDto>> GetAvailablePermissionsAsync(CancellationToken cancellationToken)
    {
        var perms = await _context.BusinessPermissions
            .AsNoTracking()
            .OrderBy(p => p.Module)
            .ThenBy(p => p.DisplayName)
            .ToListAsync(cancellationToken);

        return perms.Select(p => new PermissionDto(
            p.Id,
            p.Name,
            p.DisplayName,
            p.Description,
            p.Module
        )).ToList();
    }

    private async Task ValidateNoCircularityAsync(Guid roleId, Guid? parentRoleId, CancellationToken cancellationToken)
    {
        if (!parentRoleId.HasValue) return;
        if (roleId == parentRoleId.Value)
        {
            throw new ValidationException("A business role cannot inherit from itself.");
        }

        var currentParentId = parentRoleId;
        var visited = new HashSet<Guid> { roleId };

        while (currentParentId.HasValue)
        {
            if (visited.Contains(currentParentId.Value))
            {
                throw new ValidationException("Circular inheritance dependency detected in custom business roles.");
            }
            visited.Add(currentParentId.Value);

            var parent = await _context.OrganizationBusinessRoles
                .Where(r => r.Id == currentParentId.Value)
                .Select(r => new { r.ParentRoleId })
                .FirstOrDefaultAsync(cancellationToken);

            currentParentId = parent?.ParentRoleId;
        }
    }

    private async Task LogAuditAsync(
        Guid orgId, 
        Guid? actorUserId, 
        string action, 
        string targetRoleName, 
        Guid? targetUserId = null, 
        string? scopeType = null, 
        Guid? scopeId = null, 
        object? details = null)
    {
        var log = new BusinessRoleAuditLog
        {
            OrganizationId = orgId,
            ActorUserId = actorUserId,
            Action = action,
            TargetRoleName = targetRoleName,
            TargetUserId = targetUserId,
            ScopeType = scopeType,
            ScopeId = scopeId,
            DetailsJson = details != null ? JsonSerializer.Serialize(details) : null,
            Timestamp = DateTimeOffset.UtcNow
        };
        _context.BusinessRoleAuditLogs.Add(log);
    }

    private async Task InvalidatePermissionsCacheAsync(Guid orgId, Guid userId)
    {
        var cacheKey = $"auth:org:{orgId}:user:{userId}:scoped_perms";
        await _cacheService.DeleteAsync(cacheKey);
    }

    private async Task InvalidateCacheForRoleUsersAsync(Guid orgId, Guid roleId, CancellationToken cancellationToken)
    {
        var userIds = await _context.OrganizationRoleAssignments
            .Where(ra => ra.RoleId == roleId && ra.OrganizationId == orgId)
            .Select(ra => ra.UserId)
            .Distinct()
            .ToListAsync(cancellationToken);

        foreach (var uId in userIds)
        {
            await InvalidatePermissionsCacheAsync(orgId, uId);
        }
    }
}
