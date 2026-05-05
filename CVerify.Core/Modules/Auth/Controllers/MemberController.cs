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
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Exceptions;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.Modules.Auth.Controllers;

[ApiController]
[Route("api/organizations/{orgSlug}/members")]
[Authorize]
public class MemberController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IOrganizationAuthorizationService _authService;
    private readonly IBusinessRoleService _roleService;
    private readonly ICacheService _cacheService;

    public MemberController(
        ApplicationDbContext context,
        IOrganizationAuthorizationService authService,
        IBusinessRoleService roleService,
        ICacheService cacheService)
    {
        _context = context;
        _authService = authService;
        _roleService = roleService;
        _cacheService = cacheService;
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

        var actorTypeClaim = User.FindFirst("actor_type")?.Value;
        bool isBusiness = string.Equals(actorTypeClaim, "business", StringComparison.OrdinalIgnoreCase);

        if (isBusiness)
        {
            if (org.Id != userId)
            {
                return (Guid.Empty, null, Forbid());
            }
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
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(PaginatedOrganizationMembersResponseDto))]
    public async Task<IActionResult> GetMembers(
        string orgSlug,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery] Guid? roleId = null,
        CancellationToken cancellationToken = default)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;

        var (orgId, _, error) = await ValidateAndResolveAsync(orgSlug, "organization:members:view");
        if (error != null) return error;

        var query = _context.OrganizationMemberships
            .Where(om => om.OrganizationId == orgId)
            .Include(om => om.User)
            .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLowerInvariant();
            query = query.Where(om =>
                om.User.FullName.ToLower().Contains(searchLower) ||
                om.User.Email.ToLower().Contains(searchLower)
            );
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            var statusLower = status.Trim().ToLowerInvariant();
            query = query.Where(om => om.Status.ToLower() == statusLower);
        }

        if (roleId.HasValue)
        {
            // Filter by users holding this business role
            var userIdsWithRole = _context.OrganizationRoleAssignments
                .Where(ra => ra.OrganizationId == orgId && ra.RoleId == roleId.Value)
                .Select(ra => ra.UserId);

            query = query.Where(om => userIdsWithRole.Contains(om.UserId));
        }

        var totalItems = await query.CountAsync(cancellationToken);

        var memberships = await query
            .OrderBy(om => om.User.FullName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        // Fetch roles for all fetched users in batch
        var userIds = memberships.Select(m => m.UserId).ToList();
        var assignments = await _context.OrganizationRoleAssignments
            .Where(ra => ra.OrganizationId == orgId && userIds.Contains(ra.UserId))
            .Include(ra => ra.Role)
            .ToListAsync(cancellationToken);

        // Fetch workspaces to resolve names
        var workspaceIds = assignments
            .Where(ra => ra.ScopeType == "WORKSPACE")
            .Select(ra => ra.ScopeId)
            .Distinct()
            .ToList();

        var workspaces = await _context.Workspaces
            .Where(w => workspaceIds.Contains(w.Id))
            .ToDictionaryAsync(w => w.Id, w => w.DisplayName, cancellationToken);

        var resultItems = new List<MemberDetailsDto>();
        foreach (var mem in memberships)
        {
            var userRoles = assignments
                .Where(ra => ra.UserId == mem.UserId)
                .Select(ra => new MemberRoleDto(
                    ra.RoleId,
                    ra.Role.Name,
                    ra.Role.DisplayName,
                    ra.ScopeType,
                    ra.ScopeId,
                    ra.ScopeType == "ORGANIZATION" ? "Global Organization" : workspaces.GetValueOrDefault(ra.ScopeId, "Unknown Workspace")
                )).ToList();

            // Resolve Identity verification status (UserStatus ACTIVE / EMAIL_VERIFY_PENDING)
            var idStatus = mem.User.Status == UserStatus.ACTIVE ? "Verified" : "Unverified";

            resultItems.Add(new MemberDetailsDto(
                mem.UserId,
                mem.User.FullName,
                mem.User.Email,
                idStatus,
                null, // Trust score can be wired later
                mem.Status,
                mem.JoinedAt,
                userRoles
            ));
        }

        return Ok(new PaginatedOrganizationMembersResponseDto(resultItems, totalItems, page, pageSize));
    }

    [HttpPut("{memberId}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> UpdateMember(
        string orgSlug,
        Guid memberId,
        [FromBody] UpdateMemberDto dto,
        CancellationToken cancellationToken)
    {
        var (orgId, actorUserId, error) = await ValidateAndResolveAsync(orgSlug, "organization:members:manage");
        if (error != null) return error;

        var membership = await _context.OrganizationMemberships
            .FirstOrDefaultAsync(om => om.OrganizationId == orgId && om.UserId == memberId, cancellationToken);

        if (membership == null)
        {
            return NotFound(new { message = "Member not found" });
        }

        var newStatus = dto.Status.Trim().ToLowerInvariant();
        if (newStatus != "active" && newStatus != "suspended" && newStatus != "disabled")
        {
            return BadRequest(new { message = "Invalid membership status." });
        }

        // Owner protection: cannot suspend the last active Owner
        if (newStatus == "suspended" || newStatus == "disabled")
        {
            var isOwner = await _context.OrganizationRoleAssignments
                .Include(ra => ra.Role)
                .AnyAsync(ra => ra.OrganizationId == orgId && ra.UserId == memberId && ra.Role.Name == "owner", cancellationToken);

            if (isOwner)
            {
                var activeOwnerCount = await _context.OrganizationRoleAssignments
                    .Include(ra => ra.Role)
                    .Join(_context.OrganizationMemberships,
                        ra => new { ra.OrganizationId, ra.UserId },
                        om => new { om.OrganizationId, om.UserId },
                        (ra, om) => new { ra, om })
                    .CountAsync(x => x.ra.OrganizationId == orgId && x.ra.Role.Name == "owner" && x.om.Status == "active", cancellationToken);

                if (activeOwnerCount <= 1)
                {
                    return BadRequest(new { message = "Cannot modify this member's status because they are the last active Owner in the organization." });
                }
            }
        }

        membership.Status = newStatus;
        await _context.SaveChangesAsync(cancellationToken);

        // Invalidate permissions cache
        var cacheKey = $"auth:org:{orgId}:user:{memberId}:scoped_perms";
        await _cacheService.DeleteAsync(cacheKey);

        // Audit Log
        var log = new BusinessRoleAuditLog
        {
            Id = Guid.CreateVersion7(),
            OrganizationId = orgId,
            ActorUserId = actorUserId,
            Action = newStatus == "suspended" ? "MEMBER_SUSPENDED" : "MEMBER_ACTIVATED",
            TargetRoleName = "Multiple",
            TargetUserId = memberId,
            ScopeType = "ORGANIZATION",
            ScopeId = orgId,
            DetailsJson = null,
            Timestamp = DateTimeOffset.UtcNow
        };
        _context.BusinessRoleAuditLogs.Add(log);
        await _context.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    [HttpDelete("{memberId}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> RemoveMember(
        string orgSlug,
        Guid memberId,
        CancellationToken cancellationToken)
    {
        var (orgId, actorUserId, error) = await ValidateAndResolveAsync(orgSlug, "organization:members:manage");
        if (error != null) return error;

        var membership = await _context.OrganizationMemberships
            .FirstOrDefaultAsync(om => om.OrganizationId == orgId && om.UserId == memberId, cancellationToken);

        if (membership == null)
        {
            return NotFound(new { message = "Member not found" });
        }

        // Owner protection: cannot remove the last Owner
        var isOwner = await _context.OrganizationRoleAssignments
            .Include(ra => ra.Role)
            .AnyAsync(ra => ra.OrganizationId == orgId && ra.UserId == memberId && ra.Role.Name == "owner", cancellationToken);

        if (isOwner)
        {
            var ownerCount = await _context.OrganizationRoleAssignments
                .Include(ra => ra.Role)
                .CountAsync(ra => ra.OrganizationId == orgId && ra.Role.Name == "owner", cancellationToken);

            if (ownerCount <= 1)
            {
                return BadRequest(new { message = "Cannot remove this member because they are the last Owner of the organization." });
            }
        }

        // Delete all role assignments in transaction
        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var assignments = await _context.OrganizationRoleAssignments
                .Where(ra => ra.OrganizationId == orgId && ra.UserId == memberId)
                .ToListAsync(cancellationToken);

            _context.OrganizationRoleAssignments.RemoveRange(assignments);
            _context.OrganizationMemberships.Remove(membership);

            // Also remove from workspaces
            var workspaces = await _context.Workspaces.Where(w => w.OrganizationId == orgId).Select(w => w.Id).ToListAsync(cancellationToken);
            var workspaceMemberships = await _context.WorkspaceMembers
                .Where(wm => wm.UserId == memberId && workspaces.Contains(wm.WorkspaceId))
                .ToListAsync(cancellationToken);
            _context.WorkspaceMembers.RemoveRange(workspaceMemberships);

            // Audit Log
            var log = new BusinessRoleAuditLog
            {
                Id = Guid.CreateVersion7(),
                OrganizationId = orgId,
                ActorUserId = actorUserId,
                Action = "MEMBER_REMOVED",
                TargetRoleName = "Multiple",
                TargetUserId = memberId,
                ScopeType = "ORGANIZATION",
                ScopeId = orgId,
                Timestamp = DateTimeOffset.UtcNow
            };
            _context.BusinessRoleAuditLogs.Add(log);

            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            // Invalidate permissions cache
            var cacheKey = $"auth:org:{orgId}:user:{memberId}:scoped_perms";
            await _cacheService.DeleteAsync(cacheKey);
        }
        catch (Exception)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }

        return NoContent();
    }
}
