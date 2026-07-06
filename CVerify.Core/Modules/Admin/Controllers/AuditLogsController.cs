using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Admin.DTOs;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Security.Authorization.Attributes;
using CVerify.API.Modules.Shared.System.DTOs;

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
        [FromQuery] string? category = null,
        [FromQuery] string? actionType = null,
        [FromQuery] string? actorEmail = null,
        [FromQuery] string? resourceType = null,
        [FromQuery] DateTimeOffset? startDate = null,
        [FromQuery] DateTimeOffset? endDate = null,
        [FromQuery] Guid? organizationId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 20;

        var query = BuildFilteredQuery(search, category, actionType, actorEmail, resourceType, startDate, endDate, organizationId);

        var totalCount = await query.CountAsync(cancellationToken);
        var logs = await query
            .OrderByDescending(a => a.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var items = logs.Select(a => MapToListItemDto(a)).ToList();

        return Ok(new PaginatedResultDto<AuditLogListItemDto>(items, totalCount, page, pageSize));
    }

    [HttpGet("{id}")]
    [HasPermission("admin:ai:audit")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(AuditLogDetailDto))]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetAuditLogDetails(Guid id, CancellationToken cancellationToken = default)
    {
        var a = await _context.AuditLogs
            .Include(x => x.ActorUser)
            .Include(x => x.TargetUser)
            .Include(x => x.Organization)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (a == null)
        {
            return NotFound(new { message = "Audit log not found." });
        }

        var dto = new AuditLogDetailDto(
            a.Id,
            a.ActorUser?.Email ?? "System",
            a.EventType,
            a.Category.ToString(),
            a.Description,
            a.ResourceType ?? (a.TargetUser != null ? "User" : (a.TargetRoleName != null ? "Role" : a.ScopeType)),
            a.ResourceDisplayName ?? (a.TargetUser?.Email ?? a.TargetRoleName ?? a.ScopeId?.ToString()),
            a.ResourceId ?? a.TargetUserId ?? a.ScopeId,
            a.Organization?.Name ?? "System",
            a.IpAddress,
            a.UserAgent,
            a.Device,
            a.Browser,
            a.RequestId,
            a.CorrelationId,
            a.HttpPath,
            a.HttpMethod,
            a.ClientApp,
            a.DetailsJson,
            a.OldStateJson,
            a.NewStateJson,
            a.CreatedAt
        );

        return Ok(dto);
    }

    [HttpGet("stats")]
    [HasPermission("admin:ai:audit")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(AuditLogsStatsDto))]
    public async Task<IActionResult> GetAuditLogsStats(CancellationToken cancellationToken = default)
    {
        var now = DateTimeOffset.UtcNow;
        var past24Hours = now.AddHours(-24);
        var past7Days = now.AddDays(-7);

        // 1. Config Changes count
        var configChangesCount = await _context.AuditLogs.CountAsync(a =>
            a.IsLegacySecurityEvent == false &&
            a.CreatedAt >= past24Hours &&
            (a.Category == AuditCategory.WorkspaceManagement ||
             a.Category == AuditCategory.PortalConfiguration ||
             a.Category == AuditCategory.SystemConfiguration),
            cancellationToken);

        // 2. Role Changes count
        var roleChangesCount = await _context.AuditLogs.CountAsync(a =>
            a.IsLegacySecurityEvent == false &&
            a.CreatedAt >= past7Days &&
            a.Category == AuditCategory.RolesAndPermissions,
            cancellationToken);

        // 3. Verification Actions (Pending) - Resolved dynamically via ADO.NET to preserve architectural feature boundaries
        var pendingVerificationActionsCount = 0;
        try
        {
            var claimType = _context.Model.FindEntityType("CVerify.API.Modules.Recovery.Entities.OrganizationRecoveryClaim");
            var rotationType = _context.Model.FindEntityType("CVerify.API.Modules.Recovery.Entities.RepresentativeRotationRequest");

            var claimTable = claimType?.GetTableName() ?? "organization_recovery_claims";
            var rotationTable = rotationType?.GetTableName() ?? "representative_rotation_requests";

            using (var command = _context.Database.GetDbConnection().CreateCommand())
            {
                await _context.Database.OpenConnectionAsync(cancellationToken);

                command.CommandText = $"SELECT COUNT(*)::int FROM \"{claimTable}\" WHERE \"Status\" IN ('Pending', 'UnderAnalysis')";
                var pendingClaims = (int?)await command.ExecuteScalarAsync(cancellationToken) ?? 0;

                command.CommandText = $"SELECT COUNT(*)::int FROM \"{rotationTable}\" WHERE \"FinalDecision\" IN ('pending_review', 'awaiting_support_approval', 'awaiting_admin_approval')";
                var pendingRotations = (int?)await command.ExecuteScalarAsync(cancellationToken) ?? 0;

                pendingVerificationActionsCount = pendingClaims + pendingRotations;
            }
        }
        catch (Exception ex)
        {
            // Fallback default in case tables are not yet provisioned in test migrations
            Console.WriteLine($"[Audit Logs Stats Warning] Failed to query recovery stats: {ex.Message}");
        }

        // 4. Exports Count (this week)
        var exportsCount = await _context.AuditLogs.CountAsync(a =>
            a.IsLegacySecurityEvent == false &&
            a.CreatedAt >= past7Days &&
            a.Category == AuditCategory.DataGovernance,
            cancellationToken);

        // 5. Daily Trend of Changes (Last 7 Days)
        var trends = new List<AuditDashboardMetricItem>();
        for (int i = 6; i >= 0; i--)
        {
            var dayStart = new DateTimeOffset(now.Year, now.Month, now.Day, 0, 0, 0, TimeSpan.Zero).AddDays(-i);
            var dayEnd = dayStart.AddDays(1);
            var count = await _context.AuditLogs.CountAsync(a =>
                a.IsLegacySecurityEvent == false &&
                a.CreatedAt >= dayStart && a.CreatedAt < dayEnd,
                cancellationToken);
            trends.Add(new AuditDashboardMetricItem(dayStart.ToString("MM-dd"), count));
        }

        // 6. Top Active Admins
        var topAdminsRaw = await _context.AuditLogs
            .Where(a => a.IsLegacySecurityEvent == false && a.ActorUser != null)
            .GroupBy(a => a.ActorUser!.Email)
            .Select(g => new { Email = g.Key, Count = g.Count() })
            .OrderByDescending(g => g.Count)
            .Take(5)
            .ToListAsync(cancellationToken);
        var topAdmins = topAdminsRaw.Select(g => new AuditDashboardMetricItem(g.Email, g.Count)).ToList();

        // 7. Top Modified Resources
        var topResourcesRaw = await _context.AuditLogs
            .Where(a => a.IsLegacySecurityEvent == false && a.ResourceType != null)
            .GroupBy(a => a.ResourceType!)
            .Select(g => new { Type = g.Key, Count = g.Count() })
            .OrderByDescending(g => g.Count)
            .Take(5)
            .ToListAsync(cancellationToken);
        var topResources = topResourcesRaw.Select(g => new AuditDashboardMetricItem(g.Type, g.Count)).ToList();

        return Ok(new AuditLogsStatsDto(
            configChangesCount,
            roleChangesCount,
            pendingVerificationActionsCount,
            exportsCount,
            trends,
            topAdmins,
            topResources
        ));
    }

    [HttpGet("export")]
    [HasPermission("admin:ai:audit")]
    public async Task<IActionResult> ExportAuditLogs(
        [FromQuery] string? search = null,
        [FromQuery] string? category = null,
        [FromQuery] string? actionType = null,
        [FromQuery] string? actorEmail = null,
        [FromQuery] string? resourceType = null,
        [FromQuery] DateTimeOffset? startDate = null,
        [FromQuery] DateTimeOffset? endDate = null,
        [FromQuery] Guid? organizationId = null,
        [FromQuery] string format = "csv",
        CancellationToken cancellationToken = default)
    {
        var query = BuildFilteredQuery(search, category, actionType, actorEmail, resourceType, startDate, endDate, organizationId);

        var logs = await query
            .OrderByDescending(a => a.CreatedAt)
            .Take(5000) // Compliance limit cap
            .ToListAsync(cancellationToken);

        var list = logs.Select(a => MapToListItemDto(a)).ToList();

        // Audit the export action itself!
        var actorUserId = Guid.Empty;
        var actorEmailStr = "System";
        if (User?.Identity?.IsAuthenticated == true)
        {
            var idClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
            if (idClaim != null && Guid.TryParse(idClaim.Value, out var parsedId))
            {
                actorUserId = parsedId;
            }
            actorEmailStr = User.Identity.Name ?? "Administrator";
        }

        var exportLog = new AuditLog
        {
            Id = Guid.CreateVersion7(),
            ActorUserId = actorUserId,
            UserId = actorUserId,
            EventType = "DATA_EXPORTED",
            Description = $"Audit trail exported by {actorEmailStr} in {format.ToUpperInvariant()} format. Record count: {list.Count}.",
            Category = AuditCategory.DataGovernance,
            ResourceType = "AuditLog",
            ResourceDisplayName = "System Audit Trail",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = Request.Headers.UserAgent.ToString(),
            CreatedAt = DateTimeOffset.UtcNow
        };
        _context.AuditLogs.Add(exportLog);
        await _context.SaveChangesAsync(cancellationToken);

        if (string.Equals(format, "json", StringComparison.OrdinalIgnoreCase))
        {
            var jsonBytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(list, new JsonSerializerOptions { WriteIndented = true }));
            return File(jsonBytes, "application/json", $"audit_trail_{DateTime.UtcNow:yyyyMMddHHmmss}.json");
        }

        // Default to CSV
        var sb = new StringBuilder();
        sb.AppendLine("Id,Timestamp,Actor,ActionType,Category,ResourceType,ResourceName,Details,IpAddress,UserAgent");
        foreach (var item in list)
        {
            var row = $"{item.Id},\"{item.CreatedAt:yyyy-MM-dd HH:mm:ss}\",\"{item.UserEmail ?? "System"}\",\"{item.EventType}\",\"{category}\",\"{item.ResourceType}\",\"{item.ResourceDisplayName}\",\"{item.Description.Replace("\"", "\"\"")}\",\"{item.IpAddress}\",\"{item.UserAgent}\"";
            sb.AppendLine(row);
        }
        var csvBytes = Encoding.UTF8.GetBytes(sb.ToString());
        return File(csvBytes, "text/csv", $"audit_trail_{DateTime.UtcNow:yyyyMMddHHmmss}.csv");
    }

    private IQueryable<AuditLog> BuildFilteredQuery(
        string? search,
        string? category,
        string? actionType,
        string? actorEmail,
        string? resourceType,
        DateTimeOffset? startDate,
        DateTimeOffset? endDate,
        Guid? organizationId)
    {
        var query = _context.AuditLogs
            .Include(a => a.ActorUser)
            .Include(a => a.TargetUser)
            .Include(a => a.Organization)
            .Where(a => a.IsLegacySecurityEvent == false)
            .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(a =>
                (a.ActorUser != null && a.ActorUser.Email.ToLower().Contains(searchLower)) ||
                (a.TargetUser != null && a.TargetUser.Email.ToLower().Contains(searchLower)) ||
                a.EventType.ToLower().Contains(searchLower) ||
                (a.TargetRoleName != null && a.TargetRoleName.ToLower().Contains(searchLower)) ||
                a.Description.ToLower().Contains(searchLower) ||
                (a.ResourceDisplayName != null && a.ResourceDisplayName.ToLower().Contains(searchLower))
            );
        }

        if (!string.IsNullOrWhiteSpace(category) && Enum.TryParse<AuditCategory>(category, true, out var parsedCategory))
        {
            query = query.Where(a => a.Category == parsedCategory);
        }

        if (!string.IsNullOrWhiteSpace(actionType))
        {
            query = query.Where(a => a.EventType.ToLower() == actionType.ToLower());
        }

        if (!string.IsNullOrWhiteSpace(actorEmail))
        {
            query = query.Where(a => a.ActorUser != null && a.ActorUser.Email.ToLower().Contains(actorEmail.ToLower()));
        }

        if (!string.IsNullOrWhiteSpace(resourceType))
        {
            query = query.Where(a => a.ResourceType.ToLower() == resourceType.ToLower());
        }

        if (startDate.HasValue)
        {
            query = query.Where(a => a.CreatedAt >= startDate.Value);
        }

        if (endDate.HasValue)
        {
            query = query.Where(a => a.CreatedAt <= endDate.Value);
        }

        if (organizationId.HasValue)
        {
            query = query.Where(a => a.OrganizationId == organizationId.Value);
        }

        return query;
    }

    private static AuditLogListItemDto MapToListItemDto(AuditLog a)
    {
        return new AuditLogListItemDto(
            a.Id,
            a.ActorUser?.Email ?? "System",
            a.EventType,
            a.Description,
            a.ResourceType ?? (a.TargetUser != null ? "User" : (a.TargetRoleName != null ? "Role" : a.ScopeType)),
            a.ResourceDisplayName ?? (a.TargetUser?.Email ?? a.TargetRoleName ?? a.ScopeId?.ToString()),
            a.ResourceId ?? a.TargetUserId ?? a.ScopeId,
            a.Organization?.Name ?? "System",
            a.IpAddress,
            a.UserAgent,
            a.Device,
            a.Browser,
            a.CreatedAt
        );
    }
}
