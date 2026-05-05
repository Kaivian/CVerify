using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Admin.DTOs;
using CVerify.API.Modules.Admin.Services;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Security.Authorization.Attributes;

namespace CVerify.API.Modules.Admin.Controllers;

[ApiController]
[Route("api/admin/roles")]
public class RolesAdminController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IAdminAuthorizationService _adminAuthService;

    public RolesAdminController(ApplicationDbContext context, IAdminAuthorizationService adminAuthService)
    {
        _context = context;
        _adminAuthService = adminAuthService;
    }

    private async Task<string?> ValidateParentRoleAsync(Guid? parentRoleId, Guid? currentRoleId, CancellationToken cancellationToken)
    {
        if (parentRoleId == null) return null;

        if (currentRoleId.HasValue && parentRoleId.Value == currentRoleId.Value)
        {
            return "A role cannot be its own parent.";
        }

        var parent = await _context.AdminRoles
            .Include(r => r.ParentRole)
            .FirstOrDefaultAsync(r => r.Id == parentRoleId.Value, cancellationToken);

        if (parent == null)
        {
            return "The specified parent role does not exist.";
        }

        if (!parent.IsActive)
        {
            return "The specified parent role is inactive.";
        }

        // Rule: Parent cannot itself have a parent (no grandparent, depth 1 max)
        if (parent.ParentRoleId.HasValue)
        {
            return "Multi-level role inheritance is forbidden (maximum depth of 1). The parent role already inherits from another role.";
        }

        // Rule: If currentRoleId is specified, this role must not have any child roles (otherwise changing parent would create depth 2)
        if (currentRoleId.HasValue)
        {
            var hasChildren = await _context.AdminRoles.AnyAsync(r => r.ParentRoleId == currentRoleId.Value, cancellationToken);
            if (hasChildren)
            {
                return "This role cannot inherit from another role because it is already a parent to child roles.";
            }
        }

        return null;
    }

    [HttpGet]
    [HasPermission("admin:roles:view")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(IEnumerable<RoleListItemDto>))]
    public async Task<IActionResult> GetRoles(CancellationToken cancellationToken)
    {
        var roles = await _context.AdminRoles
            .Include(r => r.RolePermissions)
                .ThenInclude(rp => rp.Permission)
            .OrderBy(r => r.Name)
            .ToListAsync(cancellationToken);

        var dtos = roles.Select(r => new RoleListItemDto(
            r.Id,
            r.Name,
            r.DisplayName,
            r.Description,
            r.IsSystem,
            r.IsActive,
            r.ParentRoleId,
            r.RolePermissions.Select(rp => rp.Permission.Name).ToList(),
            r.Version
        ));

        return Ok(dtos);
    }

    [HttpGet("{id:guid}")]
    [HasPermission("admin:roles:view")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(RoleListItemDto))]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetRole(Guid id, CancellationToken cancellationToken)
    {
        var role = await _context.AdminRoles
            .Include(r => r.RolePermissions)
                .ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

        if (role == null)
        {
            return NotFound(new { message = "Role not found" });
        }

        var dto = new RoleListItemDto(
            role.Id,
            role.Name,
            role.DisplayName,
            role.Description,
            role.IsSystem,
            role.IsActive,
            role.ParentRoleId,
            role.RolePermissions.Select(rp => rp.Permission.Name).ToList(),
            role.Version
        );

        return Ok(dto);
    }

    [HttpPost]
    [HasPermission("admin:roles:manage")]
    [ProducesResponseType(StatusCodes.Status201Created, Type = typeof(RoleListItemDto))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateRole([FromBody] CreateOrUpdateRoleDto dto, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
        {
            return BadRequest(new { message = "Role name is required." });
        }

        var normalizedName = dto.Name.Trim().ToUpperInvariant().Replace(" ", "_");
        if (normalizedName.Length > 50)
        {
            return BadRequest(new { message = "Role name (slug) cannot exceed 50 characters." });
        }

        if (string.IsNullOrWhiteSpace(dto.DisplayName))
        {
            return BadRequest(new { message = "Display name is required." });
        }

        if (dto.DisplayName.Length > 100)
        {
            return BadRequest(new { message = "Display name cannot exceed 100 characters." });
        }

        if (dto.Description != null && dto.Description.Length > 250)
        {
            return BadRequest(new { message = "Description cannot exceed 250 characters." });
        }

        if (await _context.AdminRoles.AnyAsync(r => r.Name == normalizedName, cancellationToken))
        {
            return BadRequest(new { message = $"Role '{normalizedName}' already exists." });
        }

        // Validate parent role (inheritance depth limit of 1)
        var inheritanceError = await ValidateParentRoleAsync(dto.ParentRoleId, null, cancellationToken);
        if (inheritanceError != null)
        {
            return BadRequest(new { message = inheritanceError });
        }

        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var role = new AdminRole
            {
                Id = Guid.CreateVersion7(),
                Name = normalizedName,
                DisplayName = dto.DisplayName,
                Description = dto.Description,
                ParentRoleId = dto.ParentRoleId,
                IsSystem = false,
                IsActive = true,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };

            _context.AdminRoles.Add(role);
            await _context.SaveChangesAsync(cancellationToken);

            if (dto.Permissions != null && dto.Permissions.Count > 0)
            {
                var permissions = await _context.Permissions
                    .Where(p => dto.Permissions.Contains(p.Name))
                    .ToListAsync(cancellationToken);

                foreach (var p in permissions)
                {
                    _context.AdminRolePermissions.Add(new AdminRolePermission
                    {
                        RoleId = role.Id,
                        PermissionId = p.Id,
                        AssignedAt = DateTimeOffset.UtcNow
                    });
                }

                await _context.SaveChangesAsync(cancellationToken);
            }

            await transaction.CommitAsync(cancellationToken);

            return CreatedAtAction(nameof(GetRole), new { id = role.Id }, new RoleListItemDto(
                role.Id,
                role.Name,
                role.DisplayName,
                role.Description,
                role.IsSystem,
                role.IsActive,
                role.ParentRoleId,
                dto.Permissions ?? new List<string>(),
                role.Version
            ));
        }
        catch (Exception)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    [HttpPut("{id:guid}")]
    [HasPermission("admin:roles:manage")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(RoleListItemDto))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> UpdateRole(Guid id, [FromBody] CreateOrUpdateRoleDto dto, CancellationToken cancellationToken)
    {
        var role = await _context.AdminRoles
            .Include(r => r.RolePermissions)
                .ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

        if (role == null)
        {
            return NotFound(new { message = "Role not found" });
        }

        if (dto.Version.HasValue && role.Version != dto.Version.Value)
        {
            return StatusCode(StatusCodes.Status409Conflict, new { message = "This role was modified by another administrator. Please refresh and try again." });
        }

        if (role.IsSystem)
        {
            dto = dto with { Name = role.Name };
        }

        var normalizedName = dto.Name.Trim().ToUpperInvariant().Replace(" ", "_");
        if (normalizedName.Length > 50)
        {
            return BadRequest(new { message = "Role name (slug) cannot exceed 50 characters." });
        }

        if (string.IsNullOrWhiteSpace(dto.DisplayName))
        {
            return BadRequest(new { message = "Display name is required." });
        }

        if (dto.DisplayName.Length > 100)
        {
            return BadRequest(new { message = "Display name cannot exceed 100 characters." });
        }

        if (dto.Description != null && dto.Description.Length > 250)
        {
            return BadRequest(new { message = "Description cannot exceed 250 characters." });
        }

        // Validate parent role (inheritance depth limit of 1)
        var inheritanceError = await ValidateParentRoleAsync(dto.ParentRoleId, id, cancellationToken);
        if (inheritanceError != null)
        {
            return BadRequest(new { message = inheritanceError });
        }

        var oldPermissionNames = role.RolePermissions.Select(rp => rp.Permission.Name).ToList();

        role.DisplayName = dto.DisplayName;
        role.Description = dto.Description;
        role.ParentRoleId = dto.ParentRoleId;
        role.UpdatedAt = DateTimeOffset.UtcNow;

        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            // Remove existing permissions
            _context.AdminRolePermissions.RemoveRange(role.RolePermissions);
            await _context.SaveChangesAsync(cancellationToken);

            // Add new permissions
            if (dto.Permissions != null && dto.Permissions.Count > 0)
            {
                var permissions = await _context.Permissions
                    .Where(p => dto.Permissions.Contains(p.Name))
                    .ToListAsync(cancellationToken);

                foreach (var p in permissions)
                {
                    _context.AdminRolePermissions.Add(new AdminRolePermission
                    {
                        RoleId = role.Id,
                        PermissionId = p.Id,
                        AssignedAt = DateTimeOffset.UtcNow
                    });
                }

                await _context.SaveChangesAsync(cancellationToken);
            }

            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            await transaction.RollbackAsync(cancellationToken);
            return StatusCode(StatusCodes.Status409Conflict, new { message = "Concurrency conflict: This role has been updated by another user." });
        }

        // Check if permissions or active status changed
        var isPermissionsChanged = !oldPermissionNames.OrderBy(p => p).SequenceEqual((dto.Permissions ?? new List<string>()).OrderBy(p => p));

        if (isPermissionsChanged)
        {
            var affectedMembers = await _context.AdminRoleAssignments
                .Where(ra => ra.RoleId == role.Id)
                .Include(ra => ra.AdminMember)
                .ToListAsync(cancellationToken);

            foreach (var ra in affectedMembers)
            {
                await _adminAuthService.InvalidateCacheAsync(ra.AdminMember.UserId);
                ra.AdminMember.SessionVersion += 1;
                ra.AdminMember.UpdatedAt = DateTimeOffset.UtcNow;
            }

            await _context.SaveChangesAsync(cancellationToken);
        }

        return Ok(new RoleListItemDto(
            role.Id,
            role.Name,
            role.DisplayName,
            role.Description,
            role.IsSystem,
            role.IsActive,
            role.ParentRoleId,
            dto.Permissions ?? new List<string>(),
            role.Version
        ));
    }

    [HttpDelete("{id:guid}")]
    [HasPermission("admin:roles:manage")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteRole(Guid id, CancellationToken cancellationToken)
    {
        var role = await _context.AdminRoles.FindAsync(new object[] { id }, cancellationToken);
        if (role == null)
        {
            return NotFound(new { message = "Role not found" });
        }

        if (role.IsSystem)
        {
            return BadRequest(new { message = "System critical roles cannot be deleted." });
        }

        var isRoleAssigned = await _context.AdminRoleAssignments.AnyAsync(ra => ra.RoleId == id, cancellationToken);
        if (isRoleAssigned)
        {
            return BadRequest(new { message = "Cannot delete this role because it is currently assigned to users. Re-assign those users first." });
        }

        _context.AdminRoles.Remove(role);
        await _context.SaveChangesAsync(cancellationToken);

        return Ok(new { message = "Role successfully deleted." });
    }
}
