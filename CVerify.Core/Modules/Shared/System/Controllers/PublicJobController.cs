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
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.System.Services;
using CVerify.API.Modules.Intelligence.Services;

namespace CVerify.API.Modules.Shared.System.Controllers;

[ApiController]
public class PublicJobController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IJobEligibilityService _eligibilityService;
    private readonly IExplainableMatchService _matchService;
    private readonly IJobRankingStrategy _rankingStrategy;
    private readonly IRecommendationProvider _recommendationProvider;

    public PublicJobController(
        ApplicationDbContext context,
        IJobEligibilityService eligibilityService,
        IExplainableMatchService matchService,
        IJobRankingStrategy rankingStrategy,
        IRecommendationProvider recommendationProvider)
    {
        _context = context;
        _eligibilityService = eligibilityService;
        _matchService = matchService;
        _rankingStrategy = rankingStrategy;
        _recommendationProvider = recommendationProvider;
    }

    [HttpGet("api/v1/public/jobs")]
    [AllowAnonymous]
    public async Task<IActionResult> Search(
        [FromQuery] string? query,
        [FromQuery] string? location,
        [FromQuery] string? workplaceType,
        [FromQuery] string? employmentType,
        [FromQuery] string? seniority,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken cancellationToken = default)
    {
        var dbQuery = _context.JobVacancies
            .Include(j => j.Organization)
            .Where(j => j.Status == "Published" && j.IsActive);

        // Filters
        if (!string.IsNullOrEmpty(location))
        {
            dbQuery = dbQuery.Where(j => j.City.ToLower().Contains(location.ToLower()));
        }
        if (!string.IsNullOrEmpty(workplaceType))
        {
            dbQuery = dbQuery.Where(j => j.WorkplaceType.ToLower() == workplaceType.ToLower());
        }
        if (!string.IsNullOrEmpty(employmentType))
        {
            dbQuery = dbQuery.Where(j => j.Type.ToLower() == employmentType.ToLower());
        }
        if (!string.IsNullOrEmpty(seniority))
        {
            dbQuery = dbQuery.Where(j => j.Experience.ToLower().Contains(seniority.ToLower()));
        }

        var jobs = await dbQuery
            .OrderByDescending(j => j.CreatedAt)
            .ToListAsync(cancellationToken);

        // Post-filter on query or discovery eligibility if user is logged in
        Guid? currentUserId = null;
        var userIdClaim = User?.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim != null && Guid.TryParse(userIdClaim.Value, out var parsedId))
        {
            currentUserId = parsedId;
        }

        var eligibleJobs = new List<JobVacancy>();
        foreach (var job in jobs)
        {
            // Apply text query matches if provided
            if (!string.IsNullOrEmpty(query))
            {
                var cleanQuery = query.ToLower();
                bool matches = job.Title.ToLower().Contains(cleanQuery) ||
                               job.Department.ToLower().Contains(cleanQuery) ||
                               job.Skills.Any(s => s.ToLower().Contains(cleanQuery));
                if (!matches) continue;
            }

            eligibleJobs.Add(job);
        }

        // Apply ranking strategy if candidate is logged in
        if (currentUserId.HasValue)
        {
            var candidateProfile = await _context.CandidateSearchProfiles
                .FirstOrDefaultAsync(p => p.CandidateId == currentUserId.Value, cancellationToken);

            if (candidateProfile != null)
            {
                var ranked = new List<(JobVacancy Job, double Rank)>();
                foreach (var job in eligibleJobs)
                {
                    try
                    {
                        var eval = await _matchService.EvaluateMatchAsync(job.Id, currentUserId.Value);
                        double rank = _rankingStrategy.CalculateRank(job, candidateProfile, eval);
                        ranked.Add((job, rank));
                    }
                    catch
                    {
                        ranked.Add((job, 0.0));
                    }
                }
                eligibleJobs = ranked.OrderByDescending(r => r.Rank).Select(r => r.Job).ToList();
            }
        }

        // Manual in-memory pagination
        var paginated = eligibleJobs
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(j => MapToPublicJobDto(j))
            .ToList();

        return Ok(new { items = paginated, total = eligibleJobs.Count, page, pageSize });
    }

    [HttpGet("api/v1/public/jobs/{id}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetDetails(Guid id, CancellationToken cancellationToken)
    {
        var job = await _context.JobVacancies
            .Include(j => j.Organization)
            .FirstOrDefaultAsync(j => j.Id == id, cancellationToken);

        if (job == null) return NotFound(new { message = "Job vacancy not found." });

        // Record interaction & emit viewed event if authenticated
        var userIdClaim = User?.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim != null && Guid.TryParse(userIdClaim.Value, out var userId))
        {
            var existingInteraction = await _context.JobInteractions
                .FirstOrDefaultAsync(ji => ji.UserId == userId && ji.JobVacancyId == id && ji.InteractionType == "Viewed", cancellationToken);

            if (existingInteraction != null)
            {
                existingInteraction.InteractionAt = DateTimeOffset.UtcNow;
                _context.JobInteractions.Update(existingInteraction);
            }
            else
            {
                var interaction = new JobInteraction
                {
                    Id = Guid.CreateVersion7(),
                    UserId = userId,
                    JobVacancyId = id,
                    InteractionType = "Viewed",
                    InteractionAt = DateTimeOffset.UtcNow
                };
                _context.JobInteractions.Add(interaction);
            }

            // Emit Viewed Outbox message
            var correlationId = Guid.NewGuid().ToString();
            var payload = new { JobVacancyId = id, UserId = userId, Timestamp = DateTimeOffset.UtcNow };
            _context.AddAndAuditOutboxMessage("JobViewed", userId.ToString(), correlationId, payload);

            await _context.SaveChangesAsync(cancellationToken);
        }

        return Ok(MapToPublicJobDto(job));
    }

    [HttpGet("api/v1/public/jobs/{id}/eligibility")]
    [Authorize]
    public async Task<IActionResult> GetEligibility(Guid id, CancellationToken cancellationToken)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }

        try
        {
            var report = await _eligibilityService.CheckEligibilityAsync(id, userId, cancellationToken);
            
            // Build explainable match report
            var matchEval = await _matchService.EvaluateMatchAsync(id, userId);
            var factors = await _context.MatchingFactors
                .Where(f => f.MatchingEvaluationId == matchEval.Id)
                .ToListAsync(cancellationToken);
            var explanations = await _context.MatchingExplanations
                .Where(e => e.MatchingEvaluationId == matchEval.Id)
                .ToListAsync(cancellationToken);

            var capabilityFit = new
            {
                score = factors.FirstOrDefault(f => f.FactorName == "CapabilityMatch")?.FactorScore ?? 0.0,
                matchedCapabilities = explanations.Where(e => e.ExplanationType == "Strength").Select(e => e.AssertionText).ToList(),
                explanation = "Capability alignment measured via matching registry nodes."
            };

            var trustFit = new
            {
                score = factors.FirstOrDefault(f => f.FactorName == "TrustFactor")?.FactorScore ?? 0.0,
                explanation = "Calculated aggregated candidate trust projection."
            };

            var explainableReport = new
            {
                isEligible = report.IsEligible,
                isPartiallyEligible = report.IsPartiallyEligible,
                aggregateScore = matchEval.AggregateScore,
                confidenceLevel = matchEval.ConfidenceLevel,
                capabilityFit,
                trustFit,
                checks = report.Checks,
                explanation = report.Explanation
            };

            return Ok(explainableReport);
        }
        catch (ArgumentException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPost("api/v1/public/jobs/{id}/apply")]
    [Authorize]
    public async Task<IActionResult> Apply(Guid id, CancellationToken cancellationToken)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }

        var eligibility = await _eligibilityService.CheckEligibilityAsync(id, userId, cancellationToken);

        // Check if already applied
        var existing = await _context.JobApplications
            .AnyAsync(a => a.JobVacancyId == id && a.CandidateId == userId, cancellationToken);

        if (existing)
        {
            return BadRequest(new { message = "You have already applied to this job." });
        }

        var application = new JobApplication
        {
            Id = Guid.CreateVersion7(),
            JobVacancyId = id,
            CandidateId = userId,
            Status = "Applied",
            GapsSnapshotJson = JsonSerializer.Serialize(eligibility.Checks.Where(c => !c.Passed)),
            EligibilitySnapshotJson = JsonSerializer.Serialize(eligibility)
        };

        _context.JobApplications.Add(application);

        // Record Applied Interaction
        var existingInteraction = await _context.JobInteractions
            .FirstOrDefaultAsync(ji => ji.UserId == userId && ji.JobVacancyId == id && ji.InteractionType == "Applied", cancellationToken);

        if (existingInteraction != null)
        {
            existingInteraction.InteractionAt = DateTimeOffset.UtcNow;
            _context.JobInteractions.Update(existingInteraction);
        }
        else
        {
            var interaction = new JobInteraction
            {
                Id = Guid.CreateVersion7(),
                UserId = userId,
                JobVacancyId = id,
                InteractionType = "Applied",
                InteractionAt = DateTimeOffset.UtcNow
            };
            _context.JobInteractions.Add(interaction);
        }

        // Emit outbox message
        var correlationId = Guid.NewGuid().ToString();
        var payload = new { JobVacancyId = id, CandidateId = userId, ApplicationId = application.Id, Timestamp = DateTimeOffset.UtcNow };
        _context.AddAndAuditOutboxMessage("JobApplied", userId.ToString(), correlationId, payload);

        await _context.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetDetails), new { id }, MapToPublicJobDto(application.JobVacancy ?? await _context.JobVacancies.FindAsync(id)));
    }

    [HttpPost("api/v1/public/jobs/{id}/interact")]
    [Authorize]
    public async Task<IActionResult> Interact(Guid id, [FromQuery] string type, CancellationToken cancellationToken)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }

        var allowedTypes = new[] { "Saved", "Dismissed", "Shared" };
        if (!allowedTypes.Contains(type))
        {
            return BadRequest(new { message = $"Invalid interaction type. Must be one of: {string.Join(", ", allowedTypes)}" });
        }

        // Remove previous interaction of the same type if exists
        var existing = await _context.JobInteractions
            .FirstOrDefaultAsync(ji => ji.UserId == userId && ji.JobVacancyId == id && ji.InteractionType == type, cancellationToken);

        if (existing != null)
        {
            _context.JobInteractions.Remove(existing);
        }
        else
        {
            var interaction = new JobInteraction
            {
                Id = Guid.CreateVersion7(),
                UserId = userId,
                JobVacancyId = id,
                InteractionType = type
            };
            _context.JobInteractions.Add(interaction);

            // Emit outbox message
            var correlationId = Guid.NewGuid().ToString();
            var payload = new { JobVacancyId = id, UserId = userId, Type = type, Timestamp = DateTimeOffset.UtcNow };
            _context.AddAndAuditOutboxMessage($"Job{type}", userId.ToString(), correlationId, payload);
        }

        await _context.SaveChangesAsync(cancellationToken);
        return Ok(new { success = true });
    }

    [HttpGet("api/v1/public/jobs/interactions")]
    [Authorize]
    public async Task<IActionResult> GetInteractions([FromQuery] string type, CancellationToken cancellationToken)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }

        var interactions = await _context.JobInteractions
            .Include(ji => ji.JobVacancy)
            .ThenInclude(jv => jv.Organization)
            .Where(ji => ji.UserId == userId && ji.InteractionType == type)
            .OrderByDescending(ji => ji.InteractionAt)
            .Select(ji => MapToPublicJobDto(ji.JobVacancy))
            .ToListAsync(cancellationToken);

        return Ok(interactions);
    }

    [HttpGet("api/v1/public/jobs/applications")]
    [Authorize]
    public async Task<IActionResult> GetApplications(CancellationToken cancellationToken)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }

        var applications = await _context.JobApplications
            .Include(ja => ja.JobVacancy)
            .ThenInclude(jv => jv.Organization)
            .Where(ja => ja.CandidateId == userId)
            .OrderByDescending(ja => ja.CreatedAt)
            .Select(ja => new
            {
                ja.Id,
                ja.JobVacancyId,
                Job = MapToPublicJobDto(ja.JobVacancy),
                ja.Status,
                ja.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return Ok(applications);
    }

    [HttpGet("api/v1/public/jobs/recommendations")]
    [Authorize]
    public async Task<IActionResult> GetRecommendations(CancellationToken cancellationToken)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }

        var recommendations = await _recommendationProvider.GetRecommendedJobsAsync(userId, 5, cancellationToken);
        var mapped = recommendations.Select(r => MapToPublicJobDto(r)).ToList();

        return Ok(mapped);
    }

    [HttpGet("api/v1/public/jobs/{id}/applicants")]
    [Authorize]
    public async Task<IActionResult> GetApplicants(Guid id, CancellationToken cancellationToken)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }

        var job = await _context.JobVacancies.FindAsync(id);
        if (job == null) return NotFound();

        // Recruiter permission checks
        var isAdmin = await _context.AdminMembers.AnyAsync(am => am.UserId == userId && am.Status == "Active", cancellationToken);
        var isMember = await _context.OrganizationMemberships.AnyAsync(om => om.OrganizationId == job.OrganizationId && om.UserId == userId && om.Status == "active", cancellationToken);

        if (!isAdmin && !isMember)
        {
            return Forbid();
        }

        var applicants = await _context.JobApplications
            .Include(ja => ja.Candidate)
            .Where(ja => ja.JobVacancyId == id)
            .OrderByDescending(ja => ja.CreatedAt)
            .Select(ja => new
            {
                ja.Id,
                ja.CandidateId,
                ja.Candidate.FullName,
                ja.Candidate.Email,
                ja.Status,
                ja.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return Ok(applicants);
    }

    [HttpPut("api/v1/public/jobs/{id}/status")]
    [Authorize]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateJobStatusDto dto, CancellationToken cancellationToken)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }

        var job = await _context.JobVacancies.FindAsync(id);
        if (job == null) return NotFound();

        var isAdmin = await _context.AdminMembers.AnyAsync(am => am.UserId == userId && am.Status == "Active", cancellationToken);
        var isMember = await _context.OrganizationMemberships.AnyAsync(om => om.OrganizationId == job.OrganizationId && om.UserId == userId && om.Status == "active", cancellationToken);

        if (!isAdmin && !isMember)
        {
            return Forbid();
        }

        job.Status = dto.Status; // e.g. Draft, Published, Archived
        job.IsActive = dto.IsActive;
        job.UpdatedAt = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        return Ok(MapToPublicJobDto(job));
    }

    [HttpPost("api/v1/public/jobs/{id}/duplicate")]
    [Authorize]
    public async Task<IActionResult> Duplicate(Guid id, CancellationToken cancellationToken)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }

        var job = await _context.JobVacancies.FindAsync(id);
        if (job == null) return NotFound();

        var isAdmin = await _context.AdminMembers.AnyAsync(am => am.UserId == userId && am.Status == "Active", cancellationToken);
        var isMember = await _context.OrganizationMemberships.AnyAsync(om => om.OrganizationId == job.OrganizationId && om.UserId == userId && om.Status == "active", cancellationToken);

        if (!isAdmin && !isMember)
        {
            return Forbid();
        }

        var duplicated = new JobVacancy
        {
            Id = Guid.CreateVersion7(),
            OrganizationId = job.OrganizationId,
            HiringRequirementId = job.HiringRequirementId,
            Title = $"{job.Title} (Copy)",
            Department = job.Department,
            WorkplaceType = job.WorkplaceType,
            City = job.City,
            Type = job.Type,
            Salary = job.Salary,
            SalaryMinMax = job.SalaryMinMax,
            Headcount = job.Headcount,
            Gender = job.Gender,
            Experience = job.Experience,
            Degree = job.Degree,
            Category = job.Category,
            Description = job.Description.ToList(),
            Requirements = job.Requirements.ToList(),
            Benefits = job.Benefits.ToList(),
            Tags = job.Tags.ToList(),
            Skills = job.Skills.ToList(),
            CoverUrl = job.CoverUrl,
            Images = job.Images.ToList(),
            IsActive = false,
            Status = "Draft",
            AcquisitionStrategy = job.AcquisitionStrategy,
            DiscoveryProfileJson = job.DiscoveryProfileJson,
            RequirementSnapshotId = job.RequirementSnapshotId,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        _context.JobVacancies.Add(duplicated);
        await _context.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetDetails), new { id = duplicated.Id }, MapToPublicJobDto(duplicated));
    }

    private static object MapToPublicJobDto(JobVacancy job)
    {
        if (job == null) return null;
        return new
        {
            job.Id,
            job.OrganizationId,
            OrganizationName = job.Organization?.Name ?? "Organization",
            OrganizationSlug = job.Organization?.Username ?? string.Empty,
            OrganizationLogoUrl = job.Organization?.LogoUrl,
            job.Title,
            job.Department,
            job.WorkplaceType,
            job.City,
            job.Type,
            job.Salary,
            job.Experience,
            job.Degree,
            job.Category,
            job.Description,
            job.Requirements,
            job.Benefits,
            job.Tags,
            job.Skills,
            job.CoverUrl,
            job.Images,
            job.IsActive,
            job.Status,
            job.CreatedAt,
            job.UpdatedAt
        };
    }
}

public class UpdateJobStatusDto
{
    public string Status { get; set; } = string.Empty;
    public bool IsActive { get; set; }
}

