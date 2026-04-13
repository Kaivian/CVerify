using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using Microsoft.Extensions.Logging;

namespace CVerify.API.Modules.Shared.Diagnostics;

/// <summary>
/// Hook to intercept all standard Microsoft.Extensions.Logging calls (framework + libraries) and pipe them into the centralized AppLoggerPipeline.
/// </summary>
public class AppLoggingProvider : ILoggerProvider
{
    private readonly AppLoggerPipeline _pipeline;
    private readonly ConcurrentDictionary<string, ILogger> _loggers = new();

    public AppLoggingProvider(AppLoggerPipeline pipeline)
    {
        _pipeline = pipeline;
    }

    public ILogger CreateLogger(string categoryName)
    {
        return _loggers.GetOrAdd(categoryName, name => new AppLoggerAdapter(name, _pipeline));
    }

    public void Dispose()
    {
        _loggers.Clear();
    }
}

/// <summary>
/// Adapts Microsoft ILogger calls to the centralized logging pipeline.
/// </summary>
public class AppLoggerAdapter : ILogger
{
    private readonly string _categoryName;
    private readonly AppLoggerPipeline _pipeline;

    public AppLoggerAdapter(string categoryName, AppLoggerPipeline pipeline)
    {
        _categoryName = categoryName;
        _pipeline = pipeline;
    }

    public IDisposable? BeginScope<TState>(TState state) where TState : notnull
    {
        // Logging scopes are handled globally via AsyncLocal context and Activity context.
        return null;
    }

    public bool IsEnabled(LogLevel logLevel)
    {
        // Pipeline does the filtering internally based on category policies
        return true;
    }

    public void Log<TState>(
        LogLevel logLevel,
        EventId eventId,
        TState state,
        Exception? exception,
        Func<TState, Exception?, string> formatter)
    {
        if (formatter == null) return;

        var message = formatter(state, exception);
        if (string.IsNullOrEmpty(message) && exception == null) return;

        // Capture structured logging attributes as metadata
        Dictionary<string, object>? metadata = null;
        if (state is IEnumerable<KeyValuePair<string, object>> properties)
        {
            metadata = new Dictionary<string, object>();
            foreach (var prop in properties)
            {
                if (prop.Key != "{OriginalFormat}")
                {
                    metadata[prop.Key] = prop.Value;
                }
            }
        }

        _pipeline.ProcessLog(logLevel, _categoryName, message, exception, metadata);
    }
}
