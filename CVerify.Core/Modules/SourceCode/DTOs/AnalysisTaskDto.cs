using System;

namespace CVerify.API.Modules.SourceCode.DTOs;

public record AnalysisTaskDto(
    Guid Id,
    Guid JobId,
    string TaskType,
    string Status,
    double Progress,
    DateTimeOffset? StartedAt,
    DateTimeOffset? CompletedAt,
    long? DurationMs,
    int RetryCount,
    string? ErrorMessage,
    int? PromptTokens,
    int? CompletionTokens,
    decimal? EstimatedCostUsd,
    string? ModelName,
    string? SchemaVersion,
    string? ResultData,
    DateTimeOffset CreatedAtUtc
);
