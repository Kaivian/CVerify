using System;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using StackExchange.Redis;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Persistence;

namespace CVerify.API.Modules.Shared.System.Services;

public class AiStreamingSessionService : IAiStreamingSessionService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly IConnectionMultiplexer _redis;

    public AiStreamingSessionService(ApplicationDbContext dbContext, IConnectionMultiplexer redis)
    {
        _dbContext = dbContext;
        _redis = redis;
    }

    private async Task PublishEventAsync(
        Guid sessionId, 
        string eventType, 
        string status, 
        double progress, 
        string? message = null, 
        string? stageId = null, 
        string? parentStageId = null, 
        int? inputTokens = null, 
        int? outputTokens = null, 
        double? costUsd = null, 
        string? logLevel = null, 
        string? logComponent = null, 
        string? chunk = null, 
        string? jsonData = null,
        long? durationMs = null)
    {
        var session = await _dbContext.AiStreamingSessions.AsNoTracking().FirstOrDefaultAsync(s => s.Id == sessionId);
        if (session == null) return;

        var ev = new
        {
            sessionId = sessionId.ToString(),
            pipelineId = session.PipelineId,
            eventType = eventType,
            status = session.Status,
            timestamp = DateTimeOffset.UtcNow.ToString("o"),
            progress = session.Progress,
            message = message,
            stageId = stageId,
            parentStageId = parentStageId,
            inputTokens = inputTokens,
            outputTokens = outputTokens,
            costUsd = costUsd,
            modelName = session.ModelName,
            provider = session.Provider,
            logLevel = logLevel,
            logComponent = logComponent,
            chunk = chunk,
            jsonData = jsonData,
            durationMs = durationMs
        };

        var json = JsonSerializer.Serialize(ev, new JsonSerializerOptions 
        { 
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase 
        });

        var sub = _redis.GetSubscriber();
        var channel = $"ai:streaming:progress:{sessionId}";
        await sub.PublishAsync(channel, json);
    }

    public async Task<AiStreamingSession> CreateSessionAsync(Guid sessionId, string pipelineId, Guid userId, Guid? workspaceId, string modelName, string provider, string pipelineVersion, string? expectedOutputsJson = null)
    {
        var existing = await _dbContext.AiStreamingSessions.FirstOrDefaultAsync(s => s.Id == sessionId);
        if (existing != null)
        {
            existing.Status = "Pending";
            existing.Progress = 0.0;
            existing.StartedAt = null;
            existing.CompletedAt = null;
            existing.TotalCostUsd = 0m;
            existing.TotalInputTokens = 0;
            existing.TotalOutputTokens = 0;
            existing.LastUpdatedUtc = DateTimeOffset.UtcNow;
            await _dbContext.SaveChangesAsync();
            
            await PublishEventAsync(sessionId, "SESSION_STARTED", "Pending", 0.0, "Session reset.");
            return existing;
        }

        var session = new AiStreamingSession
        {
            Id = sessionId,
            PipelineId = pipelineId,
            UserId = userId,
            WorkspaceId = workspaceId,
            Status = "Pending",
            Progress = 0.0,
            ModelName = modelName,
            Provider = provider,
            PipelineVersion = pipelineVersion,
            ExpectedOutputs = expectedOutputsJson,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            LastUpdatedUtc = DateTimeOffset.UtcNow
        };

        _dbContext.AiStreamingSessions.Add(session);
        await _dbContext.SaveChangesAsync();

        await PublishEventAsync(sessionId, "SESSION_STARTED", "Pending", 0.0, "Session created.");
        return session;
    }

    public async Task UpdateSessionStatusAsync(Guid sessionId, string status, string? errorMessage = null, string? summaryData = null)
    {
        var session = await _dbContext.AiStreamingSessions.FirstOrDefaultAsync(s => s.Id == sessionId);
        if (session != null)
        {
            session.Status = status;
            if (status == "Running" && session.StartedAt == null)
            {
                session.StartedAt = DateTimeOffset.UtcNow;
            }
            else if (status == "Completed" || status == "Failed" || status == "Cancelled")
            {
                session.CompletedAt = DateTimeOffset.UtcNow;
            }

            if (!string.IsNullOrEmpty(errorMessage))
            {
                session.ErrorMessage = errorMessage;
            }

            if (!string.IsNullOrEmpty(summaryData))
            {
                session.SummaryData = summaryData;
            }

            session.LastUpdatedUtc = DateTimeOffset.UtcNow;
            await _dbContext.SaveChangesAsync();

            var eventType = (status == "Completed" || status == "Failed" || status == "Cancelled") 
                ? "SESSION_COMPLETED" 
                : "STAGE_PROGRESS";

            await PublishEventAsync(
                sessionId, 
                eventType, 
                status, 
                session.Progress, 
                errorMessage ?? (status == "Completed" ? "Session completed successfully." : null),
                jsonData: summaryData
            );
        }
    }

    public async Task UpdateSessionProgressAsync(Guid sessionId, double progress, string currentStep)
    {
        var session = await _dbContext.AiStreamingSessions.FirstOrDefaultAsync(s => s.Id == sessionId);
        if (session != null)
        {
            session.Progress = progress;
            session.CurrentStep = currentStep;
            session.LastUpdatedUtc = DateTimeOffset.UtcNow;
            await _dbContext.SaveChangesAsync();

            await PublishEventAsync(sessionId, "STAGE_PROGRESS", session.Status, progress, currentStep);
        }
    }

    public async Task<AiStreamingStage> UpsertStageAsync(Guid sessionId, string stageId, string stageName, string status, double progress, string? description = null, string? parentStageId = null, string? detailsJson = null, int retryCount = 0, long? durationMs = null)
    {
        var stage = await _dbContext.AiStreamingStages
            .FirstOrDefaultAsync(s => s.SessionId == sessionId && s.StageId == stageId);

        if (stage == null)
        {
            stage = new AiStreamingStage
            {
                Id = Guid.CreateVersion7(),
                SessionId = sessionId,
                StageId = stageId,
                StageName = stageName,
                ParentStageId = parentStageId,
                Status = status,
                Progress = progress,
                Description = description,
                Details = detailsJson,
                RetryCount = retryCount,
                DurationMs = durationMs,
                StartedAt = status == "Running" ? DateTimeOffset.UtcNow : null
            };

            if (status == "Completed" || status == "Failed")
            {
                stage.CompletedAt = DateTimeOffset.UtcNow;
            }

            _dbContext.AiStreamingStages.Add(stage);
        }
        else
        {
            stage.Status = status;
            stage.Progress = progress;
            if (!string.IsNullOrEmpty(stageName)) stage.StageName = stageName;
            if (!string.IsNullOrEmpty(description)) stage.Description = description;
            if (!string.IsNullOrEmpty(parentStageId)) stage.ParentStageId = parentStageId;
            if (!string.IsNullOrEmpty(detailsJson)) stage.Details = detailsJson;
            if (retryCount > 0) stage.RetryCount = retryCount;
            if (durationMs.HasValue) stage.DurationMs = durationMs;

            if (status == "Running" && stage.StartedAt == null)
            {
                stage.StartedAt = DateTimeOffset.UtcNow;
            }
            else if ((status == "Completed" || status == "Failed") && stage.CompletedAt == null)
            {
                stage.CompletedAt = DateTimeOffset.UtcNow;
                if (stage.StartedAt.HasValue)
                {
                    stage.DurationMs = (long)(DateTimeOffset.UtcNow - stage.StartedAt.Value).TotalMilliseconds;
                }
            }
        }

        await _dbContext.SaveChangesAsync();

        string eventType = status == "Completed" ? "STAGE_COMPLETED" :
                           status == "Failed" ? "STAGE_FAILED" :
                           status == "Running" ? "STAGE_STARTED" : "STAGE_PROGRESS";

        await PublishEventAsync(
            sessionId, 
            eventType, 
            status, 
            progress, 
            description, 
            stageId, 
            parentStageId, 
            jsonData: detailsJson,
            durationMs: stage.DurationMs
        );

        return stage;
    }

    public async Task AddLogAsync(Guid sessionId, string? stageId, string logLevel, string? component, string message)
    {
        var log = new AiStreamingLog
        {
            Id = Guid.CreateVersion7(),
            SessionId = sessionId,
            StageId = stageId,
            LogLevel = logLevel,
            Component = component,
            Message = message,
            Timestamp = DateTimeOffset.UtcNow
        };

        _dbContext.AiStreamingLogs.Add(log);
        await _dbContext.SaveChangesAsync();

        var session = await _dbContext.AiStreamingSessions.AsNoTracking().FirstOrDefaultAsync(s => s.Id == sessionId);
        var status = session?.Status ?? "Running";
        var progress = session?.Progress ?? 0.0;

        await PublishEventAsync(
            sessionId, 
            "LOG_EVENT", 
            status, 
            progress, 
            message, 
            stageId, 
            logLevel: logLevel, 
            logComponent: component
        );
    }

    public async Task AddMetricAsync(Guid sessionId, string? stageId, string metricName, double metricValue)
    {
        var metric = new AiStreamingMetric
        {
            Id = Guid.CreateVersion7(),
            SessionId = sessionId,
            StageId = stageId,
            MetricName = metricName,
            MetricValue = metricValue,
            Timestamp = DateTimeOffset.UtcNow
        };

        _dbContext.AiStreamingMetrics.Add(metric);

        // Also aggregate directly on the AiStreamingSession if relevant
        var session = await _dbContext.AiStreamingSessions.FirstOrDefaultAsync(s => s.Id == sessionId);
        if (session != null)
        {
            if (metricName == "input_tokens" || metricName == "prompt_tokens")
            {
                session.TotalInputTokens = (session.TotalInputTokens ?? 0) + (int)metricValue;
            }
            else if (metricName == "output_tokens" || metricName == "completion_tokens")
            {
                session.TotalOutputTokens = (session.TotalOutputTokens ?? 0) + (int)metricValue;
            }
            else if (metricName == "cost_usd")
            {
                session.TotalCostUsd = (session.TotalCostUsd ?? 0m) + (decimal)metricValue;
            }
        }

        await _dbContext.SaveChangesAsync();

        if (session != null)
        {
            string eventType = "METRIC_UPDATED";
            int? inTokens = null;
            int? outTokens = null;
            double? cost = null;

            if (metricName == "input_tokens" || metricName == "prompt_tokens")
            {
                eventType = "TOKEN_UPDATED";
                inTokens = (int)metricValue;
            }
            else if (metricName == "output_tokens" || metricName == "completion_tokens")
            {
                eventType = "TOKEN_UPDATED";
                outTokens = (int)metricValue;
            }
            else if (metricName == "cost_usd")
            {
                eventType = "COST_UPDATED";
                cost = metricValue;
            }

            await PublishEventAsync(
                sessionId, 
                eventType, 
                session.Status, 
                session.Progress, 
                stageId: stageId,
                inputTokens: inTokens,
                outputTokens: outTokens,
                costUsd: cost
            );
        }
    }

    public async Task StreamTextChunkAsync(Guid sessionId, string stageId, string chunk)
    {
        var session = await _dbContext.AiStreamingSessions.AsNoTracking().FirstOrDefaultAsync(s => s.Id == sessionId);
        var status = session?.Status ?? "Running";
        var progress = session?.Progress ?? 0.0;

        await PublishEventAsync(
            sessionId, 
            "STAGE_PROGRESS", 
            status, 
            progress, 
            stageId: stageId,
            chunk: chunk
        );
    }
}
