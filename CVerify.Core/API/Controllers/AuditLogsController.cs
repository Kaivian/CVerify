using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Application.DTOs;
using CVerify.API.Infrastructure.Persistence;

namespace CVerify.API.API.Controllers;

[ApiController]
[Route("api/admin/audit-logs")]
[Authorize(Roles = "SUPER_ADMIN,ADMIN")]
public class AuditLogsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public AuditLogsController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(PaginatedResultDto<AuditLogListItemDto>))]
    public async Task<IActionResult> GetAuditLogs(
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 20;

        var query = _context.Set<Core.Entities.AuditLog>()
            .Include(a => a.User)
            .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(a => 
                (a.User != null && a.User.Email.ToLower().Contains(searchLower)) ||
                a.EventType.ToLower().Contains(searchLower) ||
                a.Description.ToLower().Contains(searchLower) ||
                (a.IpAddress != null && a.IpAddress.Contains(searchLower))
            );
        }

        var totalCount = await query.CountAsync();
        var items = await query
            .OrderByDescending(a => a.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new AuditLogListItemDto(
                a.Id,
                a.User != null ? a.User.Email : null,
                a.EventType,
                a.Description,
                a.IpAddress,
                a.UserAgent,
                a.CreatedAt
            ))
            .ToListAsync();

        return Ok(new PaginatedResultDto<AuditLogListItemDto>(items, totalCount, page, pageSize));
    }
}
