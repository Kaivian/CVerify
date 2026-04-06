using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Application.DTOs;
using CVerify.API.Application.Interfaces;
using CVerify.API.Core.Entities;
using CVerify.API.Infrastructure.Persistence;

namespace CVerify.API.API.Controllers;

[ApiController]
[Route("api/admin/users")]
[Authorize(Roles = "SUPER_ADMIN,ADMIN")]
public class UsersAdminController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ICacheService _cacheService;

    public UsersAdminController(ApplicationDbContext context, ICacheService cacheService)
    {
        _context = context;
        _cacheService = cacheService;
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(PaginatedResultDto<UserListItemDto>))]
    public async Task<IActionResult> GetUsers(
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery] string? roleName = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 20;

        var query = _context.Users
            .Include(u => u.Roles)
            .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(u => 
                u.Email.ToLower().Contains(searchLower) ||
                u.FullName.ToLower().Contains(searchLower)
            );
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            if (Enum.TryParse<UserStatus>(status, true, out var statusEnum))
            {
                query = query.Where(u => u.Status == statusEnum);
            }
        }

        if (!string.IsNullOrWhiteSpace(roleName))
        {
            query = query.Where(u => u.Roles.Any(r => r.Name == roleName.ToUpperInvariant()));
        }

        var totalCount = await query.CountAsync();
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
                u.Roles.Select(r => r.Name).ToList(),
                u.SessionVersion,
                u.CreatedAt
            ))
            .ToListAsync();

        return Ok(new PaginatedResultDto<UserListItemDto>(items, totalCount, page, pageSize));
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(UserListItemDto))]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetUser(Guid id)
    {
        var user = await _context.Users
            .Include(u => u.Roles)
            .FirstOrDefaultAsync(u => u.Id == id);

        if (user == null) return NotFound(new { message = "User not found" });

        return Ok(new UserListItemDto(
            user.Id,
            user.Email,
            user.FullName,
            user.Status.ToString(),
            user.LastLoginAt,
            user.Roles.Select(r => r.Name).ToList(),
            user.SessionVersion,
            user.CreatedAt
        ));
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(UserListItemDto))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateUser(Guid id, [FromBody] UpdateUserDto dto)
    {
        var user = await _context.Users
            .Include(u => u.Roles)
            .FirstOrDefaultAsync(u => u.Id == id);

        if (user == null) return NotFound(new { message = "User not found" });

        // Parse status transition
        if (!Enum.TryParse<UserStatus>(dto.Status, true, out var targetStatus))
        {
            return BadRequest(new { message = $"Invalid status value: {dto.Status}" });
        }

        var isStatusChanged = user.Status != targetStatus;

        // Transition through formal domain state machine
        if (isStatusChanged)
        {
            try
            {
                user.TransitionTo(targetStatus);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        var currentRoles = user.Roles.Select(r => r.Name).ToList();
        var targetRoles = dto.Roles ?? new List<string>();
        var isRolesChanged = !currentRoles.OrderBy(r => r).SequenceEqual(targetRoles.OrderBy(r => r));

        if (isRolesChanged)
        {
            var roles = await _context.Roles
                .Where(r => targetRoles.Contains(r.Name))
                .ToListAsync();
            user.Roles = roles;
        }

        // Trigger immediate revocation if roles changed, account is banned, or suspended
        var shouldRevoke = isRolesChanged || isStatusChanged;

        if (shouldRevoke)
        {
            // Revoke active sessions immediately
            user.SessionVersion += 1;
            user.UpdatedAt = DateTimeOffset.UtcNow;

            // Invalidate Redis permissions cache
            var permKey = $"auth:user:{user.Id}:permissions";
            var sessKey = $"auth:user:{user.Id}:session_version";
            await _cacheService.RemoveAsync(permKey);
            await _cacheService.RemoveAsync(sessKey);
        }

        await _context.SaveChangesAsync();

        return Ok(new UserListItemDto(
            user.Id,
            user.Email,
            user.FullName,
            user.Status.ToString(),
            user.LastLoginAt,
            user.Roles.Select(r => r.Name).ToList(),
            user.SessionVersion,
            user.CreatedAt
        ));
    }
}
