using System;
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
using CVerify.API.Modules.Shared.Exceptions;

namespace CVerify.API.Modules.Auth.Controllers;

[ApiController]
[Authorize]
public class InvitationController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IOrganizationAuthorizationService _authService;
    private readonly IOrganizationInvitationService _invitationService;

    public InvitationController(
        ApplicationDbContext context,
        IOrganizationAuthorizationService authService,
        IOrganizationInvitationService invitationService)
    {
        _context = context;
        _authService = authService;
        _invitationService = invitationService;
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

    [HttpPost("api/organizations/{orgSlug}/invitations")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> InviteMembers(
        string orgSlug,
        [FromBody] CreateInvitationsDto dto,
        CancellationToken cancellationToken)
    {
        var (orgId, actorUserId, error) = await ValidateAndResolveAsync(orgSlug, "organization:members:manage");
        if (error != null) return error;

        await _invitationService.InviteMembersAsync(orgId, actorUserId, dto, cancellationToken);
        return NoContent();
    }

    [HttpGet("api/organizations/{orgSlug}/invitations")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(PaginatedInvitationsResponseDto))]
    public async Task<IActionResult> GetInvitations(
        string orgSlug,
        [FromQuery] string? status = "active",
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken cancellationToken = default)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;

        var (orgId, _, error) = await ValidateAndResolveAsync(orgSlug, "organization:members:view");
        if (error != null) return error;

        var result = await _invitationService.GetInvitationsAsync(orgId, status, page, pageSize, cancellationToken);
        return Ok(result);
    }

    [HttpPost("api/organizations/{orgSlug}/invitations/{id}/resend")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> ResendInvitation(
        string orgSlug,
        Guid id,
        CancellationToken cancellationToken)
    {
        var (orgId, actorUserId, error) = await ValidateAndResolveAsync(orgSlug, "organization:members:manage");
        if (error != null) return error;

        await _invitationService.ResendInvitationAsync(orgId, actorUserId, id, cancellationToken);
        return NoContent();
    }

    [HttpPost("api/organizations/{orgSlug}/invitations/{id}/cancel")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> CancelInvitation(
        string orgSlug,
        Guid id,
        CancellationToken cancellationToken)
    {
        var (orgId, actorUserId, error) = await ValidateAndResolveAsync(orgSlug, "organization:members:manage");
        if (error != null) return error;

        await _invitationService.CancelInvitationAsync(orgId, actorUserId, id, cancellationToken);
        return NoContent();
    }

    [HttpPost("api/invitations/accept")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> AcceptInvitation(
        [FromBody] AcceptInvitationDto dto,
        CancellationToken cancellationToken)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }

        try
        {
            var slug = await _invitationService.AcceptInvitationAsync(userId, dto.Token, cancellationToken);
            return Ok(new { orgSlug = slug });
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("api/invitations/decline")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> DeclineInvitation(
        [FromBody] DeclineInvitationDto dto,
        CancellationToken cancellationToken)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }

        try
        {
            var slug = await _invitationService.DeclineInvitationAsync(userId, dto.Token, cancellationToken);
            return Ok(new { orgSlug = slug });
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("api/invitations/{id:guid}/accept")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> AcceptInvitationById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }

        try
        {
            var slug = await _invitationService.AcceptInvitationByIdAsync(userId, id, cancellationToken);
            return Ok(new { orgSlug = slug });
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("api/invitations/{id:guid}/decline")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> DeclineInvitationById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }

        try
        {
            var slug = await _invitationService.DeclineInvitationByIdAsync(userId, id, cancellationToken);
            return Ok(new { orgSlug = slug });
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
