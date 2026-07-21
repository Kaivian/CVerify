using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Auth.Services;
using CVerify.API.Modules.Intelligence.DTOs;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.System.DTOs;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.Modules.Intelligence.Controllers;

[ApiController]
[Route("api/v1/organizations/{organizationSlug}/talent-pool")]
[Authorize]
public class TalentPoolController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IOrganizationAuthorizationService _authorizationService;
    private readonly ICacheService _cacheService;

    public TalentPoolController(
        ApplicationDbContext context,
        IOrganizationAuthorizationService authorizationService,
        ICacheService cacheService)
    {
        _context = context;
        _authorizationService = authorizationService;
        _cacheService = cacheService;
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(PaginatedResultDto<OrganizationCandidateDto>))]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetTalentPool(
        string organizationSlug,
        [FromQuery] string? query = null,
        [FromQuery] string? location = null,
        [FromQuery] int? minTrustScore = null,
        [FromQuery] string? stage = null,
        [FromQuery] string? sortBy = "highest_trust",
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 12,
        [FromQuery] string? cursor = null,
        CancellationToken cancellationToken = default)
    {
        var org = await _context.Organizations
            .FirstOrDefaultAsync(o => o.Username.ToLower() == organizationSlug.ToLower() && o.DeletedAt == null, cancellationToken)
            .ConfigureAwait(false);

        if (org == null)
        {
            return NotFound(new { message = "Organization not found." });
        }

        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }

        var isMember = await _authorizationService.IsMemberAsync(userId, org.Id, cancellationToken).ConfigureAwait(false);
        if (!isMember)
        {
            return Forbid();
        }

        // Try hit Redis Cache if no cursor-paging is requested (offset pagination cache)
        string? cacheKey = null;
        if (string.IsNullOrEmpty(cursor))
        {
            var cacheVersion = await GetCacheVersionAsync(org.Id).ConfigureAwait(false);
            var filtersHash = $"{query}_{location}_{minTrustScore}_{stage}_{sortBy}";
            cacheKey = $"org:{org.Id}:talent-pool:v:{cacheVersion}:page:{page}:size:{pageSize}:hash:{filtersHash}";

            var cachedData = await _cacheService.GetAsync<PaginatedResultDto<OrganizationCandidateDto>>(cacheKey).ConfigureAwait(false);
            if (cachedData != null)
            {
                return Ok(cachedData);
            }
        }

        var queryable = from oc in _context.OrganizationCandidates
                        join crp in _context.CandidateRankingProjections on oc.CandidateId equals crp.CandidateId into crpGroup
                        from crp in crpGroup.DefaultIfEmpty()
                        join csp in _context.CandidateSearchProfiles on oc.CandidateId equals csp.CandidateId into cspGroup
                        from csp in cspGroup.DefaultIfEmpty()
                        join u in _context.Users on oc.CandidateId equals u.Id
                        join r in _context.Users on oc.RecruiterId equals r.Id into rGroup
                        from r in rGroup.DefaultIfEmpty()
                        where oc.OrganizationId == org.Id
                        select new { oc, crp, csp, u, RecruiterName = r != null ? r.FullName : null };

        // Apply search query
        if (!string.IsNullOrWhiteSpace(query))
        {
            var searchLower = query.ToLower();
            queryable = queryable.Where(x => x.u.FullName.ToLower().Contains(searchLower) ||
                                             (x.u.Username != null && x.u.Username.ToLower().Contains(searchLower)) ||
                                             (x.crp != null && x.crp.Bio != null && x.crp.Bio.ToLower().Contains(searchLower)) ||
                                             (x.crp != null && x.crp.Headline != null && x.crp.Headline.ToLower().Contains(searchLower)));
        }

        // Apply filters
        if (!string.IsNullOrWhiteSpace(location))
        {
            var locLower = location.ToLower();
            queryable = queryable.Where(x => x.crp != null && x.crp.Location != null && x.crp.Location.ToLower().Contains(locLower));
        }

        if (minTrustScore.HasValue)
        {
            queryable = queryable.Where(x => x.crp != null && x.crp.TrustScore >= minTrustScore.Value);
        }

        if (!string.IsNullOrWhiteSpace(stage))
        {
            queryable = queryable.Where(x => x.oc.HiringStage.ToLower() == stage.ToLower());
        }

        // Apply Sorting & Cursor Paging
        if (!string.IsNullOrEmpty(cursor))
        {
            try
            {
                var decoded = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(cursor));
                var parts = decoded.Split('_');
                if (parts.Length == 2 && Guid.TryParse(parts[1], out var cursorId))
                {
                    if (sortBy == "highest_trust")
                    {
                        if (double.TryParse(parts[0], out var cursorScore))
                        {
                            queryable = queryable.Where(x => (x.crp != null ? x.crp.TrustScore : 0) < cursorScore ||
                                                             ((x.crp != null ? x.crp.TrustScore : 0) == cursorScore && x.oc.CandidateId.CompareTo(cursorId) < 0));
                        }
                    }
                    else if (sortBy == "recently_added" || sortBy == "recently_updated")
                    {
                        if (DateTimeOffset.TryParse(parts[0], out var cursorDate))
                        {
                            queryable = queryable.Where(x => x.oc.SavedAt < cursorDate ||
                                                             (x.oc.SavedAt == cursorDate && x.oc.CandidateId.CompareTo(cursorId) < 0));
                        }
                    }
                }
            }
            catch
            {
                // Ignore invalid cursor
            }
        }

        // Ordering
        switch (sortBy?.ToLowerInvariant())
        {
            case "highest_trust":
                queryable = queryable.OrderByDescending(x => x.crp != null ? x.crp.TrustScore : 0)
                                     .ThenByDescending(x => x.oc.CandidateId);
                break;
            case "ai_score":
                queryable = queryable.OrderByDescending(x => x.crp != null ? x.crp.AiScore : 0)
                                     .ThenByDescending(x => x.oc.CandidateId);
                break;
            case "recently_added":
            case "recently_updated":
                queryable = queryable.OrderByDescending(x => x.oc.SavedAt)
                                     .ThenByDescending(x => x.oc.CandidateId);
                break;
            case "alphabetical":
                queryable = queryable.OrderBy(x => x.u.FullName)
                                     .ThenBy(x => x.oc.CandidateId);
                break;
            default:
                queryable = queryable.OrderByDescending(x => x.crp != null ? x.crp.TrustScore : 0)
                                     .ThenByDescending(x => x.oc.CandidateId);
                break;
        }

        var totalCount = await queryable.CountAsync(cancellationToken).ConfigureAwait(false);

        var rawItems = await queryable
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        var dtoList = rawItems.Select(x =>
        {
            List<string> skills = new();
            if (x.crp != null && !string.IsNullOrEmpty(x.crp.TopCapabilitiesJson))
            {
                try
                {
                    var capItems = JsonSerializer.Deserialize<List<ProjectedCapItem>>(x.crp.TopCapabilitiesJson);
                    if (capItems != null)
                    {
                        skills = capItems.Select(c => c.Name).ToList();
                    }
                }
                catch
                {
                    // Ignore JSON deserialization error
                }
            }

            return new OrganizationCandidateDto(
                x.oc.Id,
                x.oc.CandidateId,
                x.u.FullName,
                x.u.Username,
                x.crp?.Headline ?? "Software Engineer",
                x.crp?.Bio,
                x.crp?.Location ?? "Remote",
                x.u.AvatarUrl,
                x.crp != null ? (int)x.crp.TrustScore : 0,
                x.csp?.TrustTier ?? "Verified",
                x.crp != null ? x.crp.AiScore : 0.0,
                x.crp?.CareerLevelLabel ?? "Verified",
                x.crp?.AvailableForHire ?? true,
                skills,
                x.oc.Tags,
                x.oc.HiringStage,
                x.oc.RecruiterId,
                x.RecruiterName,
                x.oc.Notes,
                x.oc.SavedAt
            );
        }).ToList();

        var paginatedResult = new PaginatedResultDto<OrganizationCandidateDto>(dtoList, totalCount, page, pageSize);

        if (cacheKey != null)
        {
            await _cacheService.SetAsync(cacheKey, paginatedResult, TimeSpan.FromMinutes(10)).ConfigureAwait(false);
        }

        return Ok(paginatedResult);
    }

    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created, Type = typeof(OrganizationCandidateDto))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SaveCandidate(
        string organizationSlug,
        [FromBody] SaveCandidateDto dto,
        CancellationToken cancellationToken = default)
    {
        var org = await _context.Organizations
            .FirstOrDefaultAsync(o => o.Username.ToLower() == organizationSlug.ToLower() && o.DeletedAt == null, cancellationToken)
            .ConfigureAwait(false);

        if (org == null)
        {
            return NotFound(new { message = "Organization not found." });
        }

        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }

        var membership = await _context.OrganizationMemberships
            .FirstOrDefaultAsync(om => om.UserId == userId && om.OrganizationId == org.Id && om.Status == "active", cancellationToken)
            .ConfigureAwait(false);

        if (membership == null)
        {
            return Forbid();
        }

        bool isRecruiter = membership.Role == "OWNER" || membership.Role == "REPRESENTATIVE" || membership.Role == "HR";
        if (!isRecruiter)
        {
            return Forbid();
        }

        var candidate = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == dto.CandidateId && u.DeletedAt == null, cancellationToken)
            .ConfigureAwait(false);

        if (candidate == null)
        {
            return BadRequest(new { message = "Candidate user not found." });
        }

        var existing = await _context.OrganizationCandidates
            .AnyAsync(oc => oc.OrganizationId == org.Id && oc.CandidateId == dto.CandidateId, cancellationToken)
            .ConfigureAwait(false);

        if (existing)
        {
            return BadRequest(new { message = "Candidate already saved to the organization's talent pool." });
        }

        var orgCand = new OrganizationCandidate
        {
            Id = Guid.CreateVersion7(),
            OrganizationId = org.Id,
            CandidateId = dto.CandidateId,
            SavedById = userId,
            HiringStage = "Sourced",
            SavedAt = DateTimeOffset.UtcNow
        };

        var auditLog = new AuditLog
        {
            Id = Guid.CreateVersion7(),
            UserId = userId,
            ActorUserId = userId,
            EventType = "ORGANIZATION_CANDIDATE_SAVED",
            Description = $"Candidate '{candidate.FullName}' was saved to organization '{org.Name}' talent pool.",
            OrganizationId = org.Id,
            ScopeType = "ORGANIZATION",
            ScopeId = org.Id,
            ResourceType = "OrganizationCandidate",
            ResourceId = orgCand.Id,
            ResourceDisplayName = candidate.FullName,
            Category = AuditCategory.WorkspaceManagement,
            NewStateJson = JsonSerializer.Serialize(new { orgCand.CandidateId, orgCand.HiringStage })
        };

        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            _context.OrganizationCandidates.Add(orgCand);
            _context.AuditLogs.Add(auditLog);
            await _context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken).ConfigureAwait(false);
            throw;
        }

        await IncrementCacheVersionAsync(org.Id).ConfigureAwait(false);

        return StatusCode(StatusCodes.Status201Created, new { orgCand.Id, orgCand.CandidateId, orgCand.HiringStage, orgCand.SavedAt });
    }

    [HttpPatch("{candidateId}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateCandidateMeta(
        string organizationSlug,
        Guid candidateId,
        [FromBody] UpdateCandidateMetaDto dto,
        CancellationToken cancellationToken = default)
    {
        var org = await _context.Organizations
            .FirstOrDefaultAsync(o => o.Username.ToLower() == organizationSlug.ToLower() && o.DeletedAt == null, cancellationToken)
            .ConfigureAwait(false);

        if (org == null)
        {
            return NotFound(new { message = "Organization not found." });
        }

        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }

        var membership = await _context.OrganizationMemberships
            .FirstOrDefaultAsync(om => om.UserId == userId && om.OrganizationId == org.Id && om.Status == "active", cancellationToken)
            .ConfigureAwait(false);

        if (membership == null)
        {
            return Forbid();
        }

        bool isRecruiter = membership.Role == "OWNER" || membership.Role == "REPRESENTATIVE" || membership.Role == "HR";
        if (!isRecruiter)
        {
            return Forbid();
        }

        var orgCand = await _context.OrganizationCandidates
            .FirstOrDefaultAsync(oc => oc.OrganizationId == org.Id && oc.CandidateId == candidateId, cancellationToken)
            .ConfigureAwait(false);

        if (orgCand == null)
        {
            return NotFound(new { message = "Candidate not found in this organization's talent pool." });
        }

        var oldState = new
        {
            orgCand.Notes,
            orgCand.Tags,
            orgCand.HiringStage,
            orgCand.RecruiterId
        };

        if (dto.Notes != null) orgCand.Notes = dto.Notes;
        if (dto.Tags != null) orgCand.Tags = dto.Tags;
        if (dto.HiringStage != null) orgCand.HiringStage = dto.HiringStage;
        if (dto.RecruiterId.HasValue) orgCand.RecruiterId = dto.RecruiterId.Value == Guid.Empty ? null : dto.RecruiterId.Value;

        var auditLog = new AuditLog
        {
            Id = Guid.CreateVersion7(),
            UserId = userId,
            ActorUserId = userId,
            EventType = "ORGANIZATION_CANDIDATE_UPDATED",
            Description = $"Metadata updated for candidate ID '{candidateId}' in organization '{org.Name}' talent pool.",
            OrganizationId = org.Id,
            ScopeType = "ORGANIZATION",
            ScopeId = org.Id,
            ResourceType = "OrganizationCandidate",
            ResourceId = orgCand.Id,
            Category = AuditCategory.WorkspaceManagement,
            OldStateJson = JsonSerializer.Serialize(oldState),
            NewStateJson = JsonSerializer.Serialize(new
            {
                orgCand.Notes,
                orgCand.Tags,
                orgCand.HiringStage,
                orgCand.RecruiterId
            })
        };

        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            _context.AuditLogs.Add(auditLog);
            await _context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken).ConfigureAwait(false);
            throw;
        }

        await IncrementCacheVersionAsync(org.Id).ConfigureAwait(false);

        return Ok(new { message = "Candidate metadata updated successfully." });
    }

    [HttpDelete("{candidateId}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RemoveCandidate(
        string organizationSlug,
        Guid candidateId,
        CancellationToken cancellationToken = default)
    {
        var org = await _context.Organizations
            .FirstOrDefaultAsync(o => o.Username.ToLower() == organizationSlug.ToLower() && o.DeletedAt == null, cancellationToken)
            .ConfigureAwait(false);

        if (org == null)
        {
            return NotFound(new { message = "Organization not found." });
        }

        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }

        var membership = await _context.OrganizationMemberships
            .FirstOrDefaultAsync(om => om.UserId == userId && om.OrganizationId == org.Id && om.Status == "active", cancellationToken)
            .ConfigureAwait(false);

        if (membership == null)
        {
            return Forbid();
        }

        bool isRecruiter = membership.Role == "OWNER" || membership.Role == "REPRESENTATIVE" || membership.Role == "HR";
        if (!isRecruiter)
        {
            return Forbid();
        }

        var orgCand = await _context.OrganizationCandidates
            .FirstOrDefaultAsync(oc => oc.OrganizationId == org.Id && oc.CandidateId == candidateId, cancellationToken)
            .ConfigureAwait(false);

        if (orgCand == null)
        {
            return NotFound(new { message = "Candidate not found in this organization's talent pool." });
        }

        var auditLog = new AuditLog
        {
            Id = Guid.CreateVersion7(),
            UserId = userId,
            ActorUserId = userId,
            EventType = "ORGANIZATION_CANDIDATE_REMOVED",
            Description = $"Candidate ID '{candidateId}' was removed from organization '{org.Name}' talent pool.",
            OrganizationId = org.Id,
            ScopeType = "ORGANIZATION",
            ScopeId = org.Id,
            ResourceType = "OrganizationCandidate",
            ResourceId = orgCand.Id,
            Category = AuditCategory.WorkspaceManagement,
            OldStateJson = JsonSerializer.Serialize(new { orgCand.CandidateId, orgCand.HiringStage })
        };

        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            _context.OrganizationCandidates.Remove(orgCand);
            _context.AuditLogs.Add(auditLog);
            await _context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken).ConfigureAwait(false);
            throw;
        }

        await IncrementCacheVersionAsync(org.Id).ConfigureAwait(false);

        return Ok(new { message = "Candidate removed from talent pool successfully." });
    }

    [HttpPost("bulk")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> BulkAction(
        string organizationSlug,
        [FromBody] BulkActionDto dto,
        CancellationToken cancellationToken = default)
    {
        var org = await _context.Organizations
            .FirstOrDefaultAsync(o => o.Username.ToLower() == organizationSlug.ToLower() && o.DeletedAt == null, cancellationToken)
            .ConfigureAwait(false);

        if (org == null)
        {
            return NotFound(new { message = "Organization not found." });
        }

        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }

        var membership = await _context.OrganizationMemberships
            .FirstOrDefaultAsync(om => om.UserId == userId && om.OrganizationId == org.Id && om.Status == "active", cancellationToken)
            .ConfigureAwait(false);

        if (membership == null)
        {
            return Forbid();
        }

        bool isRecruiter = membership.Role == "OWNER" || membership.Role == "REPRESENTATIVE" || membership.Role == "HR";
        if (!isRecruiter)
        {
            return Forbid();
        }

        var candidates = await _context.OrganizationCandidates
            .Where(oc => oc.OrganizationId == org.Id && dto.CandidateIds.Contains(oc.CandidateId))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        if (!candidates.Any())
        {
            return BadRequest(new { message = "No valid candidates found for the specified IDs." });
        }

        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (dto.ActionType.Equals("Delete", StringComparison.OrdinalIgnoreCase))
            {
                foreach (var oc in candidates)
                {
                    _context.OrganizationCandidates.Remove(oc);
                    _context.AuditLogs.Add(new AuditLog
                    {
                        Id = Guid.CreateVersion7(),
                        UserId = userId,
                        ActorUserId = userId,
                        EventType = "ORGANIZATION_CANDIDATE_REMOVED",
                        Description = $"Candidate ID '{oc.CandidateId}' was removed from organization '{org.Name}' talent pool via bulk action.",
                        OrganizationId = org.Id,
                        ScopeType = "ORGANIZATION",
                        ScopeId = org.Id,
                        ResourceType = "OrganizationCandidate",
                        ResourceId = oc.Id,
                        Category = AuditCategory.WorkspaceManagement
                    });
                }
            }
            else if (dto.ActionType.Equals("UpdateStage", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrEmpty(dto.StageValue))
            {
                foreach (var oc in candidates)
                {
                    var oldStage = oc.HiringStage;
                    oc.HiringStage = dto.StageValue;
                    _context.AuditLogs.Add(new AuditLog
                    {
                        Id = Guid.CreateVersion7(),
                        UserId = userId,
                        ActorUserId = userId,
                        EventType = "ORGANIZATION_CANDIDATE_STAGE_UPDATED",
                        Description = $"Stage updated from '{oldStage}' to '{dto.StageValue}' for candidate ID '{oc.CandidateId}' via bulk action.",
                        OrganizationId = org.Id,
                        ScopeType = "ORGANIZATION",
                        ScopeId = org.Id,
                        ResourceType = "OrganizationCandidate",
                        ResourceId = oc.Id,
                        Category = AuditCategory.WorkspaceManagement
                    });
                }
            }
            else if (dto.ActionType.Equals("AddTags", StringComparison.OrdinalIgnoreCase) && dto.TagValues != null)
            {
                foreach (var oc in candidates)
                {
                    oc.Tags = oc.Tags.Union(dto.TagValues).Distinct().ToList();
                    _context.AuditLogs.Add(new AuditLog
                    {
                        Id = Guid.CreateVersion7(),
                        UserId = userId,
                        ActorUserId = userId,
                        EventType = "ORGANIZATION_CANDIDATE_TAGS_UPDATED",
                        Description = $"Tags appended for candidate ID '{oc.CandidateId}' via bulk action.",
                        OrganizationId = org.Id,
                        ScopeType = "ORGANIZATION",
                        ScopeId = org.Id,
                        ResourceType = "OrganizationCandidate",
                        ResourceId = oc.Id,
                        Category = AuditCategory.WorkspaceManagement
                    });
                }
            }

            await _context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken).ConfigureAwait(false);
            throw;
        }

        await IncrementCacheVersionAsync(org.Id).ConfigureAwait(false);

        return Ok(new { message = "Bulk action completed successfully." });
    }

    [HttpGet("analytics")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(TalentPoolAnalyticsDto))]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetAnalytics(
        string organizationSlug,
        CancellationToken cancellationToken = default)
    {
        var org = await _context.Organizations
            .FirstOrDefaultAsync(o => o.Username.ToLower() == organizationSlug.ToLower() && o.DeletedAt == null, cancellationToken)
            .ConfigureAwait(false);

        if (org == null)
        {
            return NotFound(new { message = "Organization not found." });
        }

        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }

        var isMember = await _authorizationService.IsMemberAsync(userId, org.Id, cancellationToken).ConfigureAwait(false);
        if (!isMember)
        {
            return Forbid();
        }

        var query = from oc in _context.OrganizationCandidates
                    join crp in _context.CandidateRankingProjections on oc.CandidateId equals crp.CandidateId into crpGroup
                    from crp in crpGroup.DefaultIfEmpty()
                    where oc.OrganizationId == org.Id
                    select new { oc.HiringStage, crp };

        var records = await query.ToListAsync(cancellationToken).ConfigureAwait(false);

        var total = records.Count;
        var verified = records.Count(r => r.crp != null && r.crp.VerifiedRepoCount > 0);
        var avgTrust = total > 0 ? records.Average(r => r.crp != null ? r.crp.TrustScore : 0) : 0;

        var stageDist = records.GroupBy(r => r.HiringStage)
            .ToDictionary(g => g.Key, g => g.Count());

        var expDist = records.GroupBy(r => r.crp?.CareerLevelLabel ?? "Unspecified")
            .ToDictionary(g => g.Key, g => g.Count());

        var skillDict = new Dictionary<string, int>();
        foreach (var r in records)
        {
            if (r.crp != null && !string.IsNullOrEmpty(r.crp.TopCapabilitiesJson))
            {
                try
                {
                    var capItems = JsonSerializer.Deserialize<List<ProjectedCapItem>>(r.crp.TopCapabilitiesJson);
                    if (capItems != null)
                    {
                        foreach (var cap in capItems)
                        {
                            if (!skillDict.ContainsKey(cap.Name)) skillDict[cap.Name] = 0;
                            skillDict[cap.Name]++;
                        }
                    }
                }
                catch
                {
                    // Ignore JSON parse error
                }
            }
        }

        var topSkills = skillDict.OrderByDescending(kv => kv.Value).Take(10).ToDictionary(kv => kv.Key, kv => kv.Value);

        return Ok(new TalentPoolAnalyticsDto(
            total,
            verified,
            avgTrust,
            stageDist,
            topSkills,
            expDist
        ));
    }

    private async Task<int> GetCacheVersionAsync(Guid orgId)
    {
        var key = $"org:{orgId}:talent-pool:version";
        var version = await _cacheService.GetAsync<int?>(key).ConfigureAwait(false);
        if (!version.HasValue)
        {
            version = 1;
            await _cacheService.SetAsync(key, version.Value, TimeSpan.FromDays(30)).ConfigureAwait(false);
        }
        return version.Value;
    }

    private async Task IncrementCacheVersionAsync(Guid orgId)
    {
        var key = $"org:{orgId}:talent-pool:version";
        var version = await GetCacheVersionAsync(orgId).ConfigureAwait(false);
        await _cacheService.SetAsync(key, version + 1, TimeSpan.FromDays(30)).ConfigureAwait(false);
    }

    private class ProjectedCapItem
    {
        public string Name { get; set; } = null!;
    }
}
