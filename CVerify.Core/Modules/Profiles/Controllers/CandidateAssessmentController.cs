using System;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using StackExchange.Redis;
using CVerify.API.Modules.Profiles.DTOs;
using CVerify.API.Modules.Profiles.Services;

namespace CVerify.API.Modules.Profiles.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public class CandidateAssessmentController : ControllerBase
{
    private readonly ICandidateAssessmentService _assessmentService;
    private readonly IConnectionMultiplexer _redis;

    public CandidateAssessmentController(
        ICandidateAssessmentService assessmentService,
        IConnectionMultiplexer redis)
    {
        _assessmentService = assessmentService;
        _redis = redis;
    }

    private Guid CurrentUserId
    {
        get
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
            {
                throw new UnauthorizedAccessException("User is not authenticated or user ID is invalid.");
            }
            return userId;
        }
    }

    [HttpGet("v1/candidate-assessments/readiness")]
    [ProducesResponseType(typeof(CandidateReadinessDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetReadinessStatus(CancellationToken cancellationToken)
    {
        var readiness = await _assessmentService.GetReadinessStatusAsync(CurrentUserId, cancellationToken);
        return Ok(readiness);
    }

    [HttpGet("v1/candidate-assessments/stages")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public IActionResult GetStages()
    {
        var stages = new[]
        {
            new { Id = "FetchLine1", Name = "Retrieve Repository Artifacts", Description = "Fetches verified static analysis, provenance, and git telemetry artifacts for the candidate's active repositories." },
            new { Id = "ConsolidateLine1", Name = "Consolidate Repository Signals", Description = "Merges multidimensional capability signals, code quality scores, and commit telemetry across all repositories." },
            new { Id = "L2-001", Name = "Skill Taxonomy Mapping", Description = "Normalizes raw project-level skills against the global CVerify technical skill taxonomy." },
            new { Id = "L2-002", Name = "Skill Proficiency Estimation", Description = "Estimates the depth, scope, and capability bands for each extracted skill using commit frequency and syntax patterns." },
            new { Id = "L2-003", Name = "Capabilities & Gaps Diagnostics", Description = "Pinpoints key architectural strengths and potential engineering development areas from the codebase history." },
            new { Id = "L2-004", Name = "Career Level Assessment", Description = "Maps codebase scope, ownership ratio, and engineering complexity to career-level thresholds." },
            new { Id = "L2-005", Name = "Career Level Calibration", Description = "Calibrates career level alignment across multiple repositories using weighted developer experience metrics." },
            new { Id = "L2-006", Name = "Career Level Evaluation Gate", Description = "Applies validation constraints and overrides to finalize candidate level classifications." },
            new { Id = "L2-007", Name = "Engineering Maturity Evaluation", Description = "Evaluates project hygiene, logging practices, test coverage, and structural organization." },
            new { Id = "L2-008", Name = "Problem Solving Complexity Analyzer", Description = "Analyzes diagnostic intent, recovery patterns, and bug-fix cycles in git commit messages." },
            new { Id = "L2-009", Name = "Technical Tendency Classification", Description = "Classifies developer affinity towards backend, frontend, devops, or fullstack development." },
            new { Id = "L2-010", Name = "Working Style Classification", Description = "Infers collaboration density, velocity consistency, and code review compliance from git metadata." },
            new { Id = "L2-011", Name = "Experience Confidence Calibration", Description = "Adjusts assessment confidence scores based on codebase age, volume, and contributor density." },
            new { Id = "L2-012", Name = "Role Recommendation Engine", Description = "Computes alignment percentages for classic industry roles (e.g. Backend, Tech Lead, DevOps, Architect)." },
            new { Id = "L2-013", Name = "Executive Summary Generation", Description = "Generates a comprehensive recruiter-friendly assessment narrative and executive summary." },
            new { Id = "L2-014", Name = "AI Profile Composition", Description = "Assembles and serializes the final verified candidate profile and calibrated score index." }
        };
        return Ok(stages);
    }

    [HttpPost("v1/candidate-assessments")]
    [ProducesResponseType(typeof(CandidateAssessmentResponse), StatusCodes.Status202Accepted)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> TriggerAssessment(CancellationToken cancellationToken)
    {
        var result = await _assessmentService.TriggerAssessmentAsync(CurrentUserId, cancellationToken);
        return Accepted(result);
    }

    [HttpGet("v1/candidate-assessments/dev-trigger")]
    [AllowAnonymous]
    public async Task<IActionResult> DevTriggerAssessment(CancellationToken cancellationToken)
    {
        try
        {
            var targetUserId = Guid.Parse("019ecc1b-44e6-7600-803f-11249088ae92");
            var result = await _assessmentService.TriggerAssessmentAsync(targetUserId, cancellationToken);
            return Ok(new { Success = true, Message = "Candidate assessment trigger successfully initiated.", Result = result });
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpGet("v1/candidate-assessments/latest")]
    [ProducesResponseType(typeof(CandidateAssessmentResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetLatestAssessment(CancellationToken cancellationToken)
    {
        var latest = await _assessmentService.GetLatestAssessmentAsync(CurrentUserId, cancellationToken);
        if (latest == null)
        {
            return NoContent();
        }
        return Ok(latest);
    }

    [HttpGet("v1/candidate-assessments/history")]
    [ProducesResponseType(typeof(System.Collections.Generic.List<CandidateAssessmentResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetAssessmentHistory(CancellationToken cancellationToken)
    {
        var list = await _assessmentService.GetAssessmentHistoryAsync(CurrentUserId, cancellationToken);
        return Ok(list);
    }

    [HttpGet("v1/candidate-assessments/{assessmentId}/details")]
    [ProducesResponseType(typeof(CandidateAssessmentDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetAssessmentDetails(Guid assessmentId, CancellationToken cancellationToken)
    {
        var details = await _assessmentService.GetAssessmentDetailsAsync(CurrentUserId, assessmentId, cancellationToken);
        if (details == null)
        {
            return NotFound(new { Message = "Assessment details not found or access denied." });
        }
        return Ok(details);
    }

    [HttpGet("v1/candidate-assessments/public/{username}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(CandidateAssessmentDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPublicAssessment(string username, CancellationToken cancellationToken)
    {
        var details = await _assessmentService.GetLatestPublicAssessmentAsync(username, cancellationToken);
        if (details == null)
        {
            return NoContent();
        }
        return Ok(details);
    }

    [HttpGet("v1/candidate-assessments/progress/{userId}")]
    [Produces("text/event-stream")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task GetProgressStream(Guid userId)
    {
        if (userId != CurrentUserId)
        {
            Response.StatusCode = StatusCodes.Status403Forbidden;
            await Response.WriteAsJsonAsync(new { Message = "Access denied." });
            return;
        }

        Response.ContentType = "text/event-stream";
        Response.Headers.Append("Cache-Control", "no-cache");
        Response.Headers.Append("Connection", "keep-alive");

        var latest = await _assessmentService.GetLatestAssessmentAsync(CurrentUserId, HttpContext.RequestAborted);
        var terminalStates = new[] { "Completed", "Failed" };

        if (latest != null && terminalStates.Contains(latest.Status))
        {
            await Response.WriteAsync("data: [DONE]\n\n", HttpContext.RequestAborted);
            await Response.Body.FlushAsync(HttpContext.RequestAborted);
            return;
        }

        var sub = _redis.GetSubscriber();
        var channel = $"candidate:assessment:progress:{userId}";
        var channelQueue = System.Threading.Channels.Channel.CreateUnbounded<string>();

        void RedisMessageHandler(RedisChannel rc, RedisValue value)
        {
            channelQueue.Writer.TryWrite(value.ToString());
        }

        await sub.SubscribeAsync(channel, RedisMessageHandler);

        try
        {
            // Recheck status right after subscription to avoid race conditions
            var recheck = await _assessmentService.GetLatestAssessmentAsync(CurrentUserId, HttpContext.RequestAborted);
            if (recheck != null && terminalStates.Contains(recheck.Status))
            {
                await Response.WriteAsync("data: [DONE]\n\n", HttpContext.RequestAborted);
                await Response.Body.FlushAsync(HttpContext.RequestAborted);
                return;
            }

            while (!HttpContext.RequestAborted.IsCancellationRequested)
            {
                var message = await channelQueue.Reader.ReadAsync(HttpContext.RequestAborted);

                await Response.WriteAsync($"data: {message}\n\n", HttpContext.RequestAborted);
                await Response.Body.FlushAsync(HttpContext.RequestAborted);

                using var doc = JsonDocument.Parse(message);
                var statusPropExists = doc.RootElement.TryGetProperty("status", out var statusProp) || doc.RootElement.TryGetProperty("Status", out statusProp);
                if (statusPropExists)
                {
                    var status = statusProp.GetString();
                    if (status != null && terminalStates.Contains(status))
                    {
                        await Response.WriteAsync("data: [DONE]\n\n", HttpContext.RequestAborted);
                        await Response.Body.FlushAsync(HttpContext.RequestAborted);
                        break;
                    }
                }
            }
        }
        catch (OperationCanceledException)
        {
            // Graceful exit when client disconnects
        }
        finally
        {
            await sub.UnsubscribeAsync(channel, RedisMessageHandler);
        }
    }
}
