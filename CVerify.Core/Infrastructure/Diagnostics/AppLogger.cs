using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;

namespace CVerify.API.Infrastructure.Diagnostics;

/// <summary>
/// Direct implementation of IAppLogger, forwarding logs to the centralized pipeline.
/// </summary>
public class AppLogger : IAppLogger
{
    private readonly AppLoggerPipeline _pipeline;

    public AppLogger(AppLoggerPipeline pipeline)
    {
        _pipeline = pipeline;
    }

    public void Log(LogLevel level, string category, string message, Exception? exception = null, Dictionary<string, object>? metadata = null)
    {
        _pipeline.ProcessLog(level, category, message, exception, metadata);
    }

    public void LogAuth(LogLevel level, string message, Exception? exception = null, Dictionary<string, object>? metadata = null)
    {
        Log(level, "AUTH", message, exception, metadata);
    }

    public void LogSecurity(LogLevel level, string message, Exception? exception = null, Dictionary<string, object>? metadata = null)
    {
        Log(level, "SECURITY", message, exception, metadata);
    }

    public void LogDatabase(LogLevel level, string message, Exception? exception = null, Dictionary<string, object>? metadata = null)
    {
        Log(level, "DATABASE", message, exception, metadata);
    }

    public void LogAi(LogLevel level, string message, Exception? exception = null, Dictionary<string, object>? metadata = null)
    {
        Log(level, "AI", message, exception, metadata);
    }

    public void LogSystem(LogLevel level, string message, Exception? exception = null, Dictionary<string, object>? metadata = null)
    {
        Log(level, "SYSTEM", message, exception, metadata);
    }
}
