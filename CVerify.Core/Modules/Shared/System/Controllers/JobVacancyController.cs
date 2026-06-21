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
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.System.DTOs;
using CVerify.API.Modules.Auth.DTOs;
using CVerify.API.Modules.Shared.System.Services;
using CVerify.API.Modules.Shared.Storage.Interfaces;
using CVerify.API.Modules.Shared.Persistence;

namespace CVerify.API.Modules.Shared.System.Controllers;

[ApiController]
[Authorize]
public class JobVacancyController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IHiringRequirementService _hiringRequirementService;
    private readonly IStorageService _storageService;
    private readonly ILogger<JobVacancyController> _logger;

    public JobVacancyController(
        ApplicationDbContext context,
        IHiringRequirementService hiringRequirementService,
        IStorageService storageService,
        ILogger<JobVacancyController> logger)
    {
        _context = context;
        _hiringRequirementService = hiringRequirementService;
        _storageService = storageService;
        _logger = logger;
    }

    [HttpGet("api/v1/job-vacancies/requirement/{requirementId}")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(JobVacancyDto))]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetByRequirementId(Guid requirementId, CancellationToken cancellationToken)
    {
        var vacancy = await _context.JobVacancies
            .FirstOrDefaultAsync(v => v.HiringRequirementId == requirementId, cancellationToken);

        if (vacancy == null)
        {
            return NotFound(new { message = "Job posting draft not found for this requirement." });
        }

        var dto = await MapToJobVacancyDtoAsync(vacancy, cancellationToken);
        return Ok(dto);
    }

    [HttpPost("api/v1/job-vacancies/requirement/{requirementId}/create-draft")]
    [ProducesResponseType(StatusCodes.Status201Created, Type = typeof(JobVacancyDto))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateDraft(Guid requirementId, CancellationToken cancellationToken)
    {
        var req = await _context.HiringRequirements
            .Include(r => r.BusinessOutcomes)
            .Include(r => r.Responsibilities)
            .Include(r => r.Capabilities)
            .Include(r => r.TechnologyRequirements)
            .Include(r => r.RequirementArtifacts)
            .FirstOrDefaultAsync(r => r.Id == requirementId, cancellationToken);

        if (req == null)
        {
            return NotFound(new { message = "Hiring requirement not found." });
        }

        // Rule 1: A JobVacancy draft cannot be created until the HiringRequirement is in Ready status or Published (for versions).
        if (!req.Status.Equals("Ready", StringComparison.OrdinalIgnoreCase) && !req.Status.Equals("Published", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Cannot create a job vacancy draft because the hiring requirements are not ready." });
        }

        // Check if vacancy already exists
        var existingVacancy = await _context.JobVacancies
            .FirstOrDefaultAsync(v => v.HiringRequirementId == requirementId, cancellationToken);
        if (existingVacancy != null)
        {
            return BadRequest(new { message = "A job vacancy already exists for this hiring requirement.", id = existingVacancy.Id });
        }

        // Parse artifact properties
        string experience = req.Seniority.Equals("Junior", StringComparison.OrdinalIgnoreCase) ? "1-2 years" : req.Seniority.Equals("Middle", StringComparison.OrdinalIgnoreCase) ? "3-4 years" : "5+ years";
        string degree = req.DegreeRequirement ?? "No Degree Required";
        string category = "Software Engineering";
        string coverUrl = "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=600&auto=format&fit=crop";
        var tags = new List<string> { req.Department, req.WorkplaceType, req.Seniority };
        string? discoveryProfileJson = null;

        var metadataArt = req.RequirementArtifacts.FirstOrDefault(a => a.ArtifactType == "JobPostMetadata");
        if (metadataArt != null && !string.IsNullOrEmpty(metadataArt.StructuredContentJson))
        {
            try
            {
                using var doc = JsonDocument.Parse(metadataArt.StructuredContentJson);
                var root = doc.RootElement;
                if (root.TryGetProperty("experienceRange", out var expProp)) experience = expProp.GetString() ?? experience;
                if (root.TryGetProperty("degreeRequirement", out var degProp)) degree = degProp.GetString() ?? degree;
                if (root.TryGetProperty("industryCategory", out var catProp)) category = catProp.GetString() ?? category;
                if (root.TryGetProperty("coverUrl", out var covProp)) coverUrl = covProp.GetString() ?? coverUrl;
                if (root.TryGetProperty("tags", out var tagsProp) && tagsProp.ValueKind == JsonValueKind.Array)
                {
                    tags = tagsProp.EnumerateArray().Select(t => t.GetString() ?? "").Where(t => !string.IsNullOrEmpty(t)).ToList();
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to parse JobPostMetadata artifact JSON.");
            }
        }

        var discoveryArt = req.RequirementArtifacts.FirstOrDefault(a => a.ArtifactType == "CandidateDiscoveryProfile");
        if (discoveryArt != null)
        {
            discoveryProfileJson = discoveryArt.StructuredContentJson;
        }

        var jdArt = req.RequirementArtifacts.FirstOrDefault(a => a.ArtifactType == "JobDescription");
        var descriptionList = new List<string>();
        if (jdArt != null)
        {
            descriptionList.Add(jdArt.MarkdownContent);
        }
        else
        {
            descriptionList.Add(req.BusinessProblem ?? "No description generated.");
        }

        var requirementsList = req.Capabilities.Select(c => $"{c.Name} ({c.OwnershipLevel})").ToList();

        var vacancy = new JobVacancy
        {
            Id = Guid.CreateVersion7(),
            OrganizationId = req.OrganizationId,
            HiringRequirementId = req.Id,
            Title = req.Title,
            Department = req.Department,
            WorkplaceType = req.WorkplaceType,
            City = req.City ?? "Ho Chi Minh City",
            Type = req.EmploymentType,
            Salary = req.SalaryMin.HasValue && req.SalaryMax.HasValue ? $"{req.SalaryMin} - {req.SalaryMax} {req.Currency}" : "Negotiable",
            SalaryMinMax = $"{req.SalaryMin ?? 0}-{req.SalaryMax ?? 0}",
            Headcount = req.Headcount,
            Gender = "Khác",
            Experience = experience,
            Degree = degree,
            Category = category,
            Description = descriptionList,
            Requirements = requirementsList,
            Benefits = req.Benefits ?? new List<string>(),
            Tags = tags,
            Skills = req.TechnologyRequirements.Select(t => t.Name).ToList(),
            CoverUrl = coverUrl,
            IsActive = false,
            Status = "Draft",
            AcquisitionStrategy = "Hybrid",
            DiscoveryProfileJson = discoveryProfileJson,
            RequirementSnapshotId = null,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        _context.JobVacancies.Add(vacancy);
        await _context.SaveChangesAsync(cancellationToken);

        var dto = await MapToJobVacancyDtoAsync(vacancy, cancellationToken);
        return CreatedAtAction(nameof(GetByRequirementId), new { requirementId = req.Id }, dto);
    }

    [HttpPut("api/v1/job-postings/{id}")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(JobVacancyDto))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdatePostingDraft(Guid id, [FromBody] UpdateJobVacancyDto dto, CancellationToken cancellationToken)
    {
        var vacancy = await _context.JobVacancies
            .FirstOrDefaultAsync(v => v.Id == id, cancellationToken);

        if (vacancy == null)
        {
            return NotFound(new { message = "Job vacancy not found." });
        }

        if (!vacancy.Status.Equals("Draft", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Only job postings in Draft status can be edited." });
        }

        vacancy.Title = dto.Title;
        vacancy.Department = dto.Department;
        vacancy.WorkplaceType = dto.WorkplaceType;
        vacancy.City = dto.City;
        vacancy.Type = dto.Type;
        vacancy.Salary = dto.Salary;
        vacancy.SalaryMinMax = dto.SalaryMinMax;
        vacancy.Headcount = dto.Headcount;
        vacancy.Gender = dto.Gender;
        vacancy.Experience = dto.Experience;
        vacancy.Degree = dto.Degree;
        vacancy.Category = dto.Category;
        vacancy.Description = dto.Description ?? new List<string>();
        vacancy.Requirements = dto.Requirements ?? new List<string>();
        vacancy.Benefits = dto.Benefits ?? new List<string>();
        vacancy.Tags = dto.Tags ?? new List<string>();
        vacancy.Skills = dto.Skills ?? new List<string>();
        vacancy.CoverUrl = dto.CoverUrl;
        vacancy.AcquisitionStrategy = dto.AcquisitionStrategy ?? "Hybrid";
        vacancy.DiscoveryProfileJson = dto.DiscoveryProfileJson;
        vacancy.UpdatedAt = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        var responseDto = await MapToJobVacancyDtoAsync(vacancy, cancellationToken);
        return Ok(responseDto);
    }

    [HttpPost("api/v1/job-postings/{id}/publish")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(JobVacancyDto))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> PublishPosting(Guid id, [FromBody] PublishRequirementRequestDto dto, CancellationToken cancellationToken)
    {
        var vacancy = await _context.JobVacancies
            .FirstOrDefaultAsync(v => v.Id == id, cancellationToken);

        if (vacancy == null)
        {
            return NotFound(new { message = "Job vacancy not found." });
        }

        if (vacancy.Status.Equals("Published", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Job posting is already published." });
        }

        if (!vacancy.HiringRequirementId.HasValue)
        {
            return BadRequest(new { message = "Job posting is not linked to any hiring requirements." });
        }

        // Lock requirement and create frozen snapshot
        var snapshot = await _hiringRequirementService.PublishAsync(vacancy.HiringRequirementId.Value, cancellationToken);

        // Transition job post to Published and link the snapshot ID
        vacancy.Status = "Published";
        vacancy.IsActive = true;
        vacancy.RequirementSnapshotId = snapshot.Id;
        vacancy.UpdatedAt = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        var responseDto = await MapToJobVacancyDtoAsync(vacancy, cancellationToken);
        return Ok(responseDto);
    }

    private async Task<string?> GetSignedUrlAsync(string? url, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(url))
        {
            return null;
        }

        if (url.StartsWith("http://", StringComparison.OrdinalIgnoreCase) || 
            url.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            return url;
        }

        try
        {
            return await _storageService.GetSignedUrlAsync(url, TimeSpan.FromHours(24), cancellationToken);
        }
        catch
        {
            return null;
        }
    }

    private async Task<JobVacancyDto> MapToJobVacancyDtoAsync(JobVacancy job, CancellationToken cancellationToken)
    {
        var signedCoverUrl = await GetSignedUrlAsync(job.CoverUrl, cancellationToken) ?? job.CoverUrl;
        var signedImages = new List<string>();
        if (job.Images != null)
        {
            foreach (var img in job.Images)
            {
                var signedImg = await GetSignedUrlAsync(img, cancellationToken);
                if (signedImg != null) signedImages.Add(signedImg);
            }
        }

        return new JobVacancyDto(
            job.Id,
            job.OrganizationId,
            job.Title,
            job.Department,
            job.WorkplaceType,
            job.City,
            job.Type,
            job.Salary,
            job.SalaryMinMax,
            job.Headcount,
            job.Gender,
            job.Experience,
            job.Degree,
            job.Category,
            job.Description,
            job.Requirements,
            job.Benefits,
            job.Tags,
            job.Skills,
            signedCoverUrl,
            signedImages,
            job.IsActive,
            job.CreatedAt,
            job.UpdatedAt,
            job.Status,
            job.AcquisitionStrategy,
            job.DiscoveryProfileJson,
            job.RequirementSnapshotId,
            job.HiringRequirementId,
            job.Metadata
        );
    }
}
