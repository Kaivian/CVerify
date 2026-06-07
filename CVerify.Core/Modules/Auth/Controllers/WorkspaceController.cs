using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Auth.DTOs;
using CVerify.API.Modules.Auth.Services;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Persistence;

namespace CVerify.API.Modules.Auth.Controllers;

[ApiController]
[Route("api/workspace")]
[Authorize]
public class WorkspaceController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IOrganizationAuthorizationService _authorizationService;

    public WorkspaceController(
        ApplicationDbContext context,
        IOrganizationAuthorizationService authorizationService)
    {
        _context = context;
        _authorizationService = authorizationService;
    }

    [HttpGet("my-organizations")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(List<LinkedOrganizationDto>))]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetMyOrganizations()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }

        var actorTypeClaim = User.FindFirst("actor_type")?.Value;
        bool isBusiness = string.Equals(actorTypeClaim, "business", StringComparison.OrdinalIgnoreCase);

        if (isBusiness)
        {
            var org = await _context.Organizations
                .FirstOrDefaultAsync(o => o.Id == userId && o.DeletedAt == null);
            if (org != null)
            {
                return Ok(new List<LinkedOrganizationDto> { new LinkedOrganizationDto(org.Name, org.Username) });
            }
            return Ok(new List<LinkedOrganizationDto>());
        }

        var orgs = await _context.OrganizationMemberships
            .Where(om => om.UserId == userId && om.Status == "active")
            .Include(om => om.Organization)
            .Select(om => new LinkedOrganizationDto(om.Organization.Name, om.Organization.Username))
            .ToListAsync();

        return Ok(orgs);
    }

    [HttpGet("{organizationSlug}")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(WorkspaceDetailsDto))]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetWorkspaceDetails(string organizationSlug)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }

        var org = await _context.Organizations
            .FirstOrDefaultAsync(o => o.Username.ToLower() == organizationSlug.ToLower() && o.DeletedAt == null);

        if (org == null)
        {
            return NotFound(new { message = "Organization not found" });
        }

        var actorTypeClaim = User.FindFirst("actor_type")?.Value;
        bool isBusiness = string.Equals(actorTypeClaim, "business", StringComparison.OrdinalIgnoreCase);

        if (isBusiness)
        {
            if (org.Id != userId)
            {
                return Forbid();
            }

            return Ok(new WorkspaceDetailsDto(
                org.Name,
                org.Username,
                "OWNER",
                new List<LinkedOrganizationDto>()
            ));
        }

        // Authorize membership using the centralized authorization service
        var isAuthorized = await _authorizationService.AuthorizeAsync(userId, org.Id, OrganizationPermissions.ViewWorkspace);
        if (!isAuthorized)
        {
            return Forbid();
        }

        // Fetch the user's role in this organization
        var membership = await _context.OrganizationMemberships
            .FirstOrDefaultAsync(om => om.OrganizationId == org.Id && om.UserId == userId);

        if (membership == null)
        {
            return Forbid();
        }

        // Fetch other organizations the user belongs to for switching overview (Account Linking Overview)
        var linkedOrgs = await _context.OrganizationMemberships
            .Where(om => om.UserId == userId && om.OrganizationId != org.Id && om.Status == "active")
            .Include(om => om.Organization)
            .Select(om => new LinkedOrganizationDto(om.Organization.Name, om.Organization.Username))
            .ToListAsync();

        return Ok(new WorkspaceDetailsDto(
            org.Name,
            org.Username,
            membership.Role,
            linkedOrgs
        ));
    }

    [HttpGet("{organizationSlug}/members")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(PaginatedMembersResponseDto))]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetWorkspaceMembers(
        string organizationSlug,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? search = null)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;

        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }

        var org = await _context.Organizations
            .FirstOrDefaultAsync(o => o.Username.ToLower() == organizationSlug.ToLower() && o.DeletedAt == null);

        if (org == null)
        {
            return NotFound(new { message = "Organization not found" });
        }

        var actorTypeClaim = User.FindFirst("actor_type")?.Value;
        bool isBusiness = string.Equals(actorTypeClaim, "business", StringComparison.OrdinalIgnoreCase);

        if (isBusiness)
        {
            if (org.Id != userId)
            {
                return Forbid();
            }
        }
        else
        {
            // Authorize permission using centralized authorization service
            var isAuthorized = await _authorizationService.AuthorizeAsync(userId, org.Id, OrganizationPermissions.ViewMembers);
            if (!isAuthorized)
            {
                return Forbid();
            }
        }

        var query = _context.OrganizationMemberships
            .Where(om => om.OrganizationId == org.Id)
            .Include(om => om.User)
            .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(om => 
                om.User.FullName.ToLower().Contains(searchLower) ||
                om.User.Email.ToLower().Contains(searchLower)
            );
        }

        var totalCount = await query.CountAsync();
        var items = await query
            .OrderBy(om => om.User.FullName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(om => new MemberDto(
                om.User.FullName,
                om.User.Email,
                om.Role,
                om.Status
            ))
            .ToListAsync();

        return Ok(new PaginatedMembersResponseDto(items, totalCount, page, pageSize));
    }
}
