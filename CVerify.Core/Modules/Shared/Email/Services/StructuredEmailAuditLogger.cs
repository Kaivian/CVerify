
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.AiChat.Entities;
using CVerify.API.Modules.Shared.Email.DTOs;

namespace CVerify.API.Modules.Shared.Email.Services;

/// <summary>
/// Writes structured, semantic logs for ingestion by modern monitoring platforms (e.g. Seq, Kibana, Datadog)
/// and preserves an in-memory ring-buffer for developer diagnostic APIs.
/// </summary>
public class StructuredEmailAuditLogger : IEmailAuditLogger
{
    private readonly ILogger<StructuredEmailAuditLogger> _logger;
    private static readonly ConcurrentQueue<string> AuditBuffer = new();
    private const int MaxBufferSize = 100;

    /// <summary>
    /// Initializes a new instance of the <see cref="StructuredEmailAuditLogger"/> class.
    /// </summary>
    public StructuredEmailAuditLogger(ILogger<StructuredEmailAuditLogger> logger)
    {
        _logger = logger;
    }

    /// <inheritdoc />
    public void LogSent(EmailMessage message, string provider)
    {
        var timestamp = DateTime.UtcNow;
        _logger.LogInformation(
            "EMAIL_AUDIT_SENT: Destination: {ToEmail} | Name: {ToName} | Subject: {Subject} | Provider: {Provider} | CorrelationID: {CorrelationId} | Category: {Category} | Timestamp: {Timestamp}",
            message.ToEmail, message.ToName, message.Subject, provider, message.CorrelationId, message.Category, timestamp);

        PushToBuffer($"[{timestamp:HH:mm:ss.fff}] [SENT] [Provider: {provider}] To: {message.ToEmail} | Subject: '{message.Subject}' | CorrelationID: {message.CorrelationId} | Category: {message.Category}");
    }

    /// <inheritdoc />
    public void LogFailed(EmailMessage message, string provider, Exception exception)
    {
        var timestamp = DateTime.UtcNow;
        _logger.LogError(
            exception,
            "EMAIL_AUDIT_FAILED: Destination: {ToEmail} | Name: {ToName} | Subject: {Subject} | Provider: {Provider} | CorrelationID: {CorrelationId} | Category: {Category} | Error: {ErrorMessage} | Timestamp: {Timestamp}",
            message.ToEmail, message.ToName, message.Subject, provider, message.CorrelationId, message.Category, exception.Message, timestamp);

        PushToBuffer($"[{timestamp:HH:mm:ss.fff}] [FAILED] [Provider: {provider}] To: {message.ToEmail} | Subject: '{message.Subject}' | Error: {exception.Message} | CorrelationID: {message.CorrelationId}");
    }

    /// <inheritdoc />
    public void LogRetry(EmailMessage message, string provider, int attempt, Exception exception)
    {
        var timestamp = DateTime.UtcNow;
        _logger.LogWarning(
            exception,
            "EMAIL_AUDIT_RETRY: Attempt: {Attempt} | Destination: {ToEmail} | Name: {ToName} | Subject: {Subject} | Provider: {Provider} | CorrelationID: {CorrelationId} | Category: {Category} | Error: {ErrorMessage} | Timestamp: {Timestamp}",
            attempt, message.ToEmail, message.ToName, message.Subject, provider, message.CorrelationId, message.Category, exception.Message, timestamp);

        PushToBuffer($"[{timestamp:HH:mm:ss.fff}] [RETRY #{attempt}] [Provider: {provider}] To: {message.ToEmail} | Subject: '{message.Subject}' | Error: {exception.Message} | CorrelationID: {message.CorrelationId}");
    }

    /// <summary>
    /// Fetches the in-memory buffered diagnostic traces.
    /// </summary>
    public static IEnumerable<string> GetDiagnosticTraces()
    {
        return AuditBuffer.ToArray();
    }

    /// <summary>
    /// Clears the in-memory diagnostic buffer.
    /// </summary>
    public static void ClearDiagnosticTraces()
    {
        AuditBuffer.Clear();
    }

    /// <summary>
    /// Logs a specific delivery path trace for E2E auditing.
    /// </summary>
    public static void LogDeliveryStage(string stage, string outboxId, string type, string recipient, string correlationId)
    {
        var timestamp = DateTime.UtcNow;
        var entry = $"DELIVERY_AUDIT: Stage={stage} | OutboxId={outboxId} | Type={type} | Recipient={recipient} | CorrelationId={correlationId}";
        PushToBuffer($"[{timestamp:HH:mm:ss.fff}] {entry}");
        Console.WriteLine(entry);
    }

    private static void PushToBuffer(string entry)
    {
        AuditBuffer.Enqueue(entry);
        while (AuditBuffer.Count > MaxBufferSize)
        {
            AuditBuffer.TryDequeue(out _);
        }
    }
}
