using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StackExchange.Redis;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Persistence;

namespace CVerify.API.Modules.Shared.System.Controllers;

[ApiController]
[Route("api/v1/streaming")]
[Authorize]
public class StreamingController : ControllerBase
{
    private readonly ApplicationDbContext _dbContext;
    private readonly IConnectionMultiplexer _redis;
    private readonly IServiceProvider _serviceProvider;

    public StreamingController(
        ApplicationDbContext dbContext,
        IConnectionMultiplexer redis,
        IServiceProvider serviceProvider)
    {
        _dbContext = dbContext;
        _redis = redis;
        _serviceProvider = serviceProvider;
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

    [HttpGet("sessions")]
    public async Task<IActionResult> GetSessions([FromQuery] string? pipelineId, [FromQuery] string? status)
    {
        var query = _dbContext.AiStreamingSessions
            .Where(s => s.UserId == CurrentUserId);

        if (!string.IsNullOrEmpty(pipelineId))
        {
            query = query.Where(s => s.PipelineId == pipelineId);
        }

        if (!string.IsNullOrEmpty(status))
        {
            query = query.Where(s => s.Status == status);
        }

        var sessions = await query
            .OrderByDescending(s => s.CreatedAtUtc)
            .ToListAsync();

        return Ok(sessions);
    }

    [HttpGet("sessions/{id}")]
    public async Task<IActionResult> GetSessionDetails(Guid id)
    {
        var session = await _dbContext.AiStreamingSessions
            .FirstOrDefaultAsync(s => s.Id == id && s.UserId == CurrentUserId);

        if (session == null)
        {
            return NotFound(new { Message = "Streaming session not found or access denied." });
        }

        var stages = await _dbContext.AiStreamingStages
            .Where(s => s.SessionId == id)
            .OrderBy(s => s.StartedAt ?? DateTimeOffset.MinValue)
            .ToListAsync();

        var metrics = await _dbContext.AiStreamingMetrics
            .Where(s => s.SessionId == id)
            .ToListAsync();

        return Ok(new
        {
            Session = session,
            Stages = stages,
            Metrics = metrics
        });
    }

    [HttpGet("sessions/{id}/logs")]
    public async Task<IActionResult> GetSessionLogs(Guid id)
    {
        var sessionExists = await _dbContext.AiStreamingSessions
            .AnyAsync(s => s.Id == id && s.UserId == CurrentUserId);

        if (!sessionExists)
        {
            return NotFound(new { Message = "Streaming session not found or access denied." });
        }

        var logs = await _dbContext.AiStreamingLogs
            .Where(l => l.SessionId == id)
            .OrderBy(l => l.Timestamp)
            .ToListAsync();

        return Ok(logs);
    }

    [HttpGet("sessions/{id}/progress-stream")]
    [Produces("text/event-stream")]
    public async Task GetProgressStream(Guid id)
    {
        var session = await _dbContext.AiStreamingSessions
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == id && s.UserId == CurrentUserId);

        if (session == null)
        {
            Response.StatusCode = StatusCodes.Status404NotFound;
            await Response.WriteAsJsonAsync(new { Message = "Streaming session not found or access denied." });
            return;
        }

        Response.ContentType = "text/event-stream";
        Response.Headers.Append("Cache-Control", "no-cache");
        Response.Headers.Append("Connection", "keep-alive");

        // 1. Stream all existing logs/stages from DB first (historical replay)
        var historicalStages = await _dbContext.AiStreamingStages
            .AsNoTracking()
            .Where(s => s.SessionId == id)
            .OrderBy(s => s.StartedAt ?? DateTimeOffset.MinValue)
            .ToListAsync();

        var jsonOptions = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

        foreach (var stage in historicalStages)
        {
            string eventType = stage.Status == "Completed" ? "STAGE_COMPLETED" :
                               stage.Status == "Failed" ? "STAGE_FAILED" :
                               stage.Status == "Running" ? "STAGE_STARTED" : "STAGE_PROGRESS";

            var ev = new
            {
                sessionId = id.ToString(),
                pipelineId = session.PipelineId,
                eventType = eventType,
                status = stage.Status,
                timestamp = (stage.CompletedAt ?? stage.StartedAt ?? DateTimeOffset.UtcNow).ToString("o"),
                progress = stage.Progress,
                message = stage.Description,
                stageId = stage.StageId,
                parentStageId = stage.ParentStageId,
                durationMs = stage.DurationMs,
                jsonData = stage.Details,
                modelName = session.ModelName,
                provider = session.Provider
            };

            await Response.WriteAsync($"data: {JsonSerializer.Serialize(ev, jsonOptions)}\n\n", HttpContext.RequestAborted);
            await Response.Body.FlushAsync(HttpContext.RequestAborted);
        }

        var historicalLogs = await _dbContext.AiStreamingLogs
            .AsNoTracking()
            .Where(l => l.SessionId == id)
            .OrderBy(l => l.Timestamp)
            .ToListAsync();

        foreach (var log in historicalLogs)
        {
            var ev = new
            {
                sessionId = id.ToString(),
                pipelineId = session.PipelineId,
                eventType = "LOG_EVENT",
                status = "Running",
                timestamp = log.Timestamp.ToString("o"),
                message = log.Message,
                stageId = log.StageId,
                logLevel = log.LogLevel,
                logComponent = log.Component,
                modelName = session.ModelName,
                provider = session.Provider
            };

            await Response.WriteAsync($"data: {JsonSerializer.Serialize(ev, jsonOptions)}\n\n", HttpContext.RequestAborted);
            await Response.Body.FlushAsync(HttpContext.RequestAborted);
        }

        // 2. If already completed/failed, finish immediately
        var terminalStates = new[] { "Completed", "Failed", "Cancelled" };
        if (terminalStates.Contains(session.Status))
        {
            await Response.WriteAsync("data: [DONE]\n\n", HttpContext.RequestAborted);
            await Response.Body.FlushAsync(HttpContext.RequestAborted);
            return;
        }

        // 3. Otherwise subscribe to Redis progress stream
        var sub = _redis.GetSubscriber();
        var channel = $"ai:streaming:progress:{id}";
        var channelQueue = global::System.Threading.Channels.Channel.CreateUnbounded<string>();

        void RedisMessageHandler(RedisChannel rc, RedisValue value)
        {
            channelQueue.Writer.TryWrite(value.ToString());
        }

        await sub.SubscribeAsync(channel, RedisMessageHandler);

        try
        {
            // Recheck status in case it finished while we were loading historical events
            var recheck = await _dbContext.AiStreamingSessions
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == id && s.UserId == CurrentUserId);

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
                if (doc.RootElement.TryGetProperty("eventType", out var eventTypeProp) || doc.RootElement.TryGetProperty("EventType", out eventTypeProp))
                {
                    var eventType = eventTypeProp.GetString();
                    if (eventType == "SESSION_COMPLETED" || eventType == "SESSION_FAILED" || eventType == "SESSION_CANCELLED")
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
            // Graceful exit on client disconnect
        }
        finally
        {
            await sub.UnsubscribeAsync(channel, RedisMessageHandler);
        }
    }

    [HttpGet("sessions/{id}/costs")]
    public async Task<IActionResult> GetSessionCosts(Guid id)
    {
        var session = await _dbContext.AiStreamingSessions
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == id && s.UserId == CurrentUserId);

        if (session == null)
        {
            return NotFound(new { Message = "Streaming session not found or access denied." });
        }

        var metrics = await _dbContext.AiStreamingMetrics
            .AsNoTracking()
            .Where(m => m.SessionId == id)
            .ToListAsync();

        var stages = await _dbContext.AiStreamingStages
            .AsNoTracking()
            .Where(s => s.SessionId == id)
            .ToListAsync();

        var executions = new List<object>();
        var groupedMetrics = metrics.GroupBy(m => m.StageId);

        foreach (var group in groupedMetrics)
        {
            var stageId = group.Key ?? "Orchestrator";
            var stage = stages.FirstOrDefault(s => s.StageId == stageId);

            var inputTokens = (int)group.Where(m => m.MetricName == "input_tokens" || m.MetricName == "prompt_tokens").Sum(m => m.MetricValue);
            var outputTokens = (int)group.Where(m => m.MetricName == "output_tokens" || m.MetricName == "completion_tokens").Sum(m => m.MetricValue);
            var costUsd = (decimal)group.Where(m => m.MetricName == "cost_usd").Sum(m => m.MetricValue);
            var duration = stage?.DurationMs ?? 0;

            if (inputTokens > 0 || outputTokens > 0 || costUsd > 0)
            {
                executions.Add(new
                {
                    id = Guid.NewGuid().ToString(),
                    jobId = id.ToString(),
                    taskId = stageId,
                    executionType = "llm_call",
                    provider = session.Provider ?? "Anthropic",
                    model = session.ModelName ?? "claude-haiku-4-5-20251001",
                    promptTokens = inputTokens,
                    completionTokens = outputTokens,
                    totalTokens = inputTokens + outputTokens,
                    cachedTokens = 0,
                    estimatedCostUsd = costUsd,
                    durationMs = duration
                });
            }
        }

        var totalCost = session.TotalCostUsd ?? 0m;
        var totalTokens = (session.TotalInputTokens ?? 0) + (session.TotalOutputTokens ?? 0);
        var totalDuration = stages.Sum(s => s.DurationMs ?? 0);

        return Ok(new
        {
            jobId = id.ToString(),
            totalCostUsd = totalCost,
            totalTokens = totalTokens,
            totalDurationMs = totalDuration,
            executions = executions
        });
    }

    [HttpPost("sessions/{sessionId}/stages/{stageId}/retry")]
    public async Task<IActionResult> RetryStage(Guid sessionId, string stageId)
    {
        var session = await _dbContext.AiStreamingSessions
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == CurrentUserId);

        if (session == null)
        {
            return NotFound(new { Message = "Streaming session not found or access denied." });
        }

        if (session.PipelineId == "repository-analysis")
        {
            var task = await _dbContext.AnalysisTasks
                .FirstOrDefaultAsync(t => t.JobId == sessionId && t.TaskType == stageId);

            if (task == null)
            {
                return NotFound(new { Message = "Task not found." });
            }

            var analysisService = _serviceProvider.GetRequiredService<CVerify.API.Modules.SourceCode.Services.IRepositoryAnalysisService>();
            var success = await analysisService.RetryTaskAsync(CurrentUserId, sessionId, task.Id);
            if (!success)
            {
                return BadRequest(new { Message = "Failed to retry task. Ensure the task is failed and retryable." });
            }
        }
        else if (session.PipelineId == "jd-generation")
        {
            var hiringService = _serviceProvider.GetRequiredService<Services.IHiringRequirementService>();
            // Trigger single artifact generation asynchronously
            var userId = CurrentUserId;
            _ = Task.Run(async () =>
            {
                try
                {
                    using var scope = _serviceProvider.CreateScope();
                    var scopedService = scope.ServiceProvider.GetRequiredService<Services.IHiringRequirementService>();
                    await scopedService.GenerateArtifactAsync(sessionId, stageId, userId, CancellationToken.None);
                }
                catch (Exception ex)
                {
                    // Log error
                }
            });
        }

        return Ok(new { Message = "Retry initiated successfully." });
    }
}
