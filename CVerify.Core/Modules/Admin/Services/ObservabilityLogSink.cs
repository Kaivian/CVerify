using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.Admin.DTOs;
using CVerify.API.Modules.Admin.Hubs;

namespace CVerify.API.Modules.Admin.Services;

public class ObservabilityLogSink : IObservabilityLogSink, ILoggerProvider
{
    private const int MaxBufferSizePerService = 2000;

    private readonly ConcurrentQueue<ObservabilityLogEntryDto> _frontendLogs = new();
    private readonly ConcurrentQueue<ObservabilityLogEntryDto> _backendLogs = new();
    private readonly ConcurrentQueue<ObservabilityLogEntryDto> _aiLogs = new();

    private static readonly Regex SensitiveDataRegex = new(
        @"(bearer\s+[a-zA-Z0-9_\-\.]{10,}|sk-ant-[a-zA-Z0-9_\-]{30,}|sk-[a-zA-Z0-9]{30,}|""(password|token|secret|authorization|key)""\s*:\s*""[^""]+"")",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private readonly IServiceProvider _serviceProvider;
    private IHubContext<AdminHub>? _hubContext;

    public ObservabilityLogSink(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    public async Task AddLogEntryAsync(ObservabilityLogEntryDto entry)
    {
        if (entry == null) return;

        // Sanitize sensitive contents in message
        if (!string.IsNullOrEmpty(entry.Message))
        {
            entry.Message = SensitiveDataRegex.Replace(entry.Message, "[REDACTED]");
        }

        // Categorize into service queue
        var queue = entry.Service switch
        {
            "Frontend" => _frontendLogs,
            "AI Backend" => _aiLogs,
            _ => _backendLogs
        };

        queue.Enqueue(entry);

        // Trim buffer to MaxBufferSizePerService
        while (queue.Count > MaxBufferSizePerService)
        {
            queue.TryDequeue(out _);
        }

        // Broadcast real-time log entry to SignalR connections
        try
        {
            _hubContext ??= (IHubContext<AdminHub>?)_serviceProvider.GetService(typeof(IHubContext<AdminHub>));
            if (_hubContext != null)
            {
                await _hubContext.Clients.All.SendAsync("ReceiveLogEntry", entry);
            }
        }
        catch
        {
            // Ignore broadcast failure during startup or uninitialized hub context
        }
    }

    public IEnumerable<ObservabilityLogEntryDto> GetRecentLogs(string service = "ALL", int count = 200)
    {
        count = Math.Clamp(count, 1, 2000);

        IEnumerable<ObservabilityLogEntryDto> query = service switch
        {
            "Frontend" => _frontendLogs,
            "Backend" => _backendLogs,
            "AI Backend" => _aiLogs,
            _ => _frontendLogs.Concat(_backendLogs).Concat(_aiLogs)
        };

        return query.OrderByDescending(l => l.Timestamp).Take(count).Reverse();
    }

    public void ClearLogs(string service = "ALL")
    {
        if (service == "Frontend" || service == "ALL") _frontendLogs.Clear();
        if (service == "Backend" || service == "ALL") _backendLogs.Clear();
        if (service == "AI Backend" || service == "ALL") _aiLogs.Clear();
    }

    // --- ILoggerProvider Implementation ---
    public ILogger CreateLogger(string categoryName)
    {
        return new CustomSinkLogger(categoryName, this);
    }

    public void Dispose()
    {
        GC.SuppressFinalize(this);
    }

    private class CustomSinkLogger : ILogger
    {
        private readonly string _categoryName;
        private readonly ObservabilityLogSink _sink;

        public CustomSinkLogger(string categoryName, ObservabilityLogSink sink)
        {
            _categoryName = categoryName;
            _sink = sink;
        }

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => logLevel != LogLevel.None;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            if (!IsEnabled(logLevel)) return;
            if (formatter == null) return;

            // Ignore internal SignalR or logging spam if needed
            if (_categoryName.StartsWith("Microsoft.AspNetCore.SignalR") && logLevel < LogLevel.Warning) return;

            var msg = formatter(state, exception);
            if (string.IsNullOrWhiteSpace(msg) && exception == null) return;

            var severity = logLevel switch
            {
                LogLevel.Trace => "TRACE",
                LogLevel.Debug => "DEBUG",
                LogLevel.Information => "INFO",
                LogLevel.Warning => "WARNING",
                LogLevel.Error => "ERROR",
                LogLevel.Critical => "CRITICAL",
                _ => "INFO"
            };

            var entry = new ObservabilityLogEntryDto
            {
                Id = Guid.NewGuid().ToString("N"),
                Timestamp = DateTime.UtcNow,
                Severity = severity,
                Service = "Backend",
                Source = _categoryName,
                Message = msg,
                Status = exception != null ? "error" : "success"
            };

            if (exception != null)
            {
                entry.Metadata = new Dictionary<string, object>
                {
                    ["exceptionType"] = exception.GetType().FullName ?? "Exception",
                    ["stackTrace"] = exception.StackTrace ?? string.Empty
                };
            }

            // Enqueue log item asynchronously without blocking logging thread
            _ = Task.Run(() => _sink.AddLogEntryAsync(entry));
        }
    }
}
