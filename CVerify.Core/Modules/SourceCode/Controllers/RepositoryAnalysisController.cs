using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StackExchange.Redis;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.SourceCode.Services;
using CVerify.API.Modules.SourceCode.DTOs;

namespace CVerify.API.Modules.SourceCode.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public class RepositoryAnalysisController : ControllerBase
{
    private readonly IRepositoryAnalysisService _analysisService;
    private readonly IConnectionMultiplexer _redis;

    public RepositoryAnalysisController(IRepositoryAnalysisService analysisService, IConnectionMultiplexer redis)
    {
        _analysisService = analysisService;
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

    [HttpGet("repository-analyses/active")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetActiveJobs([FromServices] ApplicationDbContext context, CancellationToken cancellationToken)
    {
        var activeStates = new[] { "Queued", "Preparing", "CloningRepository", "DetectingTechnologyStack", "SamplingCode", "RunningAgents", "AggregatingResults", "SavingReport" };
        var activeJobs = await context.AnalysisJobs
            .Where(j => j.UserId == CurrentUserId && activeStates.Contains(j.Status))
            .Select(j => new
            {
                j.Id,
                j.RepositoryId,
                j.Status,
                j.Progress,
                j.CurrentStep
            })
            .ToListAsync(cancellationToken);
        return Ok(activeJobs);
    }

    [HttpPost("repositories/{repoId}/analyses")]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> TriggerAnalysis(Guid repoId, CancellationToken cancellationToken)
    {
        try
        {
            var jobId = await _analysisService.EnqueueAnalysisJobAsync(CurrentUserId, repoId);
            return Accepted(new { JobId = jobId, Status = "Queued" });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { Message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return StatusCode(StatusCodes.Status429TooManyRequests, new { Message = ex.Message });
        }
    }

    [HttpGet("repository-analyses/jobs/{jobId}")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(AnalysisJobDto))]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetJobStatus(Guid jobId, CancellationToken cancellationToken)
    {
        var job = await _analysisService.GetJobStatusAsync(CurrentUserId, jobId);
        if (job == null)
        {
            return NotFound(new { Message = "Job not found or access denied." });
        }
        return Ok(job);
    }

    [HttpGet("repository-analyses/jobs/{jobId}/events")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(IEnumerable<AnalysisJobEventDto>))]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetJobEvents(Guid jobId, CancellationToken cancellationToken)
    {
        var events = await _analysisService.GetJobEventsAsync(CurrentUserId, jobId);
        return Ok(events);
    }

    [HttpPost("repository-analyses/jobs/{jobId}/cancel")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> CancelJob(Guid jobId, CancellationToken cancellationToken)
    {
        var success = await _analysisService.CancelJobAsync(CurrentUserId, jobId);
        if (!success)
        {
            return BadRequest(new { Message = "Job could not be cancelled. It may not exist, belong to another user, or already be completed/cancelled." });
        }
        return Ok(new { Message = "Job cancelled successfully." });
    }

    [HttpGet("repositories/{repoId}/analyses/latest")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetLatestReport(Guid repoId, CancellationToken cancellationToken)
    {
        try
        {
            var report = await _analysisService.GetLatestReportAsync(CurrentUserId, repoId);
            if (report == null)
            {
                return NotFound(new { Message = "No completed analysis report found for this repository." });
            }
            return Content(report, "application/json");
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { Message = ex.Message });
        }
    }

    [HttpGet("repository-analyses/jobs/{jobId}/progress-stream")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task GetProgressStream(Guid jobId)
    {
        var job = await _analysisService.GetJobStatusAsync(CurrentUserId, jobId);
        if (job == null)
        {
            Response.StatusCode = StatusCodes.Status404NotFound;
            await Response.WriteAsJsonAsync(new { Message = "Job not found or access denied." });
            return;
        }

        Response.ContentType = "text/event-stream";
        Response.Headers.Append("Cache-Control", "no-cache");
        Response.Headers.Append("Connection", "keep-alive");

        // Stream historical events first
        var historicalEvents = await _analysisService.GetJobEventsAsync(CurrentUserId, jobId);
        foreach (var ev in historicalEvents)
        {
            var jsonPayload = JsonSerializer.Serialize(new
            {
                jobId = ev.JobId,
                status = ev.Step,
                step = ev.Step,
                progress = ev.Progress,
                message = ev.Message,
                timestamp = ev.CreatedAtUtc.ToString("o")
            });
            await Response.WriteAsync($"data: {jsonPayload}\n\n", HttpContext.RequestAborted);
            await Response.Body.FlushAsync(HttpContext.RequestAborted);
        }

        var terminalStates = new[] { "Completed", "Failed", "Cancelled", "TimedOut" };
        if (terminalStates.Contains(job.Status))
        {
            await Response.WriteAsync("data: [DONE]\n\n", HttpContext.RequestAborted);
            await Response.Body.FlushAsync(HttpContext.RequestAborted);
            return;
        }

        var sub = _redis.GetSubscriber();
        var channel = $"repository:analysis:progress:{jobId}";
        var channelQueue = System.Threading.Channels.Channel.CreateUnbounded<string>();

        void RedisMessageHandler(RedisChannel rc, RedisValue value)
        {
            channelQueue.Writer.TryWrite(value.ToString());
        }

        await sub.SubscribeAsync(channel, RedisMessageHandler);

        try
        {
            // Recheck status right after subscription to avoid race conditions
            var currentJob = await _analysisService.GetJobStatusAsync(CurrentUserId, jobId);
            if (currentJob == null)
            {
                return;
            }

            if (terminalStates.Contains(currentJob.Status))
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
                if (doc.RootElement.TryGetProperty("status", out var statusProp))
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
