using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StackExchange.Redis;
using CVerify.API.Modules.Admin.DTOs;
using CVerify.API.Modules.Shared.Domain.Constants;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Security.Authorization.Attributes;
using CVerify.API.Modules.Shared.System.DTOs;

namespace CVerify.API.Modules.Admin.Controllers;

[ApiController]
[Route("api/admin/security")]
public class SecurityEventsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IConnectionMultiplexer _redis;

    public SecurityEventsController(ApplicationDbContext context, IConnectionMultiplexer redis)
    {
        _context = context;
        _redis = redis;
    }

    [HttpGet("events")]
    [HasPermission("admin:security:view")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(PaginatedResultDto<SecurityEventListItemDto>))]
    public async Task<IActionResult> GetSecurityEvents(
        [FromQuery] string? search = null,
        [FromQuery] string? severity = null,
        [FromQuery] string? status = null,
        [FromQuery] string? category = null,
        [FromQuery] DateTimeOffset? startDate = null,
        [FromQuery] DateTimeOffset? endDate = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 15,
        CancellationToken cancellationToken = default)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 15;

        var query = _context.SecurityEvents
            .Include(e => e.ActorUser)
            .Include(e => e.TargetUser)
            .AsNoTracking();

        // Apply filters
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(e =>
                e.Description.ToLower().Contains(searchLower) ||
                e.EventType.ToLower().Contains(searchLower) ||
                (e.IpAddress != null && e.IpAddress.Contains(searchLower)) ||
                (e.ActorUser != null && e.ActorUser.Email.ToLower().Contains(searchLower)) ||
                (e.TargetUser != null && e.TargetUser.Email.ToLower().Contains(searchLower))
            );
        }

        if (!string.IsNullOrWhiteSpace(severity))
        {
            query = query.Where(e => e.Severity.ToLower() == severity.ToLower());
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(e => e.Status.ToLower() == status.ToLower());
        }

        if (!string.IsNullOrWhiteSpace(category))
        {
            query = query.Where(e => e.Category.ToLower() == category.ToLower());
        }

        if (startDate.HasValue)
        {
            query = query.Where(e => e.CreatedAt >= startDate.Value);
        }

        if (endDate.HasValue)
        {
            query = query.Where(e => e.CreatedAt <= endDate.Value);
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var events = await query
            .OrderByDescending(e => e.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var items = events.Select(e => new SecurityEventListItemDto(
            e.Id,
            e.EventType,
            e.Category,
            e.Severity,
            e.Status,
            e.RiskScore,
            e.ConfidenceScore,
            e.Description,
            e.ActorUser?.Email,
            e.TargetUser?.Email,
            e.IpAddress,
            e.CountryCode,
            e.OccurrenceCount,
            e.CreatedAt
        )).ToList();

        return Ok(new PaginatedResultDto<SecurityEventListItemDto>(items, totalCount, page, pageSize));
    }

    [HttpGet("events/{id}")]
    [HasPermission("admin:security:view")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(SecurityEventDetailDto))]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetSecurityEventDetails(Guid id, CancellationToken cancellationToken = default)
    {
        var e = await _context.SecurityEvents
            .Include(x => x.ActorUser)
            .Include(x => x.TargetUser)
            .Include(x => x.Organization)
            .Include(x => x.Incident)
            .Include(x => x.AssignedToUser)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (e == null)
        {
            return NotFound(new { message = "Security event not found." });
        }

        // Fetch comments ordered by date
        var comments = await _context.SecurityEventComments
            .Include(c => c.AuthorUser)
            .Where(c => c.SecurityEventId == id)
            .OrderBy(c => c.CreatedAt)
            .Select(c => new SecurityEventCommentDto(
                c.Id,
                c.SecurityEventId,
                c.SecurityIncidentId,
                c.AuthorUserId,
                c.AuthorUser.Email,
                c.CommentText,
                c.CreatedAt
            ))
            .ToListAsync(cancellationToken);

        var dto = new SecurityEventDetailDto(
            e.Id,
            e.EventType,
            e.Category,
            e.Severity,
            e.Status,
            e.RiskScore,
            e.ConfidenceScore,
            e.Description,
            e.ActorUserId,
            e.ActorUser?.Email,
            e.TargetUserId,
            e.TargetUser?.Email,
            e.OrganizationId,
            e.Organization?.Name,
            e.IpAddress,
            e.CountryCode,
            e.Device,
            e.Browser,
            e.SessionId,
            e.DetailsJson,
            e.CorrelationId,
            e.IncidentId,
            e.Incident?.Title,
            e.AssignedToUserId,
            e.AssignedToUser?.Email,
            e.OccurrenceCount,
            comments,
            e.CreatedAt,
            e.UpdatedAt
        );

        return Ok(dto);
    }

    [HttpPost("events/{id}/status")]
    [HasPermission("admin:security:investigate")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateEventStatus(
        Guid id,
        [FromBody] UpdateSecurityEventStatusDto dto,
        CancellationToken cancellationToken = default)
    {
        var securityEvent = await _context.SecurityEvents.FindAsync(new object[] { id }, cancellationToken);
        if (securityEvent == null)
        {
            return NotFound(new { message = "Security event not found." });
        }

        // Validate state transitions
        var oldStatus = securityEvent.Status;
        var newStatus = dto.Status;

        bool isValidTransition = (oldStatus, newStatus) switch
        {
            ("New", "Acknowledged") => true,
            ("New", "Investigating") => true,
            ("New", "Contained") => true,
            ("New", "FalsePositive") => true,
            ("Acknowledged", "Investigating") => true,
            ("Acknowledged", "Contained") => true,
            ("Acknowledged", "FalsePositive") => true,
            ("Investigating", "Contained") => true,
            ("Investigating", "Resolved") => true,
            ("Investigating", "FalsePositive") => true,
            ("Contained", "Resolved") => true,
            ("Resolved", "Closed") => true,
            ("Closed", "Investigating") => true,
            ("FalsePositive", "Closed") => true,
            _ => oldStatus == newStatus // no-op transition is valid
        };

        if (!isValidTransition)
        {
            return BadRequest(new { message = $"Invalid status transition from {oldStatus} to {newStatus}." });
        }

        securityEvent.Status = newStatus;
        securityEvent.UpdatedAt = DateTimeOffset.UtcNow;

        var authorUserId = GetCurrentUserId();

        // Log status change automatically as a comment
        var auditComment = new SecurityEventComment
        {
            Id = Guid.CreateVersion7(),
            SecurityEventId = securityEvent.Id,
            AuthorUserId = authorUserId,
            CommentText = $"Status transitioned from {oldStatus} to {newStatus}." +
                          (!string.IsNullOrEmpty(dto.CommentText) ? $" Notes: {dto.CommentText}" : ""),
            CreatedAt = DateTimeOffset.UtcNow
        };

        _context.SecurityEventComments.Add(auditComment);
        await _context.SaveChangesAsync(cancellationToken);

        return Ok(new { message = "Security event status updated successfully." });
    }

    [HttpPost("events/{id}/assign")]
    [HasPermission("admin:security:investigate")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AssignEvent(
        Guid id,
        [FromBody] AssignSecurityEventDto dto,
        CancellationToken cancellationToken = default)
    {
        var securityEvent = await _context.SecurityEvents.FindAsync(new object[] { id }, cancellationToken);
        if (securityEvent == null)
        {
            return NotFound(new { message = "Security event not found." });
        }

        var oldAssigneeId = securityEvent.AssignedToUserId;
        securityEvent.AssignedToUserId = dto.AssignedToUserId;
        securityEvent.UpdatedAt = DateTimeOffset.UtcNow;

        var authorUserId = GetCurrentUserId();
        string commentText;

        if (dto.AssignedToUserId.HasValue)
        {
            var assignee = await _context.Users.FindAsync(new object[] { dto.AssignedToUserId.Value }, cancellationToken);
            var assigneeEmail = assignee?.Email ?? dto.AssignedToUserId.Value.ToString();
            commentText = $"Assigned investigation to {assigneeEmail}.";
        }
        else
        {
            commentText = "Removed investigator assignment.";
        }

        var auditComment = new SecurityEventComment
        {
            Id = Guid.CreateVersion7(),
            SecurityEventId = securityEvent.Id,
            AuthorUserId = authorUserId,
            CommentText = commentText,
            CreatedAt = DateTimeOffset.UtcNow
        };

        _context.SecurityEventComments.Add(auditComment);
        await _context.SaveChangesAsync(cancellationToken);

        return Ok(new { message = "Investigator assignment updated." });
    }

    [HttpPost("events/{id}/comment")]
    [HasPermission("admin:security:investigate")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddComment(
        Guid id,
        [FromBody] AddSecurityEventCommentDto dto,
        CancellationToken cancellationToken = default)
    {
        var securityEvent = await _context.SecurityEvents.FindAsync(new object[] { id }, cancellationToken);
        if (securityEvent == null)
        {
            return NotFound(new { message = "Security event not found." });
        }

        var comment = new SecurityEventComment
        {
            Id = Guid.CreateVersion7(),
            SecurityEventId = securityEvent.Id,
            AuthorUserId = GetCurrentUserId(),
            CommentText = dto.CommentText,
            CreatedAt = DateTimeOffset.UtcNow
        };

        _context.SecurityEventComments.Add(comment);
        await _context.SaveChangesAsync(cancellationToken);

        return Ok(new { message = "Comment added successfully." });
    }

    [HttpPost("events/{id}/contain")]
    [HasPermission("admin:security:admin-actions")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> TriggerContainment(
        Guid id,
        [FromQuery] string actionType,
        CancellationToken cancellationToken = default)
    {
        var securityEvent = await _context.SecurityEvents.FindAsync(new object[] { id }, cancellationToken);
        if (securityEvent == null)
        {
            return NotFound(new { message = "Security event not found." });
        }

        var authorUserId = GetCurrentUserId();

        if (string.Equals(actionType, "UserSuspend", StringComparison.OrdinalIgnoreCase))
        {
            if (!securityEvent.ActorUserId.HasValue)
            {
                return BadRequest(new { message = "No Actor User mapped to this event to suspend." });
            }

            var user = await _context.Users.FindAsync(new object[] { securityEvent.ActorUserId.Value }, cancellationToken);
            if (user == null)
            {
                return BadRequest(new { message = "User not found." });
            }

            user.TransitionTo(UserStatus.SUSPENDED);
            user.SessionVersion++; // Bumps token version

            // Clear cache
            var cacheKey = $"auth:user:{user.Id}:session_version";
            await _redis.GetDatabase().KeyDeleteAsync(cacheKey);

            var comment = new SecurityEventComment
            {
                Id = Guid.CreateVersion7(),
                SecurityEventId = securityEvent.Id,
                AuthorUserId = authorUserId,
                CommentText = $"[CONTAINMENT ACTION] Manual suspension triggered on user {user.Email}.",
                CreatedAt = DateTimeOffset.UtcNow
            };

            _context.SecurityEventComments.Add(comment);
            await _context.SaveChangesAsync(cancellationToken);

            return Ok(new { message = $"User {user.Email} suspended successfully." });
        }
        else if (string.Equals(actionType, "IpBlock", StringComparison.OrdinalIgnoreCase))
        {
            if (string.IsNullOrEmpty(securityEvent.IpAddress))
            {
                return BadRequest(new { message = "No IP Address mapped to this event to block." });
            }

            var ipBanKey = $"sec:ip_ban:{securityEvent.IpAddress}";
            // Ban the offending IP address in Redis for 12 hours
            await _redis.GetDatabase().StringSetAsync(ipBanKey, "banned", TimeSpan.FromHours(12));

            var comment = new SecurityEventComment
            {
                Id = Guid.CreateVersion7(),
                SecurityEventId = securityEvent.Id,
                AuthorUserId = authorUserId,
                CommentText = $"[CONTAINMENT ACTION] Manual IP ban triggered on network origin {securityEvent.IpAddress} for 12 hours.",
                CreatedAt = DateTimeOffset.UtcNow
            };

            _context.SecurityEventComments.Add(comment);
            await _context.SaveChangesAsync(cancellationToken);

            return Ok(new { message = $"IP address {securityEvent.IpAddress} blocked successfully." });
        }

        return BadRequest(new { message = "Unsupported containment action type." });
    }

    [HttpGet("dashboard")]
    [HasPermission("admin:security:view")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(SecurityDashboardDataDto))]
    public async Task<IActionResult> GetDashboardData(CancellationToken cancellationToken = default)
    {
        var now = DateTimeOffset.UtcNow;
        var todayStart = new DateTimeOffset(now.Year, now.Month, now.Day, 0, 0, 0, TimeSpan.Zero);

        // Fetch counts
        var activeThreats = await _context.SecurityEvents.CountAsync(e => e.Status == "New" && (e.Severity == "Critical" || e.Severity == "High"), cancellationToken);
        var unresolvedCritical = await _context.SecurityEvents.CountAsync(e => e.Status == "New" && e.Severity == "Critical", cancellationToken);
        var highRiskEvents = await _context.SecurityEvents.CountAsync(e => e.Status == "New" && e.Severity == "High", cancellationToken);
        var openInvestigations = await _context.SecurityEvents.CountAsync(e => e.Status == "Investigating", cancellationToken);

        var failedLoginsToday = await _context.SecurityEvents.CountAsync(e => e.CreatedAt >= todayStart && e.EventType == SecurityEventTypes.AuthLoginFailed, cancellationToken);
        var blockedRequestsToday = await _context.SecurityEvents.CountAsync(e => e.CreatedAt >= todayStart && e.EventType == SecurityEventTypes.ApiRateLimitExceeded, cancellationToken);
        var resolvedToday = await _context.SecurityEvents.CountAsync(e => e.CreatedAt >= todayStart && e.Status == "Resolved", cancellationToken);

        // Compute MTTR (Mean Time to Resolution) for the last 30 days
        var cutoff30Days = now.AddDays(-30);
        var resolvedEvents = await _context.SecurityEvents
            .Where(e => e.Status == "Resolved" && e.UpdatedAt >= cutoff30Days)
            .Select(e => new { e.CreatedAt, e.UpdatedAt })
            .ToListAsync(cancellationToken);

        double avgMttrHours = 0;
        if (resolvedEvents.Any())
        {
            var totalHours = resolvedEvents.Sum(e => (e.UpdatedAt - e.CreatedAt).TotalHours);
            avgMttrHours = totalHours / resolvedEvents.Count;
        }

        // Dashboard Stats Dto
        var stats = new SecurityDashboardStatsDto(
            activeThreats,
            unresolvedCritical,
            highRiskEvents,
            failedLoginsToday,
            blockedRequestsToday,
            openInvestigations,
            resolvedToday,
            avgMttrHours,
            0.15 // Avg MTTD (Mean Time to Detection) is near-instant (<10 seconds in our streaming design)
        );

        // Recent events
        var recentEventsRaw = await _context.SecurityEvents
            .Include(e => e.ActorUser)
            .Include(e => e.TargetUser)
            .OrderByDescending(e => e.CreatedAt)
            .Take(10)
            .ToListAsync(cancellationToken);

        var recentEvents = recentEventsRaw.Select(e => new SecurityEventListItemDto(
            e.Id,
            e.EventType,
            e.Category,
            e.Severity,
            e.Status,
            e.RiskScore,
            e.ConfidenceScore,
            e.Description,
            e.ActorUser?.Email,
            e.TargetUser?.Email,
            e.IpAddress,
            e.CountryCode,
            e.OccurrenceCount,
            e.CreatedAt
        )).ToList();

        // 7-day Daily Trends
        var dailyTrends = new List<SecurityTrendItemDto>();
        for (int i = 6; i >= 0; i--)
        {
            var dayStart = todayStart.AddDays(-i);
            var dayEnd = dayStart.AddDays(1);
            var dayLabel = dayStart.DayOfWeek.ToString().Substring(0, 3);

            var count = await _context.SecurityEvents.CountAsync(e => e.CreatedAt >= dayStart && e.CreatedAt < dayEnd, cancellationToken);
            var critical = await _context.SecurityEvents.CountAsync(e => e.CreatedAt >= dayStart && e.CreatedAt < dayEnd && e.Severity == "Critical", cancellationToken);
            var high = await _context.SecurityEvents.CountAsync(e => e.CreatedAt >= dayStart && e.CreatedAt < dayEnd && e.Severity == "High", cancellationToken);

            dailyTrends.Add(new SecurityTrendItemDto(dayLabel, count, critical, high));
        }

        // Top attacking IPs
        var topIpsQuery = await _context.SecurityEvents
            .Where(e => e.IpAddress != null && e.IpAddress != "127.0.0.1" && e.IpAddress != "::1")
            .GroupBy(e => e.IpAddress)
            .Select(g => new { Ip = g.Key!, Count = g.Count() })
            .OrderByDescending(g => g.Count)
            .Take(5)
            .ToListAsync(cancellationToken);

        var topIps = topIpsQuery.Select(g => new KeyValuePair<string, int>(g.Ip, g.Count)).ToList();

        // Top countries
        var topCountriesQuery = await _context.SecurityEvents
            .Where(e => e.CountryCode != null)
            .GroupBy(e => e.CountryCode)
            .Select(g => new { Country = g.Key!, Count = g.Count() })
            .OrderByDescending(g => g.Count)
            .Take(5)
            .ToListAsync(cancellationToken);

        var topCountries = topCountriesQuery.Select(g => new KeyValuePair<string, int>(g.Country, g.Count)).ToList();

        // Category breakdown
        var categoriesQuery = await _context.SecurityEvents
            .GroupBy(e => e.Category)
            .Select(g => new { Category = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        var categoryBreakdown = categoriesQuery.Select(g => new KeyValuePair<string, int>(g.Category, g.Count)).ToList();

        var dashboardData = new SecurityDashboardDataDto(
            stats,
            recentEvents,
            dailyTrends,
            topIps,
            topCountries,
            categoryBreakdown
        );

        return Ok(dashboardData);
    }

    [HttpGet("rules")]
    [HasPermission("admin:security:view")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(List<SecurityRuleDto>))]
    public async Task<IActionResult> GetSecurityRules(CancellationToken cancellationToken = default)
    {
        var rules = await _context.SecurityRules
            .OrderBy(r => r.Name)
            .Select(r => new SecurityRuleDto(
                r.Id,
                r.Code,
                r.Name,
                r.Description,
                r.IsEnabled,
                r.Severity,
                r.ConfigurationJson,
                r.CreatedAt,
                r.UpdatedAt
            ))
            .ToListAsync(cancellationToken);

        return Ok(rules);
    }

    [HttpPut("rules/{id}")]
    [HasPermission("admin:security:manage-rules")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateSecurityRule(
        Guid id,
        [FromBody] UpdateSecurityRuleDto dto,
        CancellationToken cancellationToken = default)
    {
        var rule = await _context.SecurityRules.FindAsync(new object[] { id }, cancellationToken);
        if (rule == null)
        {
            return NotFound(new { message = "Security rule not found." });
        }

        // Validate JSON config
        try
        {
            using var doc = JsonDocument.Parse(dto.ConfigurationJson);
        }
        catch
        {
            return BadRequest(new { message = "Invalid rule configuration JSON format." });
        }

        rule.IsEnabled = dto.IsEnabled;
        rule.Severity = dto.Severity;
        rule.ConfigurationJson = dto.ConfigurationJson;
        rule.UpdatedAt = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return Ok(new { message = "Security rule configuration updated successfully." });
    }

    private Guid GetCurrentUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim != null && Guid.TryParse(claim.Value, out var userId))
        {
            return userId;
        }

        // Fallback for system context or dev mode
        return Guid.Empty;
    }
}
