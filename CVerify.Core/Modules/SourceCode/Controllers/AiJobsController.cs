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

        if (entry != null)
        {
            try
            {
                var content = await _storageProvider.ReadArtifactTextAsync(entry.StoragePath, cancellationToken);
                return Content(content, "application/json");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error reading registered artifact {ArtifactKey} for job {JobId} from storage path {Path}. Trying database fallback.", artifactKey, jobId, entry.StoragePath);
            }
        }

        // Fallback: Check in AnalysisTaskResults table
        var targetTaskType = GetTaskTypeForArtifactKey(artifactKey);
        var taskResult = await _context.AnalysisTaskResults
            .Include(r => r.Task)
            .FirstOrDefaultAsync(r => r.Task.JobId == jobId && (r.Task.TaskType == targetTaskType || r.Task.TaskType == artifactKey), cancellationToken);

        if (taskResult != null)
        {
            _logger.LogInformation("Found artifact {ArtifactKey} in AnalysisTaskResults table as task type {TaskType} for job {JobId}", artifactKey, taskResult.Task.TaskType, jobId);
            return Content(taskResult.ResultData, "application/json");
        }

        _logger.LogWarning("Artifact {ArtifactKey} (mapped task: {TaskType}) not found in registry or task results for job {JobId}", artifactKey, targetTaskType, jobId);
        return NotFound(new { Message = $"Artifact {artifactKey} not found for job {jobId}" });
    }

    private string GetTaskTypeForArtifactKey(string artifactKey)
    {
        return artifactKey switch
        {
            "L1-001" or "repo-structure" or "repoStructure" => "RepoStructure",
            "L1-002" or "commit-intelligence" or "commitIntelligence" => "CommitIntelligence",
            "L1-003" or "commit-diff" or "commitDiff" => "CommitDiff",
            "L1-004" or "skill-extraction" or "skillExtraction" or "tech-stack-extraction" or "techStackExtraction" => "SkillExtraction",
            "L1-005" or "feature-extraction" or "featureExtraction" => "FeatureExtraction",
            "L1-006" or "architecture-analysis" or "architectureAnalysis" => "ArchitectureAnalysis",
            "L1-007" or "commit-timeline" or "commitTimeline" or "commitTimelineData" => "CommitTimeline",
            "L1-008" or "architecture-change" or "architectureChange" => "ArchitectureChange",
            "L1-009" or "commit-intent" or "commitIntent" or "commitIntentData" => "CommitIntent",
            "L1-010" or "complexity" => "Complexity",
            "L1-011" or "code-quality" or "codeQuality" => "CodeQuality",
            "L1-012" or "git-blame" or "gitBlame" => "GitBlame",
            "L1-013" or "clone-detection" or "cloneDetection" => "CloneDetection",
            "L1-014" or "ai-generated-code" or "aiGeneratedCode" => "AiGeneratedCode",
            "L1-015" or "ownership" => "Ownership",
            "L1-016" or "repo-intelligence-report" or "repoIntelligenceReport" or "RepoIntelligenceReport" => "RepoIntelligenceReport",
            "L1-017" or "skill-graph" or "skillGraph" or "skillEvidenceGraph" => "SkillGraph",
            "L1-018" or "trust-score" or "trustScore" => "TrustScore",
            _ => artifactKey
        };
    }
}
