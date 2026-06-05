using System;

namespace CVerify.API.Modules.SourceCode.DTOs;

public record AnalysisJobDto(
    Guid Id,
    Guid RepositoryId,
    Guid UserId,
    string Status,
    double Progress,
    string? CurrentStep,
    string? CommitSha,
    DateTimeOffset? StartedAt,
    DateTimeOffset? CompletedAt,
    string? ErrorMessage,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset LastUpdatedUtc
);

public record AnalysisJobEventDto(
    Guid Id,
    Guid JobId,
    string Step,
    double Progress,
    string Message,
    DateTimeOffset CreatedAtUtc
);
