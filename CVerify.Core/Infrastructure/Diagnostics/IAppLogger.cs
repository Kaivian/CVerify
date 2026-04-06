using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;

namespace CVerify.API.Infrastructure.Diagnostics;

/// <summary>
/// Unified application logger interface for categorized and structured pipeline logging.
/// </summary>
public interface IAppLogger
{
    void Log(LogLevel level, string category, string message, Exception? exception = null, Dictionary<string, object>? metadata = null);
    void LogAuth(LogLevel level, string message, Exception? exception = null, Dictionary<string, object>? metadata = null);
    void LogSecurity(LogLevel level, string message, Exception? exception = null, Dictionary<string, object>? metadata = null);
    void LogDatabase(LogLevel level, string message, Exception? exception = null, Dictionary<string, object>? metadata = null);
    void LogAi(LogLevel level, string message, Exception? exception = null, Dictionary<string, object>? metadata = null);
    void LogSystem(LogLevel level, string message, Exception? exception = null, Dictionary<string, object>? metadata = null);
}
