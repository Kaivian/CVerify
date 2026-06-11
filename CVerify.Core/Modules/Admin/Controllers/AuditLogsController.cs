using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Admin.DTOs;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Security.Authorization.Attributes;

namespace CVerify.API.Modules.Admin.Controllers;

[ApiController]
[Route("api/admin/audit-logs")]
public class AuditLogsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public AuditLogsController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    [HasPermission("admin:ai:audit")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(PaginatedResultDto<AuditLogListItemDto>))]
    public async Task<IActionResult> GetAuditLogs(
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 20;

        var query = _context.AuditLogs
            .Include(a => a.ActorUser)
            .Include(a => a.TargetUser)
            .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(a => 
                (a.ActorUser != null && a.ActorUser.Email.ToLower().Contains(searchLower)) ||
                (a.TargetUser != null && a.TargetUser.Email.ToLower().Contains(searchLower)) ||
                a.EventType.ToLower().Contains(searchLower) ||
                (a.TargetRoleName != null && a.TargetRoleName.ToLower().Contains(searchLower)) ||
                (a.DetailsJson != null && a.DetailsJson.ToLower().Contains(searchLower))
            );
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var logs = await query
            .OrderByDescending(a => a.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var items = logs.Select(a => {
            string description;
            switch (a.EventType)
            {
                case "MEMBER_INVITED":
                    description = $"Invited admin member with roles: {a.TargetRoleName}";
                    break;
                case "MEMBER_JOINED":
                    description = $"Admin member joined with roles: {a.TargetRoleName}";
                    break;
                case "MEMBER_UPDATED":
                    description = $"Updated admin member. New roles: {a.TargetRoleName}";
                    break;
                case "MEMBER_REMOVED":
                    description = $"Removed admin member (User ID: {a.TargetUserId})";
                    break;
                case "INVITATION_CANCELLED":
                    description = "Cancelled pending admin invitation";
                    break;
                default:
                    description = a.Description ?? $"{a.EventType} performed on target {a.TargetRoleName ?? a.TargetUserId?.ToString()}";
                    break;
            }

            return new AuditLogListItemDto(
                a.Id,
                a.ActorUser != null ? a.ActorUser.Email : "System",
                a.EventType,
                description,
                null,
                null,
                a.CreatedAt
            );
        }).ToList();

        return Ok(new PaginatedResultDto<AuditLogListItemDto>(items, totalCount, page, pageSize));
    }
}
