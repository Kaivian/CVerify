using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Auth.DTOs;
using CVerify.API.Modules.Auth.Services;
using CVerify.API.Modules.Shared.Persistence;

namespace CVerify.API.Modules.Auth.Controllers;

[ApiController]
[Route("api/organizations/{orgSlug}/roles")]
[Authorize]
public class OrganizationRoleController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IOrganizationRoleService _roleService;
    private readonly IOrganizationAuthorizationService _authService;

    public OrganizationRoleController(
        ApplicationDbContext context,
        IOrganizationRoleService roleService,
        IOrganizationAuthorizationService authService)
    {
        _context = context;
        _roleService = roleService;
        _authService = authService;
    }

    private async Task<(Guid OrgId, Guid? UserId, IActionResult? Error)> ValidateAndResolveAsync(string orgSlug, string requiredPermission)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return (Guid.Empty, null, Unauthorized());
        }

        var org = await _context.Organizations
            .FirstOrDefaultAsync(o => o.Username.ToLower() == orgSlug.ToLower() && o.DeletedAt == null);

        if (org == null)
        {
            return (Guid.Empty, null, NotFound(new { message = "Organization not found" }));
        }

        // Check platform actor type (backward compatible with "business" and "organization")
        var actorTypeClaim = User.FindFirst("actor_type")?.Value;
        bool isBusinessOrOrg = string.Equals(actorTypeClaim, "business", StringComparison.OrdinalIgnoreCase) ||
                               string.Equals(actorTypeClaim, "organization", StringComparison.OrdinalIgnoreCase);

        if (isBusinessOrOrg)
        {
            if (org.Id != userId)
            {
                return (Guid.Empty, null, Forbid());
            }
            // Actor is the organization/business account itself, so actorUserId is null.
            return (org.Id, null, null);
        }
        else
        {
            var isAuthorized = await _authService.AuthorizeAsync(userId, org.Id, requiredPermission);
            if (!isAuthorized)
            {
                return (Guid.Empty, null, Forbid());
            }
        }

        return (org.Id, userId, null);
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(List<OrganizationRoleDetailsDto>))]
    public async Task<IActionResult> GetRoles(string orgSlug, CancellationToken cancellationToken)
    {
        var (orgId, _, error) = await ValidateAndResolveAsync(orgSlug, "organization:roles:view");
        if (error != null) return error;

        var roles = await _roleService.GetRolesAsync(orgId, cancellationToken);
        return Ok(roles);
    }

    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created, Type = typeof(Guid))]
    public async Task<IActionResult> CreateRole(string orgSlug, [FromBody] CreateOrganizationRoleDto dto, CancellationToken cancellationToken)
    {
        var (orgId, actorUserId, error) = await ValidateAndResolveAsync(orgSlug, "organization:roles:manage");
        if (error != null) return error;

        var roleId = await _roleService.CreateRoleAsync(orgId, actorUserId, dto, cancellationToken);
        return CreatedAtAction(nameof(GetRoles), new { orgSlug }, roleId);
    }

    [HttpPut("{roleId}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> UpdateRole(string orgSlug, Guid roleId, [FromBody] CreateOrganizationRoleDto dto, CancellationToken cancellationToken)
    {
        var (orgId, actorUserId, error) = await ValidateAndResolveAsync(orgSlug, "organization:roles:manage");
        if (error != null) return error;

        await _roleService.UpdateRoleAsync(orgId, actorUserId, roleId, dto, cancellationToken);
        return NoContent();
    }

    [HttpDelete("{roleId}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DeleteRole(string orgSlug, Guid roleId, CancellationToken cancellationToken)
    {
        var (orgId, actorUserId, error) = await ValidateAndResolveAsync(orgSlug, "organization:roles:manage");
        if (error != null) return error;

        await _roleService.DeleteRoleAsync(orgId, actorUserId, roleId, cancellationToken);
        return NoContent();
    }

    [HttpGet("assignments")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(List<RoleAssignmentDto>))]
    public async Task<IActionResult> GetRoleAssignments(string orgSlug, CancellationToken cancellationToken)
    {
        var (orgId, _, error) = await ValidateAndResolveAsync(orgSlug, "organization:members:view");
        if (error != null) return error;

        var assignments = await _roleService.GetRoleAssignmentsAsync(orgId, cancellationToken);
        return Ok(assignments);
    }

    [HttpPost("assign")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> AssignRole(string orgSlug, [FromBody] AssignScopedRoleDto dto, CancellationToken cancellationToken)
    {
        var (orgId, actorUserId, error) = await ValidateAndResolveAsync(orgSlug, "organization:members:manage");
        if (error != null) return error;

        await _roleService.AssignRoleAsync(orgId, actorUserId, dto, cancellationToken);
        return NoContent();
    }

    [HttpPost("revoke")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> RevokeRole(string orgSlug, [FromBody] AssignScopedRoleDto dto, CancellationToken cancellationToken)
    {
        var (orgId, actorUserId, error) = await ValidateAndResolveAsync(orgSlug, "organization:members:manage");
        if (error != null) return error;

        await _roleService.RevokeRoleAsync(orgId, actorUserId, dto, cancellationToken);
        return NoContent();
    }

    [HttpGet("audit-logs")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(PaginatedAuditLogsResponseDto))]
    public async Task<IActionResult> GetAuditLogs(
        string orgSlug,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken cancellationToken = default)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;

        var (orgId, _, error) = await ValidateAndResolveAsync(orgSlug, "organization:audit:view");
        if (error != null) return error;

        var auditLogs = await _roleService.GetAuditLogsAsync(orgId, page, pageSize, cancellationToken);
        return Ok(auditLogs);
    }

    [HttpGet("permissions")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(List<PermissionDto>))]
    public async Task<IActionResult> GetAvailablePermissions(string orgSlug, CancellationToken cancellationToken)
    {
        var (_, _, error) = await ValidateAndResolveAsync(orgSlug, "organization:roles:view");
        if (error != null) return error;

        var permissions = await _roleService.GetAvailablePermissionsAsync(cancellationToken);
        return Ok(permissions);
    }
}

[Obsolete("Use OrganizationRoleController instead")]
[ApiController]
[Route("api/business/{orgSlug}/roles")]
[Authorize]
public class BusinessRoleController : OrganizationRoleController
{
    public BusinessRoleController(
        ApplicationDbContext context,
        IOrganizationRoleService roleService,
        IOrganizationAuthorizationService authService) : base(context, roleService, authService)
    {
    }
}
