using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Pipelines.Shared.Storage;

namespace CVerify.API.Modules.SourceCode.Controllers;

[ApiController]
[Route("api")]
[AllowAnonymous] // Allow internal microservice to call without bearer auth
public class AiJobsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IArtifactStorageProvider _storageProvider;
    private readonly ILogger<AiJobsController> _logger;

    public AiJobsController(
        ApplicationDbContext context,
        IArtifactStorageProvider storageProvider,
        ILogger<AiJobsController> logger)
    {
        _context = context;
        _storageProvider = storageProvider;
        _logger = logger;
    }

    [HttpGet("v1/ai-jobs/{jobId}/artifacts/{artifactKey}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetArtifact(Guid jobId, string artifactKey, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Fetching artifact {ArtifactKey} for job {JobId}", artifactKey, jobId);

        // Case 1: Unified Repo Intelligence Report
        if (artifactKey == "repo-intelligence-report" || artifactKey == "repoIntelligenceReport")
        {
            var report = await _context.AnalysisReports
                .FirstOrDefaultAsync(r => r.JobId == jobId, cancellationToken);

            if (report == null)
            {
                _logger.LogWarning("Unified report not found for job {JobId}", jobId);
                return NotFound(new { Message = $"Intelligence report not found for job {jobId}" });
            }

            return Content(report.ReportData, "application/json");
        }

        // Case 2: Platform Layer DAG Task Artifacts (L1-007, L1-009, L1-017)
        var entry = await _context.ArtifactRegistryEntries
            .FirstOrDefaultAsync(x => x.JobId == jobId && x.ArtifactId == artifactKey, cancellationToken);

        if (entry == null)
        {
            _logger.LogWarning("Artifact {ArtifactKey} metadata entry not found for job {JobId}", artifactKey, jobId);
            return NotFound(new { Message = $"Artifact {artifactKey} not found for job {jobId}" });
        }

        try
        {
            var content = await _storageProvider.ReadArtifactTextAsync(entry.StoragePath, cancellationToken);
            return Content(content, "application/json");
        }
        catch (FileNotFoundException ex)
        {
            _logger.LogError(ex, "Artifact file not found on storage: {Path}", entry.StoragePath);
            return NotFound(new { Message = $"Artifact file not found for {artifactKey}" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reading artifact {ArtifactKey} for job {JobId}", artifactKey, jobId);
            return StatusCode(StatusCodes.Status500InternalServerError, new { Message = "Error retrieving artifact content." });
        }
    }
}
