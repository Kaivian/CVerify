using System;
using System.Collections.Generic;
using System.IO;
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

    [HttpGet("repository-analyses/jobs/{jobId}/snapshot")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetJobSnapshot(Guid jobId, CancellationToken cancellationToken)
    {
        var snapshot = await _analysisService.GetJobSnapshotAsync(CurrentUserId, jobId);
        if (snapshot == null)
        {
            return NotFound(new { Message = "Job snapshot not found or access denied." });
        }

        try
        {
            using var doc = JsonDocument.Parse(snapshot);
            using var stream = new MemoryStream();
            using (var writer = new Utf8JsonWriter(stream))
            {
                writer.WriteStartObject();
                writer.WriteString("jobId", jobId.ToString());
                foreach (var prop in doc.RootElement.EnumerateObject())
                {
                    prop.WriteTo(writer);
                }
                writer.WriteEndObject();
            }
            var resultJson = System.Text.Encoding.UTF8.GetString(stream.ToArray());
            return Content(resultJson, "application/json");
        }
        catch
        {
            return Content(snapshot, "application/json");
        }
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
    public async Task<IActionResult> GetLatestReport(
        Guid repoId,
        [FromServices] ApplicationDbContext context,
        CancellationToken cancellationToken)
    {
        try
        {
            var repository = await context.SourceCodeRepositories
                .Include(r => r.AuthProvider)
                .FirstOrDefaultAsync(r => r.Id == repoId && r.AuthProvider.UserId == CurrentUserId && r.AuthProvider.DeletedAt == null, cancellationToken);

            if (repository == null)
            {
                return NotFound(new { Message = "Repository not found or access denied." });
            }

            var report = await context.AnalysisReports
                .Where(r => r.RepositoryId == repoId)
                .OrderByDescending(r => r.CreatedAtUtc)
                .FirstOrDefaultAsync(cancellationToken);

            if (report == null)
            {
                return NotFound(new { Message = "No completed analysis report found for this repository." });
            }

            try
            {
                using var doc = JsonDocument.Parse(report.ReportData);
                using var stream = new MemoryStream();
                using (var writer = new Utf8JsonWriter(stream))
                {
                    writer.WriteStartObject();
                    writer.WriteString("jobId", report.JobId.ToString());
                    foreach (var prop in doc.RootElement.EnumerateObject())
                    {
                        prop.WriteTo(writer);
                    }
                    writer.WriteEndObject();
                }
                var resultJson = System.Text.Encoding.UTF8.GetString(stream.ToArray());
                return Content(resultJson, "application/json");
            }
            catch
            {
                return Content(report.ReportData, "application/json");
            }
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

                using var doc = JsonDocument.Parse(message);
                if (doc.RootElement.TryGetProperty("eventType", out var eventTypeProp) && eventTypeProp.GetString() == "AI_TASK_FAILED")
                {
                    await Response.WriteAsync($"event: AI_TASK_FAILED\ndata: {message}\n\n", HttpContext.RequestAborted);
                    await Response.Body.FlushAsync(HttpContext.RequestAborted);
                }

                await Response.WriteAsync($"data: {message}\n\n", HttpContext.RequestAborted);
                await Response.Body.FlushAsync(HttpContext.RequestAborted);

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

    [HttpPost("repository-analyses/jobs/{jobId}/tasks/{taskId}/retry")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RetryTask(Guid jobId, Guid taskId, CancellationToken cancellationToken)
    {
        var success = await _analysisService.RetryTaskAsync(CurrentUserId, jobId, taskId);
        if (!success)
        {
            return BadRequest(new { Message = "Task could not be retried. The job might be currently running, task/job does not exist, or does not belong to you." });
        }
        return Ok(new { Message = "Task retry initiated successfully." });
    }

    [HttpGet("repository-analyses/jobs/{jobId}/tasks/{taskId}/events")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(IEnumerable<AnalysisTaskEventDto>))]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetTaskEvents(Guid jobId, Guid taskId, CancellationToken cancellationToken)
    {
        var events = await _analysisService.GetTaskEventsAsync(CurrentUserId, jobId, taskId);
        return Ok(events);
    }

    [HttpGet("repository-analyses/jobs/{jobId}/costs")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetJobCosts(Guid jobId, [FromServices] ApplicationDbContext context, CancellationToken cancellationToken)
    {
        var jobExists = await context.AnalysisJobs.AnyAsync(j => j.Id == jobId && j.UserId == CurrentUserId, cancellationToken);
        if (!jobExists)
        {
            return NotFound(new { Message = "Job not found or access denied." });
        }

        var executions = await context.AnalysisExecutions
            .Where(e => e.JobId == jobId)
            .OrderBy(e => e.CreatedAtUtc)
            .Select(e => new
            {
                e.Id,
                e.JobId,
                e.TaskId,
                e.ExecutionType,
                e.Provider,
                e.Model,
                e.PromptTokens,
                e.CompletionTokens,
                e.TotalTokens,
                e.CachedTokens,
                e.EstimatedCostUsd,
                e.DurationMs,
                e.CreatedAtUtc
            })
            .ToListAsync(cancellationToken);

        var totalCost = executions.Sum(e => e.EstimatedCostUsd);
        var totalTokens = executions.Sum(e => e.TotalTokens);
        var totalDuration = executions.Sum(e => e.DurationMs);

        return Ok(new
        {
            JobId = jobId,
            TotalCostUsd = totalCost,
            TotalTokens = totalTokens,
            TotalDurationMs = totalDuration,
            Executions = executions
        });
    }

    [HttpGet("repository-analyses/costs/platform-summary")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetPlatformCostSummary([FromServices] ApplicationDbContext context, CancellationToken cancellationToken)
    {
        var userId = CurrentUserId;
        var userJobIds = await context.AnalysisJobs
            .Where(j => j.UserId == userId)
            .Select(j => j.Id)
            .ToListAsync(cancellationToken);

        var executionsQuery = context.AnalysisExecutions
            .Where(e => userJobIds.Contains(e.JobId));

        var costPerRepository = await context.AnalysisExecutions
            .Where(e => userJobIds.Contains(e.JobId))
            .GroupBy(e => e.Job.Repository.Name)
            .Select(g => new { RepositoryName = g.Key, TotalCostUsd = g.Sum(e => e.EstimatedCostUsd), TotalTokens = g.Sum(e => e.TotalTokens) })
            .ToListAsync(cancellationToken);

        var costPerUser = await context.AnalysisExecutions
            .Where(e => userJobIds.Contains(e.JobId))
            .GroupBy(e => e.Job.User.Email)
            .Select(g => new { UserEmail = g.Key, TotalCostUsd = g.Sum(e => e.EstimatedCostUsd), TotalTokens = g.Sum(e => e.TotalTokens) })
            .ToListAsync(cancellationToken);

        var costPerModel = await executionsQuery
            .GroupBy(e => e.Model)
            .Select(g => new { ModelName = g.Key, TotalCostUsd = g.Sum(e => e.EstimatedCostUsd), TotalTokens = g.Sum(e => e.TotalTokens) })
            .ToListAsync(cancellationToken);

        var costPerProvider = await executionsQuery
            .GroupBy(e => e.Provider)
            .Select(g => new { ProviderName = g.Key, TotalCostUsd = g.Sum(e => e.EstimatedCostUsd), TotalTokens = g.Sum(e => e.TotalTokens) })
            .ToListAsync(cancellationToken);

        var monthlyTrends = await executionsQuery
            .GroupBy(e => new { Year = e.CreatedAtUtc.Year, Month = e.CreatedAtUtc.Month })
            .Select(g => new 
            { 
                Year = g.Key.Year, 
                Month = g.Key.Month, 
                TotalCostUsd = g.Sum(e => e.EstimatedCostUsd), 
                TotalTokens = g.Sum(e => e.TotalTokens) 
            })
            .OrderBy(g => g.Year).ThenBy(g => g.Month)
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            CostPerRepository = costPerRepository,
            CostPerUser = costPerUser,
            CostPerModel = costPerModel,
            CostPerProvider = costPerProvider,
            MonthlyTrends = monthlyTrends
        });
    }
}
