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
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Services;
using CVerify.API.Modules.Shared.Domain.Constants;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Security.Authorization.Attributes;
using CVerify.API.Modules.Shared.System.DTOs;

namespace CVerify.API.Modules.Admin.Controllers;

[ApiController]
[Route("api/admin/enterprise")]
[Authorize(Roles = "SUPER_ADMIN,ADMIN")]
public class EnterpriseOperationsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IActivityEventPublisher _eventPublisher;
    private readonly INotificationDispatcher _notificationDispatcher;

    public EnterpriseOperationsController(
        ApplicationDbContext context,
        IActivityEventPublisher eventPublisher,
        INotificationDispatcher notificationDispatcher)
    {
        _context = context;
        _eventPublisher = eventPublisher;
        _notificationDispatcher = notificationDispatcher;
    }

    // --- Organizations Endpoints ---

    [HttpGet("organizations")]
    [HasPermission("admin:enterprise:view")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(PaginatedResultDto<OrganizationAdminListItemDto>))]
    public async Task<IActionResult> GetOrganizations(
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery] bool? isVerified = null,
        [FromQuery] int? verificationLevel = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 15,
        CancellationToken cancellationToken = default)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 15;

        var query = _context.Organizations.AsQueryable();

        if (!string.IsNullOrEmpty(search))
        {
            query = query.Where(o => o.Name.Contains(search)
                                  || o.TaxCode.Contains(search)
                                  || o.Email.Contains(search)
                                  || (o.Website != null && o.Website.Contains(search)));
        }

        if (!string.IsNullOrEmpty(status))
        {
            query = query.Where(o => o.Status == status);
        }

        if (isVerified.HasValue)
        {
            query = query.Where(o => o.IsVerified == isVerified.Value);
        }

        if (verificationLevel.HasValue)
        {
            query = query.Where(o => o.VerificationLevel == verificationLevel.Value);
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(o => o.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(o => new OrganizationAdminListItemDto(
                o.Id,
                o.Name,
                o.TaxCode,
                o.Email,
                o.Status,
                o.IsVerified,
                o.VerificationLevel,
                _context.Workspaces.Count(w => w.OrganizationId == o.Id),
                _context.OrganizationAuthorities.Count(m => m.OrganizationId == o.Id),
                _context.SecurityEvents.Count(e => e.OrganizationId == o.Id && e.RiskScore >= 70), // High risk score calculation
                o.CreatedAt
            ))
            .ToListAsync(cancellationToken);

        return Ok(new PaginatedResultDto<OrganizationAdminListItemDto>(items, totalCount, page, pageSize));
    }

    [HttpGet("organizations/{id}")]
    [HasPermission("admin:enterprise:view")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(OrganizationAdminDetailDto))]
    public async Task<IActionResult> GetOrganization(Guid id, CancellationToken cancellationToken = default)
    {
        var org = await _context.Organizations
            .FirstOrDefaultAsync(o => o.Id == id, cancellationToken);

        if (org == null) return NotFound();

        var workspaces = await _context.Workspaces
            .Where(w => w.OrganizationId == org.Id)
            .Select(w => new WorkspaceMiniDto(
                w.Id,
                w.DisplayName,
                w.Description,
                _context.WorkspaceMembers.Count(wm => wm.WorkspaceId == w.Id),
                w.CreatedAt
            ))
            .ToListAsync(cancellationToken);

        var detail = new OrganizationAdminDetailDto(
            org.Id,
            org.Name,
            org.TaxCode,
            org.Email,
            org.Username,
            org.RegistrationNumber,
            org.Status,
            org.IsVerified,
            org.VerificationLevel,
            org.RepresentativeName,
            org.RepresentativeEmail,
            org.RepresentativePhone,
            org.Website,
            org.Description,
            org.OrganizationType,
            org.OrganizationSize,
            org.CreatedAt,
            org.IndustryTags,
            workspaces,
            await _context.SecurityEvents.CountAsync(e => e.OrganizationId == org.Id && e.RiskScore >= 70, cancellationToken)
        );

        return Ok(detail);
    }

    [HttpPatch("organizations/{id}/status")]
    [HasPermission("admin:enterprise:manage")]
    public async Task<IActionResult> UpdateOrganizationStatus(
        Guid id,
        [FromBody] UpdateOrgStatusDto dto,
        CancellationToken cancellationToken = default)
    {
        var org = await _context.Organizations.FindAsync(new object[] { id }, cancellationToken);
        if (org == null) return NotFound();

        var actorClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (actorClaim == null || !Guid.TryParse(actorClaim.Value, out var actorUserId))
        {
            return Unauthorized();
        }

        var oldStatus = org.Status;
        org.Status = dto.Status;
        org.UpdatedAt = DateTimeOffset.UtcNow;

        _context.Organizations.Update(org);

        // Publish event to generate audit log
        var eventType = dto.Status == "suspended" ? ActivityEventTypes.OrganizationSuspended : ActivityEventTypes.OrganizationReactivated;
        await _eventPublisher.PublishAsync(
            eventType: eventType,
            resourceType: "organization",
            resourceId: org.Id,
            organizationId: org.Id,
            actorUserId: actorUserId,
            payload: new { oldStatus, newStatus = dto.Status, reason = dto.Reason }
        );

        await _context.SaveChangesAsync(cancellationToken);

        // Broadcast stats updates
        await BroadcastQueueStatsAsync(cancellationToken);

        return NoContent();
    }

    // --- Unified Operations / Workflow Requests Queue ---

    [HttpGet("requests")]
    [HasPermission("admin:enterprise:view")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(PaginatedResultDto<EnterpriseWorkflowRequestListItemDto>))]
    public async Task<IActionResult> GetRequests(
        [FromQuery] string? requestType = null,
        [FromQuery] string? status = null,
        [FromQuery] string? priority = null,
        [FromQuery] bool? slaBreached = null,
        [FromQuery] Guid? assignedReviewerId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 15,
        CancellationToken cancellationToken = default)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 15;

        var query = _context.EnterpriseWorkflowRequests
            .Include(r => r.Organization)
            .Include(r => r.AssignedReviewer)
            .AsQueryable();

        if (!string.IsNullOrEmpty(requestType))
        {
            query = query.Where(r => r.RequestType == requestType);
        }

        if (!string.IsNullOrEmpty(status))
        {
            query = query.Where(r => r.Status == status);
        }

        if (!string.IsNullOrEmpty(priority))
        {
            query = query.Where(r => r.Priority == priority);
        }

        if (assignedReviewerId.HasValue)
        {
            query = query.Where(r => r.AssignedReviewerId == assignedReviewerId.Value);
        }

        if (slaBreached.HasValue)
        {
            var now = DateTimeOffset.UtcNow;
            if (slaBreached.Value)
            {
                query = query.Where(r => r.DueAt.HasValue && r.DueAt.Value < now && r.Status != "Approved" && r.Status != "Rejected" && r.Status != "Resolved" && r.Status != "Dismissed");
            }
            else
            {
                query = query.Where(r => !r.DueAt.HasValue || r.DueAt.Value >= now || r.Status == "Approved" || r.Status == "Rejected" || r.Status == "Resolved" || r.Status == "Dismissed");
            }
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new EnterpriseWorkflowRequestListItemDto(
                r.Id,
                r.OrganizationId,
                r.Organization.Name,
                r.RequestType,
                r.Status,
                r.Priority,
                r.AssignedReviewerId,
                r.AssignedReviewer != null ? r.AssignedReviewer.FullName : null,
                r.DueAt,
                r.Status != "Approved" && r.Status != "Rejected" && r.Status != "Resolved" && r.Status != "Dismissed" && r.DueAt.HasValue && r.DueAt.Value < DateTimeOffset.UtcNow,
                r.CreatedAt
            ))
            .ToListAsync(cancellationToken);

        return Ok(new PaginatedResultDto<EnterpriseWorkflowRequestListItemDto>(items, totalCount, page, pageSize));
    }

    [HttpGet("requests/{id}")]
    [HasPermission("admin:enterprise:view")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(EnterpriseWorkflowRequestDetailDto))]
    public async Task<IActionResult> GetRequest(Guid id, CancellationToken cancellationToken = default)
    {
        var req = await _context.EnterpriseWorkflowRequests
            .Include(r => r.Organization)
            .Include(r => r.AssignedReviewer)
            .Include(r => r.EscalatedToUser)
            .Include(r => r.Attachments)
            .Include(r => r.Comments)
                .ThenInclude(c => c.AuthorUser)
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

        if (req == null) return NotFound();

        var comments = req.Comments
            .OrderBy(c => c.CreatedAt)
            .Select(c => new WorkflowCommentDto(
                c.Id,
                c.AuthorUser.FullName,
                c.AuthorUser.Email,
                c.Content,
                c.CreatedAt
            ))
            .ToList();

        var attachments = req.Attachments
            .Select(a => new WorkflowAttachmentDto(
                a.Id,
                a.FileName,
                a.ContentType,
                a.CreatedAt
            ))
            .ToList();

        var detail = new EnterpriseWorkflowRequestDetailDto(
            req.Id,
            req.OrganizationId,
            req.Organization.Name,
            req.RequestType,
            req.Status,
            req.Priority,
            req.MetadataJson,
            req.AssignedReviewerId,
            req.AssignedReviewer?.FullName,
            req.AssignedAt,
            req.ClaimedAt,
            req.DueAt,
            req.SlaBreached,
            req.EscalatedToUserId,
            req.EscalatedToUser?.FullName,
            req.ReviewState,
            attachments,
            comments,
            req.CreatedAt
        );

        return Ok(detail);
    }

    [HttpPost("requests/{id}/claim")]
    [HasPermission("admin:enterprise:manage")]
    public async Task<IActionResult> ClaimRequest(Guid id, CancellationToken cancellationToken = default)
    {
        var req = await _context.EnterpriseWorkflowRequests
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

        if (req == null) return NotFound();

        if (req.AssignedReviewerId.HasValue)
        {
            return StatusCode(StatusCodes.Status409Conflict, "This request has already been claimed by another administrator.");
        }

        var claim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null || !Guid.TryParse(claim.Value, out var actorUserId))
        {
            return Unauthorized();
        }

        req.AssignedReviewerId = actorUserId;
        req.AssignedAt = DateTimeOffset.UtcNow;
        req.ClaimedAt = DateTimeOffset.UtcNow;
        req.Status = "UnderReview";
        req.UpdatedAt = DateTimeOffset.UtcNow;

        _context.EnterpriseWorkflowRequests.Update(req);

        // Publish activity event
        await _eventPublisher.PublishAsync(
            eventType: ActivityEventTypes.EnterpriseRequestClaimed,
            resourceType: "workflow_request",
            resourceId: req.Id,
            organizationId: req.OrganizationId,
            actorUserId: actorUserId,
            payload: new { req.RequestType, req.Priority }
        );

        try
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return StatusCode(StatusCodes.Status409Conflict, "This request has already been claimed or modified by another administrator.");
        }

        await BroadcastQueueStatsAsync(cancellationToken);

        return NoContent();
    }

    [HttpPost("requests/{id}/unclaim")]
    [HasPermission("admin:enterprise:manage")]
    public async Task<IActionResult> UnclaimRequest(Guid id, CancellationToken cancellationToken = default)
    {
        var req = await _context.EnterpriseWorkflowRequests
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

        if (req == null) return NotFound();

        var claim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null || !Guid.TryParse(claim.Value, out var actorUserId))
        {
            return Unauthorized();
        }

        if (req.AssignedReviewerId != actorUserId)
        {
            return Forbid();
        }

        req.AssignedReviewerId = null;
        req.AssignedAt = null;
        req.ClaimedAt = null;
        req.Status = "Pending";
        req.UpdatedAt = DateTimeOffset.UtcNow;

        _context.EnterpriseWorkflowRequests.Update(req);

        await _eventPublisher.PublishAsync(
            eventType: ActivityEventTypes.EnterpriseRequestReleased,
            resourceType: "workflow_request",
            resourceId: req.Id,
            organizationId: req.OrganizationId,
            actorUserId: actorUserId,
            payload: new { req.RequestType }
        );

        try
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return StatusCode(StatusCodes.Status409Conflict, "This request was modified by another transaction.");
        }

        await BroadcastQueueStatsAsync(cancellationToken);

        return NoContent();
    }

    [HttpPost("requests/{id}/escalate")]
    [HasPermission("admin:enterprise:manage")]
    public async Task<IActionResult> EscalateRequest(Guid id, CancellationToken cancellationToken = default)
    {
        var req = await _context.EnterpriseWorkflowRequests
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

        if (req == null) return NotFound();

        var claim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null || !Guid.TryParse(claim.Value, out var actorUserId))
        {
            return Unauthorized();
        }

        req.Status = "Escalated";
        req.Priority = "Critical";
        req.UpdatedAt = DateTimeOffset.UtcNow;

        // Auto-assign to senior administrators by clearing the active reviewer and setting state
        req.AssignedReviewerId = null;

        var comment = new WorkflowComment
        {
            Id = Guid.CreateVersion7(),
            WorkflowRequestId = req.Id,
            AuthorUserId = actorUserId,
            Content = "Request escalated to senior security review due to suspicious metadata or verification mismatch.",
            IsInternalOnly = true,
            CreatedAt = DateTimeOffset.UtcNow
        };
        _context.WorkflowComments.Add(comment);
        _context.EnterpriseWorkflowRequests.Update(req);

        await _context.SaveChangesAsync(cancellationToken);
        await BroadcastQueueStatsAsync(cancellationToken);

        return NoContent();
    }

    [HttpPost("requests/{id}/resolve")]
    [HasPermission("admin:enterprise:manage")]
    public async Task<IActionResult> ResolveRequest(
        Guid id,
        [FromBody] ResolveRequestDto dto,
        CancellationToken cancellationToken = default)
    {
        var req = await _context.EnterpriseWorkflowRequests
            .Include(r => r.Organization)
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

        if (req == null) return NotFound();

        var claim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null || !Guid.TryParse(claim.Value, out var actorUserId))
        {
            return Unauthorized();
        }

        req.Status = dto.Status; // "Approved" or "Rejected" or "Resolved"
        req.ResolvedAt = DateTimeOffset.UtcNow;
        req.UpdatedAt = DateTimeOffset.UtcNow;

        var comment = new WorkflowComment
        {
            Id = Guid.CreateVersion7(),
            WorkflowRequestId = req.Id,
            AuthorUserId = actorUserId,
            Content = $"Request resolved. Decision: {dto.Status}. Notes: {dto.Notes}",
            IsInternalOnly = true,
            CreatedAt = DateTimeOffset.UtcNow
        };
        _context.WorkflowComments.Add(comment);

        // Apply business transitions based on RequestType
        if (dto.Status == "Approved" || dto.Status == "Resolved")
        {
            if (req.RequestType == "Verification" || req.RequestType == "Registration")
            {
                req.Organization.IsVerified = true;
                req.Organization.VerificationLevel = 2; // Level 2 (Domain/Tax Verified)
                req.Organization.Status = "active";
                _context.Organizations.Update(req.Organization);
            }
        }
        else if (dto.Status == "Rejected")
        {
            if (req.RequestType == "Registration")
            {
                req.Organization.Status = "archived";
                _context.Organizations.Update(req.Organization);
            }
        }

        _context.EnterpriseWorkflowRequests.Update(req);

        // Emit projection event
        await _eventPublisher.PublishAsync(
            eventType: ActivityEventTypes.EnterpriseRequestResolved,
            resourceType: "workflow_request",
            resourceId: req.Id,
            organizationId: req.OrganizationId,
            actorUserId: actorUserId,
            payload: new { req.RequestType, decision = dto.Status }
        );

        await _context.SaveChangesAsync(cancellationToken);
        await BroadcastQueueStatsAsync(cancellationToken);

        return NoContent();
    }

    [HttpPost("requests/{id}/comments")]
    [HasPermission("admin:enterprise:manage")]
    public async Task<IActionResult> AddComment(
        Guid id,
        [FromBody] AddCommentDto dto,
        CancellationToken cancellationToken = default)
    {
        var req = await _context.EnterpriseWorkflowRequests.FindAsync(new object[] { id }, cancellationToken);
        if (req == null) return NotFound();

        var claim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null || !Guid.TryParse(claim.Value, out var actorUserId))
        {
            return Unauthorized();
        }

        var comment = new WorkflowComment
        {
            Id = Guid.CreateVersion7(),
            WorkflowRequestId = req.Id,
            AuthorUserId = actorUserId,
            Content = dto.Content,
            IsInternalOnly = true,
            CreatedAt = DateTimeOffset.UtcNow
        };

        _context.WorkflowComments.Add(comment);
        await _context.SaveChangesAsync(cancellationToken);

        return Ok(new WorkflowCommentDto(comment.Id, User.Identity?.Name ?? "Admin", "admin@cverify.com", comment.Content, comment.CreatedAt));
    }

    [HttpGet("stats")]
    [HasPermission("admin:enterprise:view")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(WorkflowDashboardStatsDto))]
    public async Task<IActionResult> GetStats(CancellationToken cancellationToken = default)
    {
        var now = DateTimeOffset.UtcNow;
        var pending = await _context.EnterpriseWorkflowRequests.CountAsync(r => r.Status == "Pending", cancellationToken);
        var claimed = await _context.EnterpriseWorkflowRequests.CountAsync(r => r.Status == "UnderReview", cancellationToken);
        var breached = await _context.EnterpriseWorkflowRequests.CountAsync(r => r.DueAt.HasValue && r.DueAt.Value < now && r.Status != "Approved" && r.Status != "Rejected" && r.Status != "Resolved" && r.Status != "Dismissed", cancellationToken);
        var highRisk = await _context.EnterpriseWorkflowRequests.CountAsync(r => r.Priority == "Critical" || r.Priority == "High", cancellationToken);

        var totalResolved = await _context.EnterpriseWorkflowRequests.CountAsync(r => r.Status == "Approved" || r.Status == "Rejected" || r.Status == "Resolved", cancellationToken);
        var approved = await _context.EnterpriseWorkflowRequests.CountAsync(r => r.Status == "Approved" || r.Status == "Resolved", cancellationToken);

        double approvalRate = totalResolved == 0 ? 0.0 : (double)approved / totalResolved * 100.0;
        double rejectionRate = totalResolved == 0 ? 0.0 : 100.0 - approvalRate;

        return Ok(new WorkflowDashboardStatsDto(pending, claimed, breached, highRisk, Math.Round(approvalRate, 1), Math.Round(rejectionRate, 1)));
    }

    [HttpPost("seed-demo-requests")]
    [HasPermission("admin:enterprise:manage")]
    public async Task<IActionResult> SeedDemoRequests(CancellationToken cancellationToken = default)
    {
        var count = await _context.EnterpriseWorkflowRequests.CountAsync(cancellationToken);
        if (count > 0)
        {
            return BadRequest("Queue already has requests.");
        }

        var orgs = await _context.Organizations.Take(3).ToListAsync(cancellationToken);
        if (orgs.Count == 0)
        {
            return BadRequest("No organizations exist to seed requests for.");
        }

        var reqs = new List<EnterpriseWorkflowRequest>();

        // 1. Verification request
        reqs.Add(new EnterpriseWorkflowRequest
        {
            Id = Guid.CreateVersion7(),
            OrganizationId = orgs[0].Id,
            RequestType = "Verification",
            Status = "Pending",
            Priority = "High",
            DueAt = DateTimeOffset.UtcNow.AddHours(24),
            MetadataJson = "{\"OfficialName\":\"" + orgs[0].Name + "\",\"TaxCode\":\"" + orgs[0].TaxCode + "\",\"DocumentType\":\"BusinessLicense\",\"DocumentUrl\":\"https://cverify-storage/docs/license1.pdf\"}",
            CreatedAt = DateTimeOffset.UtcNow.AddHours(-2)
        });

        // 2. Abuse report
        if (orgs.Count > 1)
        {
            reqs.Add(new EnterpriseWorkflowRequest
            {
                Id = Guid.CreateVersion7(),
                OrganizationId = orgs[1].Id,
                RequestType = "Report",
                Status = "Pending",
                Priority = "Critical",
                DueAt = DateTimeOffset.UtcNow.AddHours(2),
                MetadataJson = "{\"Reporter\":\"security-alert@cverify.com\",\"Reason\":\"Impersonation\",\"Severity\":\"Critical\",\"Description\":\"This company is pretending to be a major tech firm and posting scam job offers.\",\"EvidenceUrl\":\"https://cverify-storage/docs/evidence.jpg\"}",
                CreatedAt = DateTimeOffset.UtcNow.AddHours(-1)
            });
        }

        // 3. Appeal
        if (orgs.Count > 2)
        {
            reqs.Add(new EnterpriseWorkflowRequest
            {
                Id = Guid.CreateVersion7(),
                OrganizationId = orgs[2].Id,
                RequestType = "Appeal",
                Status = "Pending",
                Priority = "Medium",
                DueAt = DateTimeOffset.UtcNow.AddHours(12),
                MetadataJson = "{\"PreviousDecision\":\"Suspension\",\"Reason\":\"We have updated our registration details and verified our domain. Please reactivate our workspace.\",\"NewEvidenceUrl\":\"https://cverify-storage/docs/appeal-proof.pdf\"}",
                CreatedAt = DateTimeOffset.UtcNow.AddHours(-3)
            });
        }

        _context.EnterpriseWorkflowRequests.AddRange(reqs);
        await _context.SaveChangesAsync(cancellationToken);

        return Ok("Successfully seeded 3 demo requests.");
    }

    // --- Helper Real-Time Broadcaster ---

    private async Task BroadcastQueueStatsAsync(CancellationToken cancellationToken)
    {
        try
        {
            // Find all admin IDs
            var admins = await _context.Users
                .Where(u => u.Roles.Any(r => r.Name == "ADMIN" || r.Name == "SUPER_ADMIN"))
                .Select(u => u.Id)
                .ToListAsync(cancellationToken);

            // Construct stats
            var now = DateTimeOffset.UtcNow;
            var pending = await _context.EnterpriseWorkflowRequests.CountAsync(r => r.Status == "Pending", cancellationToken);
            var breached = await _context.EnterpriseWorkflowRequests.CountAsync(r => r.DueAt.HasValue && r.DueAt.Value < now && r.Status != "Approved" && r.Status != "Rejected", cancellationToken);

            var payload = new
            {
                Type = "ENTERPRISE_QUEUE_STATS_REFRESH",
                Pending = pending,
                Breached = breached,
                Timestamp = DateTimeOffset.UtcNow
            };

            foreach (var adminId in admins)
            {
                await _notificationDispatcher.PublishNotificationAsync(adminId, payload);
            }
        }
        catch (Exception ex)
        {
            // Fail silent to not crash active requests
            Console.WriteLine($"[SignalR Broadcast Error]: {ex.Message}");
        }
    }
}
