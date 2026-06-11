using System;
using System.Linq;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.System.DTOs;

namespace CVerify.API.Modules.Shared.System.Controllers;

[Authorize]
[ApiController]
[Route("api/notifications")]
public class NotificationController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public NotificationController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(PaginatedResultDto<NotificationDto>))]
    public async Task<IActionResult> GetNotifications(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] bool unreadOnly = false,
        CancellationToken cancellationToken = default)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized();
        }

        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 20;

        var query = _context.InAppNotifications
            .Where(n => n.UserId == userId && n.DeletedAt == null);

        if (unreadOnly)
        {
            query = query.Where(n => !n.IsRead);
        }

        var totalCount = await query.CountAsync(cancellationToken);
        
        var list = await query
            .OrderByDescending(n => n.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var dtos = list.Select(NotificationDto.FromEntity).ToList();

        return Ok(new PaginatedResultDto<NotificationDto>(dtos, totalCount, page, pageSize));
    }

    [HttpPut("{id}/read")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> MarkAsRead(Guid id)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized();
        }

        var notification = await _context.InAppNotifications
            .FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId && n.DeletedAt == null);

        if (notification == null)
        {
            return NotFound();
        }

        if (!notification.IsRead)
        {
            notification.IsRead = true;
            notification.ReadAt = DateTimeOffset.UtcNow;
            await _context.SaveChangesAsync();
        }

        return Ok();
    }

    [HttpPut("read-all")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> MarkAllAsRead()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized();
        }

        var unread = await _context.InAppNotifications
            .Where(n => n.UserId == userId && !n.IsRead && n.DeletedAt == null)
            .ToListAsync();

        if (unread.Any())
        {
            var now = DateTimeOffset.UtcNow;
            foreach (var n in unread)
            {
                n.IsRead = true;
                n.ReadAt = now;
            }
            await _context.SaveChangesAsync();
        }

        return Ok();
    }

    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteNotification(Guid id)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized();
        }

        var notification = await _context.InAppNotifications
            .FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId && n.DeletedAt == null);

        if (notification == null)
        {
            return NotFound();
        }

        notification.DeletedAt = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync();

        return Ok();
    }

    [HttpGet("preferences")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(NotificationPreferenceDto[]))]
    public async Task<IActionResult> GetPreferences()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized();
        }

        var list = await _context.NotificationPreferences
            .Where(np => np.UserId == userId)
            .Select(np => NotificationPreferenceDto.FromEntity(np))
            .ToListAsync();

        return Ok(list);
    }

    [HttpPut("preferences")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdatePreference([FromBody] UpdateNotificationPreferenceRequest request)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized();
        }

        var pref = await _context.NotificationPreferences
            .FirstOrDefaultAsync(np => np.UserId == userId &&
                                       np.NotificationType == request.NotificationType &&
                                       np.Channel == request.Channel);

        if (pref == null)
        {
            pref = new NotificationPreference
            {
                Id = Guid.CreateVersion7(),
                UserId = userId,
                NotificationType = request.NotificationType,
                Channel = request.Channel,
                IsEnabled = request.IsEnabled,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            _context.NotificationPreferences.Add(pref);
        }
        else
        {
            pref.IsEnabled = request.IsEnabled;
            pref.UpdatedAt = DateTimeOffset.UtcNow;
        }

        await _context.SaveChangesAsync();
        return Ok();
    }
}
