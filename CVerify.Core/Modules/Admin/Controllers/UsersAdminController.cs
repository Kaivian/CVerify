using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Admin.DTOs;
using CVerify.API.Modules.Admin.Services;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Security.Authorization.Attributes;
using CVerify.API.Modules.Shared.Exceptions;

namespace CVerify.API.Modules.Admin.Controllers;

[ApiController]
[Route("api/admin/users")]
public class UsersAdminController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IAdminMemberService _adminMemberService;

    public UsersAdminController(ApplicationDbContext context, IAdminMemberService adminMemberService)
    {
        _context = context;
        _adminMemberService = adminMemberService;
    }

    [HttpGet]
    [HasPermission("admin:users:view")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(PaginatedResultDto<UserListItemDto>))]
    public async Task<IActionResult> GetUsers(
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var result = await _adminMemberService.GetMembersAsync(search, status, page, pageSize, cancellationToken);
        
        var items = result.Items.Select(m => new UserListItemDto(
            m.Id,
            m.Email,
            m.FullName,
            m.Status,
            m.LastLoginAt,
            m.Roles.Select(r => r.Name).ToList(),
            m.SessionVersion,
            m.JoinedAt
        )).ToList();

        return Ok(new PaginatedResultDto<UserListItemDto>(items, result.TotalCount, result.Page, result.PageSize));
    }

    [HttpGet("{id:guid}")]
    [HasPermission("admin:users:view")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(UserListItemDto))]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetUser(Guid id, CancellationToken cancellationToken)
    {
        var member = await _context.AdminMembers
            .Include(am => am.User)
            .Include(am => am.RoleAssignments)
                .ThenInclude(ra => ra.Role)
            .AsNoTracking()
            .FirstOrDefaultAsync(am => am.Id == id, cancellationToken);

        if (member == null)
        {
            return NotFound(new { message = "Admin member not found" });
        }

        return Ok(new UserListItemDto(
            member.Id,
            member.User.Email,
            member.User.FullName,
            member.Status,
            member.User.LastLoginAt,
            member.RoleAssignments.Select(ra => ra.Role.Name).ToList(),
            member.SessionVersion,
            member.JoinedAt
        ));
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

        var roles = await _context.AdminRoles
            .Where(r => dto.Roles.Contains(r.Name))
            .ToListAsync(cancellationToken);

        var updateDto = new UpdateAdminMemberDto(
            dto.Status,
            roles.Select(r => r.Id).ToList()
        );

        try
        {
            await _adminMemberService.UpdateMemberAsync(actorUserId, id, updateDto, cancellationToken);
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }

        var member = await _context.AdminMembers
            .Include(am => am.User)
            .Include(am => am.RoleAssignments)
                .ThenInclude(ra => ra.Role)
            .FirstOrDefaultAsync(am => am.Id == id, cancellationToken);

        if (member == null)
        {
            return NotFound(new { message = "Admin member not found" });
        }

        return Ok(new UserListItemDto(
            member.Id,
            member.User.Email,
            member.User.FullName,
            member.Status,
            member.User.LastLoginAt,
            member.RoleAssignments.Select(ra => ra.Role.Name).ToList(),
            member.SessionVersion,
            member.JoinedAt
        ));
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
            await _adminMemberService.RemoveMemberAsync(actorUserId, id, cancellationToken);
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
