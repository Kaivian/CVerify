using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using CVerify.API.Modules.Admin.DTOs;
using CVerify.API.Modules.Admin.Services;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Security.Authorization.Attributes;
using CVerify.API.Modules.Shared.Exceptions;
using CVerify.API.Modules.Shared.System.DTOs;

namespace CVerify.API.Modules.Admin.Controllers;

[ApiController]
[Route("api/admin/users")]
public class UsersAdminController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IAdminMemberService _adminMemberService;
    private readonly IUserAdministrationService _userAdminService;

    public UsersAdminController(
        ApplicationDbContext context,
        IAdminMemberService adminMemberService,
        IUserAdministrationService userAdminService)
    {
        _context = context;
        _adminMemberService = adminMemberService;
        _userAdminService = userAdminService;
    }

    [HttpGet]
    [HasPermission("admin:users:view")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(PaginatedResultDto<UserListItemDto>))]
    public async Task<IActionResult> GetUsers(
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery] string? roleName = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var result = await _userAdminService.GetPlatformUsersAsync(search, status, roleName, page, pageSize, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    [HasPermission("admin:users:view")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(UserListItemDto))]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetUser(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var user = await _userAdminService.GetPlatformUserByIdAsync(id, cancellationToken);
            return Ok(user);
        }
        catch (ValidationException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPut("{id:guid}")]
    [HasPermission("admin:users:manage")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(UserListItemDto))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateUser(Guid id, [FromBody] UpdateUserDto dto, CancellationToken cancellationToken)
    {
        var actorUserIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (actorUserIdClaim == null || !Guid.TryParse(actorUserIdClaim.Value, out var actorUserId))
        {
            return Unauthorized();
        }

        try
        {
            var updatedUser = await _userAdminService.UpdatePlatformUserStatusAndRolesAsync(actorUserId, id, dto, cancellationToken);
            return Ok(updatedUser);
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{id:guid}")]
    [HasPermission("admin:users:manage")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteUser(Guid id, CancellationToken cancellationToken)
    {
        var actorUserIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (actorUserIdClaim == null || !Guid.TryParse(actorUserIdClaim.Value, out var actorUserId))
        {
            return Unauthorized();
        }

        try
        {
            await _userAdminService.DeletePlatformUserAsync(actorUserId, id, cancellationToken);
            return NoContent();
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("invitations")]
    [HasPermission("admin:users:manage")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> InviteMember([FromBody] InviteAdminDto dto, CancellationToken cancellationToken)
    {
        var actorUserIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (actorUserIdClaim == null || !Guid.TryParse(actorUserIdClaim.Value, out var actorUserId))
        {
            return Unauthorized();
        }

        try
        {
            await _adminMemberService.InviteMemberAsync(actorUserId, dto, cancellationToken);
            return NoContent();
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("invitations")]
    [HasPermission("admin:users:view")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(PaginatedResultDto<AdminInvitationListItemDto>))]
    public async Task<IActionResult> GetInvitations(
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var result = await _adminMemberService.GetInvitationsAsync(search, page, pageSize, cancellationToken);
        return Ok(result);
    }

    [HttpPost("invitations/{id:guid}/cancel")]
    [HasPermission("admin:users:manage")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CancelInvitation(Guid id, CancellationToken cancellationToken)
    {
        var actorUserIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (actorUserIdClaim == null || !Guid.TryParse(actorUserIdClaim.Value, out var actorUserId))
        {
            return Unauthorized();
        }

        try
        {
            await _adminMemberService.CancelInvitationAsync(actorUserId, id, cancellationToken);
            return NoContent();
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("invitations/accept")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AcceptInvitation([FromBody] AcceptInvitationDto dto, CancellationToken cancellationToken)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }

        try
        {
            await _adminMemberService.AcceptInvitationAsync(userId, dto.Token, cancellationToken);
            return NoContent();
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
