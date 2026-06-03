
using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.AiChat.Entities;

namespace CVerify.API.Modules.Shared.Diagnostics;

/// <summary>
/// Background worker that consumes queued AppLogEvents asynchronously to prevent blocking console I/O.
/// </summary>
public class AppLoggingBackgroundWorker : BackgroundService
{
    private readonly AppLoggerPipeline _pipeline;

    public AppLoggingBackgroundWorker(AppLoggerPipeline pipeline)
    {
        _pipeline = pipeline;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var reader = _pipeline.Reader;

        while (await reader.WaitToReadAsync(stoppingToken))
        {
            while (reader.TryRead(out var logEvent))
            {
                try
                {
                    WriteLog(logEvent);
                }
                catch (Exception ex)
                {
                    // Fallback console print if log rendering itself fails
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine($"[FATAL] AppLoggingBackgroundWorker failed to format log: {ex.Message}");
                    Console.ResetColor();
                }
            }
        }
    }

    private void WriteLog(AppLogEvent logEvent)
    {
        var isProd = logEvent.Environment.Equals("Production", StringComparison.OrdinalIgnoreCase);

        if (isProd)
        {
            WriteStructuredJson(logEvent);
        }
        else
        {
            WriteCleanConsole(logEvent);
        }

        // --- Future Observability Sinks Routing ---
        // Implement integrations here:
        // RouteToOpenTelemetry(logEvent);
        // RouteToSeq(logEvent);
        // RouteToLoki(logEvent);
        // RouteToElasticsearch(logEvent);
    }

    private void WriteCleanConsole(AppLogEvent logEvent)
    {
        var timestamp = logEvent.Timestamp.ToString("yyyy-MM-dd HH:mm:ss.fff");
        
        var (levelStr, colorCode) = logEvent.Level switch
        {
            LogLevel.Trace => ("TRC", "\x1B[90m"),         // Gray
            LogLevel.Debug => ("DBG", "\x1B[37m"),         // White
            LogLevel.Information => ("INFO", "\x1B[32m"),  // Green
            LogLevel.Warning => ("WARN", "\x1B[33m"),      // Yellow
            LogLevel.Error => ("ERROR", "\x1B[31m"),       // Red
            LogLevel.Critical => ("FATAL", "\x1B[41m\x1B[37m"), // Red background, white text
            _ => ("LOG", "")
        };

        var colorEnd = colorCode != "" ? "\x1B[0m" : "";

        // Build identifiers string
        var idParts = new List<string>();
        if (!string.IsNullOrEmpty(logEvent.RequestId))
        {
            idParts.Add($"requestId={logEvent.RequestId}");
        }
        if (!string.IsNullOrEmpty(logEvent.UserId))
        {
            idParts.Add($"userId={logEvent.UserId}");
        }

        var idsStr = idParts.Count > 0 ? $" ({string.Join(", ", idParts)})" : "";

        // Main line output
        Console.WriteLine($"[{timestamp}] {colorCode}{levelStr}{colorEnd} {logEvent.Category} - {logEvent.Message}{idsStr}");

        // Handle exceptions
        if (!string.IsNullOrEmpty(logEvent.ExceptionType))
        {
            Console.WriteLine($"\x1B[31mException: {logEvent.ExceptionType} - {logEvent.ExceptionMessage}\x1B[0m");
            if (!string.IsNullOrEmpty(logEvent.StackTrace))
            {
                // Indent stack trace for readability
                var indentedStack = "\t" + logEvent.StackTrace.Replace("\n", "\n\t");
                Console.WriteLine($"\x1B[90m{indentedStack}\x1B[0m");
            }
        }
    }

    private void WriteStructuredJson(AppLogEvent logEvent)
    {
        var options = new JsonSerializerOptions { WriteIndented = false };
        var json = JsonSerializer.Serialize(new
        {
            timestamp = logEvent.Timestamp.ToString("o"),
            level = logEvent.Level.ToString(),
            category = logEvent.Category,
            message = logEvent.Message,
            requestId = logEvent.RequestId,
            traceId = logEvent.TraceId,
            userId = logEvent.UserId,
            environment = logEvent.Environment,
            exception = logEvent.ExceptionType != null ? new
            {
                type = logEvent.ExceptionType,
                message = logEvent.ExceptionMessage,
                stackTrace = logEvent.StackTrace
            } : null,
            metadata = logEvent.Metadata.Count > 0 ? logEvent.Metadata : null
        }, options);

        Console.WriteLine(json);
    }
}
