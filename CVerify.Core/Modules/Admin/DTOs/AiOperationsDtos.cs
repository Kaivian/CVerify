using System;
using System.Collections.Generic;

namespace CVerify.API.Modules.Admin.DTOs;

public record StronglyTypedMetricDto(
    string Label,
    string Value,
    string? Unit = null,
    string? Trend = null,
    string? Icon = null,
    string? Color = null,
    string? Description = null
);

public record AiPipelineStatsDto(
    int ActivePipelines,
    int RunningTasks,
    int PendingQueue,
    int CompletedToday,
    int FailedToday,
    int CancelledTasks,
    double AverageExecutionTimeMs,
    double AverageQueueWaitingTimeMs,
    int ActiveWorkers,
    int ActiveSseConnections,
    decimal CostToday,
    decimal CostThisMonth,
    double SuccessRate,
    List<AiDailyMetricDto> DailyTrends,
    List<StronglyTypedMetricDto>? DomainMetrics = null,
    Dictionary<string, decimal>? CostByProvider = null,
    Dictionary<string, decimal>? CostByRepository = null,
    int TotalPromptTokens = 0,
    int TotalCompletionTokens = 0
);

public record AiDailyMetricDto(
    string Date,
    int TasksCount,
    int CompletedCount,
    int FailedCount,
    int CancelledCount,
    int TokenConsumption,
    decimal CostUsd,
    double AvgLatencyMs
);

public record AiPipelineListItemDto(
    Guid Id,
    string PipelineId, // pipeline type
    string Status,
    decimal Progress,
    string? CurrentStep,
    string? ModelName,
    string? Provider,
    DateTimeOffset? StartedAt,
    DateTimeOffset? CompletedAt,
    decimal TotalCostUsd,
    int TotalInputTokens,
    int TotalOutputTokens,
    string? ErrorMessage,
    string PipelineVersion,
    DateTimeOffset CreatedAtUtc,
    string? CandidateName,
    string? CandidateEmail,
    string? OrganizationName,
    Guid? OrganizationId,
    string? RepositoryName,
    Guid? RepositoryId,
    int RetryCount,
    int QueuePosition
);

public record AiPipelineDetailDto(
    Guid Id,
    string PipelineId,
    string Status,
    decimal Progress,
    string? CurrentStep,
    string? ModelName,
    string? Provider,
    DateTimeOffset? StartedAt,
    DateTimeOffset? CompletedAt,
    decimal TotalCostUsd,
    int TotalInputTokens,
    int TotalOutputTokens,
    string? ErrorMessage,
    string PipelineVersion,
    DateTimeOffset CreatedAtUtc,
    string? CandidateName,
    string? CandidateEmail,
    string? OrganizationName,
    Guid? OrganizationId,
    string? RepositoryName,
    Guid? RepositoryId,
    List<AiStreamingStageDto> Stages,
    List<AiStreamingMetricDto> Metrics,
    List<AiStreamingLogDto> Logs,
    List<AiTaskDto> PipelineTasks
);

public record AiStreamingStageDto(
    Guid Id,
    string StageId,
    string StageName,
    string? ParentStageId,
    string Status,
    decimal Progress,
    string? Description,
    string? Details,
    DateTimeOffset? StartedAt,
    DateTimeOffset? CompletedAt,
    long? DurationMs,
    int RetryCount
);

public record AiStreamingMetricDto(
    Guid Id,
    string? StageId,
    string MetricName,
    double MetricValue,
    DateTimeOffset Timestamp
);

public record AiStreamingLogDto(
    Guid Id,
    string? StageId,
    string LogLevel,
    string? Component,
    string Message,
    DateTimeOffset Timestamp
);

public record AiTaskDto(
    Guid Id,
    Guid JobId,
    string TaskType,
    string Status,
    decimal Progress,
    DateTimeOffset? StartedAt,
    DateTimeOffset? CompletedAt,
    long? DurationMs,
    int RetryCount,
    string? ErrorMessage,
    int? PromptTokens,
    int? CompletionTokens,
    int? CacheReadTokens,
    int? CacheWriteTokens,
    decimal? EstimatedCostUsd,
    string? ModelName,
    string? Metadata,
    DateTimeOffset CreatedAtUtc
);

public record AiQueueDto(
    string QueueName,
    long QueueLength,
    double AvgWaitingTimeMs,
    string? OldestTask,
    string? NewestTask,
    double ThroughputTps,
    int WorkerAllocation,
    string Status // Active/Paused
);

public record AiProviderDto(
    string ProviderName,
    bool IsAvailable,
    double LatencyMs,
    double RequestsPerSec,
    double ErrorRate,
    string RateLimitStatus,
    int CurrentQueueSize,
    int TokenThroughputPerSec,
    decimal AccumulatedCost,
    string HealthStatus,
    string FallbackStatus
);

public record AiWorkerDto(
    string WorkerName,
    string ContainerId,
    string Version,
    DateTimeOffset LastHeartbeat,
    string CurrentTask,
    double MemoryUsagePercent,
    double CpuUsagePercent,
    int ActivePipelines,
    string HealthStatus
);

public record RepoHealthDto(
    Guid Id,
    string Name,
    string Owner,
    string DefaultBranch,
    string LatestAnalysisStatus,
    DateTimeOffset? LatestAnalysisCompletedAtUtc,
    double TrustScore,
    string LatestRiskLevel,
    double LatestRiskScore,
    DateTimeOffset LastSyncedAt,
    bool IsEnabled
);

public record AiEventDto(
    Guid Id,
    string PipelineType,
    string EventType,
    string Message,
    string LogLevel,
    DateTimeOffset Timestamp,
    string? RepositoryName
);
