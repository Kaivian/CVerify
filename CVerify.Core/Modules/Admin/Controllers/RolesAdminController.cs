
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Admin.DTOs;
using CVerify.API.Modules.Auth.Services;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.Modules.Admin.Controllers;

[ApiController]
[Route("api/admin/roles")]
[Authorize(Roles = "SUPER_ADMIN,ADMIN")]
public class RolesAdminController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ICacheService _cacheService;

    public RolesAdminController(ApplicationDbContext context, ICacheService cacheService)
    {
        _context = context;
        _cacheService = cacheService;
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(IEnumerable<RoleListItemDto>))]
    public async Task<IActionResult> GetRoles()
    {
        var roles = await _context.Roles
            .Include(r => r.Permissions)
            .OrderBy(r => r.Name)
            .ToListAsync();

        var dtos = roles.Select(r => new RoleListItemDto(
            r.Id,
            r.Name,
            r.DisplayName,
            r.Description,
            r.IsSystem,
            r.IsActive,
            r.Permissions.Select(p => p.Name).ToList(),
            r.Version
        ));

        return Ok(dtos);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(RoleListItemDto))]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetRole(Guid id)
    {
        var role = await _context.Roles
            .Include(r => r.Permissions)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (role == null) return NotFound(new { message = "Role not found" });

        var dto = new RoleListItemDto(
            role.Id,
            role.Name,
            role.DisplayName,
            role.Description,
            role.IsSystem,
            role.IsActive,
            role.Permissions.Select(p => p.Name).ToList(),
            role.Version
        );

        return Ok(dto);
    }

    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created, Type = typeof(RoleListItemDto))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateRole([FromBody] CreateOrUpdateRoleDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
        {
            return BadRequest(new { message = "Role name is required." });
        }

        var normalizedName = dto.Name.Trim().ToUpperInvariant().Replace(" ", "_");
        if (await _context.Roles.AnyAsync(r => r.Name == normalizedName))
        {
            return BadRequest(new { message = $"Role '{normalizedName}' already exists." });
        }

        var role = new Role
        {
            Name = normalizedName,
            DisplayName = dto.DisplayName,
            Description = dto.Description,
            IsSystem = false,
            IsActive = true
        };

        if (dto.Permissions != null && dto.Permissions.Count > 0)
        {
            var permissions = await _context.Permissions
                .Where(p => dto.Permissions.Contains(p.Name))
                .ToListAsync();
            role.Permissions = permissions;
        }

        _context.Roles.Add(role);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetRole), new { id = role.Id }, new RoleListItemDto(
            role.Id,
            role.Name,
            role.DisplayName,
            role.Description,
            role.IsSystem,
            role.IsActive,
            role.Permissions.Select(p => p.Name).ToList(),
            role.Version
        ));
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(RoleListItemDto))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> UpdateRole(Guid id, [FromBody] CreateOrUpdateRoleDto dto)
    {
        var role = await _context.Roles
            .Include(r => r.Permissions)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (role == null) return NotFound(new { message = "Role not found" });

        // Enforce concurrency version token match if provided
        if (dto.Version.HasValue && role.Version != dto.Version.Value)
        {
            return StatusCode(StatusCodes.Status409Conflict, new { message = "This role was modified by another administrator. Please refresh and try again." });
        }

        // Lock critical system fields
        if (role.IsSystem)
        {
            // System roles cannot change names
            dto = dto with { Name = role.Name };
        }

        var oldPermissionNames = role.Permissions.Select(p => p.Name).ToList();

        role.DisplayName = dto.DisplayName;
        role.Description = dto.Description;
        role.UpdatedAt = DateTimeOffset.UtcNow;

        if (dto.Permissions != null)
        {
            var permissions = await _context.Permissions
                .Where(p => dto.Permissions.Contains(p.Name))
                .ToListAsync();
            role.Permissions = permissions;
        }

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            return StatusCode(StatusCodes.Status409Conflict, new { message = "Concurrency conflict: This role has been updated by another user." });
        }

        // If permissions changed, invalidate user permissions caches and session versions
        var newPermissionNames = role.Permissions.Select(p => p.Name).ToList();
        var isPermissionsChanged = !oldPermissionNames.OrderBy(p => p).SequenceEqual(newPermissionNames.OrderBy(p => p));

        if (isPermissionsChanged)
        {
            var userIds = await _context.Users
                .Where(u => u.Roles.Any(r => r.Id == role.Id))
                .Select(u => u.Id)
                .ToListAsync();

            foreach (var userId in userIds)
            {
                // Invalidate permission cache
                var permCacheKey = $"auth:user:{userId}:permissions";
                await _cacheService.RemoveAsync(permCacheKey);

                // Increment user session version to trigger dynamic middleware token invalidation
                var user = await _context.Users.FindAsync(userId);
                if (user != null)
                {
                    user.SessionVersion += 1;
                    user.UpdatedAt = DateTimeOffset.UtcNow;
                    var sessCacheKey = $"auth:user:{userId}:session_version";
                    await _cacheService.RemoveAsync(sessCacheKey);
                }
            }
            await _context.SaveChangesAsync();
        }

        return Ok(new RoleListItemDto(
            role.Id,
            role.Name,
            role.DisplayName,
            role.Description,
            role.IsSystem,
            role.IsActive,
            role.Permissions.Select(p => p.Name).ToList(),
            role.Version
        ));
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteRole(Guid id)
    {
        var role = await _context.Roles.FindAsync(id);
        if (role == null) return NotFound(new { message = "Role not found" });

        if (role.IsSystem)
        {
            return BadRequest(new { message = "System critical roles cannot be deleted." });
        }

        var isRoleAssigned = await _context.Users.AnyAsync(u => u.Roles.Any(r => r.Id == id));
        if (isRoleAssigned)
        {
            return BadRequest(new { message = "Cannot delete this role because it is currently assigned to users. Re-assign those users first." });
        }

        _context.Roles.Remove(role);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Role successfully deleted." });
    }
}
