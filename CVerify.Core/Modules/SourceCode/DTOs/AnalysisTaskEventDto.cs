using System;

namespace CVerify.API.Modules.SourceCode.DTOs;

public record AnalysisTaskEventDto(
    Guid Id,
    Guid TaskId,
    DateTimeOffset Timestamp,
    string Level,
    string EventType,
    string Message,
    string? Metadata
);
