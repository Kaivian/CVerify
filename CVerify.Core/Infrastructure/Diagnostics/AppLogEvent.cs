using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;

namespace CVerify.API.Infrastructure.Diagnostics;

/// <summary>
/// Structured logging event containing contextual metadata and diagnostic context.
/// </summary>
public class AppLogEvent
{
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public LogLevel Level { get; set; }
    public string Category { get; set; } = "SYSTEM";
    public string Message { get; set; } = string.Empty;
    public string? RequestId { get; set; }
    public string? TraceId { get; set; }
    public string? UserId { get; set; }
    public string Environment { get; set; } = "Production";
    public string? ExceptionType { get; set; }
    public string? ExceptionMessage { get; set; }
    public string? StackTrace { get; set; }
    public Dictionary<string, object> Metadata { get; set; } = new();
}
