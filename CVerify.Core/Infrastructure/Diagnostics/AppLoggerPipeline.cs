using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Security.Claims;
using System.Text.RegularExpressions;
using System.Threading.Channels;
using CVerify.API.Infrastructure.Configuration;

namespace CVerify.API.Infrastructure.Diagnostics;

/// <summary>
/// Orchestrates log processing, enrichment, duplicate suppression, data masking, and async channel dispatch.
/// </summary>
public class AppLoggerPipeline
{
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly string _environmentName;
    private readonly EnvConfiguration _envConfig;
    private readonly PipelineTelemetry _telemetry;
    
    // In-memory queue using a Channel
    private readonly Channel<AppLogEvent> _channel;
    
    // Expose current channel size
    public int QueueSize => _channel.Reader.Count;
    public int QueueCapacity { get; } = 10000;

    // Suppression sliding caches
    private readonly ConcurrentDictionary<string, DateTime> _exceptionCache = new();
    private readonly ConcurrentDictionary<string, (DateTime FirstLogged, int Count)> _throttleCache = new();

    // Sensitive keys to mask in dictionaries
    private static readonly string[] SensitiveKeys = new[]
    {
        "password", "pass", "token", "secret", "key", "authorization", "jwt", "cookie", "access_token", "refresh_token", "verification_token"
    };

    // Regex to mask sensitive values in raw string messages
    private static readonly Regex TokenRegex = new(
        @"(?i)(password|token|secret|key|authorization|jwt|cookie|access_token|refresh_token|verification_token|id_token|code)([\s:=""=]+)([^&;\s""]{4,})",
        RegexOptions.Compiled);

    public AppLoggerPipeline(
        IHttpContextAccessor httpContextAccessor,
        IWebHostEnvironment env,
        EnvConfiguration envConfig,
        PipelineTelemetry telemetry)
    {
        _httpContextAccessor = httpContextAccessor;
        _environmentName = env.EnvironmentName;
        _envConfig = envConfig;
        _telemetry = telemetry;

        // Use bounded channel to avoid OOM under extreme log floods
        var options = new BoundedChannelOptions(QueueCapacity)
        {
            FullMode = BoundedChannelFullMode.DropWrite, // Drop logs if queue is completely full
            SingleReader = true,
            SingleWriter = false
        };
        _channel = Channel.CreateBounded<AppLogEvent>(options);
    }

    public ChannelReader<AppLogEvent> Reader => _channel.Reader;

    /// <summary>
    /// Processes a raw log entry through the pipeline stages.
    /// </summary>
    public void ProcessLog(
        LogLevel level,
        string category,
        string message,
        Exception? exception = null,
        Dictionary<string, object>? metadata = null)
    {
        var mappedCategory = MapCategory(category);

        // Stage 1: Filtering & Policy check
        if (!IsCategoryLevelEnabled(mappedCategory, level))
        {
            return;
        }

        // Stage 1b: Duplicate Exception Suppression
        if (exception != null && IsDuplicateException(exception))
        {
            _telemetry.RecordExceptionSuppressed();
            return;
        }

        // Stage 1c: Throttling / Rate Limiting for noisy logs
        if (IsThrottled(mappedCategory, message))
        {
            _telemetry.RecordThrottled();
            return;
        }

        // Create log event
        var logEvent = new AppLogEvent
        {
            Timestamp = DateTime.UtcNow,
            Level = level,
            Category = mappedCategory,
            Environment = _environmentName
        };

        // Stage 2: Enrichment
        EnrichLog(logEvent, exception, metadata);

        // Stage 3: Sanitization & Masking
        logEvent.Message = MaskSensitiveData(message);
        if (metadata != null)
        {
            logEvent.Metadata = MaskMetadata(metadata);
        }

        // Stage 5: Asynchronous Processing (Queueing)
        if (!_channel.Writer.TryWrite(logEvent))
        {
            _telemetry.RecordDropped();
        }
        else
        {
            _telemetry.RecordProcessed();
        }
    }

    private string MapCategory(string category)
    {
        if (string.IsNullOrEmpty(category)) return "SYSTEM";

        if (category.Contains("AuthService", StringComparison.OrdinalIgnoreCase) || 
            category.Contains("TokenService", StringComparison.OrdinalIgnoreCase))
            return "AUTH";

        if (category.Contains("Security", StringComparison.OrdinalIgnoreCase) ||
            category.Contains("RateLimiter", StringComparison.OrdinalIgnoreCase) ||
            category.Contains("RateLimit", StringComparison.OrdinalIgnoreCase))
            return "SECURITY";

        if (category.Contains("EntityFrameworkCore", StringComparison.OrdinalIgnoreCase) ||
            category.Contains("DbContext", StringComparison.OrdinalIgnoreCase) ||
            category.Contains("Database", StringComparison.OrdinalIgnoreCase) ||
            category.Contains("Npgsql", StringComparison.OrdinalIgnoreCase))
            return "DATABASE";

        if (category.Contains("AiService", StringComparison.OrdinalIgnoreCase) ||
            category.Contains("AiChat", StringComparison.OrdinalIgnoreCase))
            return "AI";

        return "SYSTEM";
    }

    private bool IsCategoryLevelEnabled(string category, LogLevel level)
    {
        // Debug mode / Explicit configuration overrides
        var isDev = _environmentName.Equals(Environments.Development, StringComparison.OrdinalIgnoreCase);

        // Custom category policy levels per environment
        return category switch
        {
            "DATABASE" => level >= (_envConfig.Database.EnableSqlLogging ? LogLevel.Information : LogLevel.Warning),
            "SECURITY" => level >= LogLevel.Information,
            "AUTH" => level >= LogLevel.Information,
            "AI" => level >= LogLevel.Information,
            "SYSTEM" => level >= (isDev ? LogLevel.Information : LogLevel.Warning),
            _ => level >= LogLevel.Information
        };
    }

    private bool IsDuplicateException(Exception exception)
    {
        // Build exception key
        var key = $"{exception.GetType().FullName}:{exception.Message}:{exception.StackTrace?.Substring(0, Math.Min(120, exception.StackTrace.Length))}";
        var now = DateTime.UtcNow;

        if (_exceptionCache.TryGetValue(key, out var expiryTime))
        {
            if (expiryTime > now)
            {
                return true;
            }
        }

        // Suppress identical exceptions for 5 seconds
        _exceptionCache[key] = now.AddSeconds(5);

        // Periodic cleanup
        if (_exceptionCache.Count > 1000)
        {
            foreach (var item in _exceptionCache.ToList())
            {
                if (item.Value < now)
                {
                    _exceptionCache.TryRemove(item.Key, out _);
                }
            }
        }

        return false;
    }

    private bool IsThrottled(string category, string message)
    {
        var shortenedMessage = message.Length > 60 ? message[..60] : message;
        var key = $"{category}:{shortenedMessage}";
        var now = DateTime.UtcNow;

        if (_throttleCache.TryGetValue(key, out var state))
        {
            if (now - state.FirstLogged < TimeSpan.FromSeconds(5))
            {
                if (state.Count >= 10) // Maximum 10 identical logs per 5 seconds
                {
                    _throttleCache[key] = (state.FirstLogged, state.Count + 1);
                    return true;
                }
                _throttleCache[key] = (state.FirstLogged, state.Count + 1);
            }
            else
            {
                _throttleCache[key] = (now, 1);
            }
        }
        else
        {
            _throttleCache[key] = (now, 1);
        }

        return false;
    }

    private void EnrichLog(AppLogEvent logEvent, Exception? exception, Dictionary<string, object>? metadata)
    {
        // Inject IDs
        logEvent.TraceId = Activity.Current?.TraceId.ToString() ?? Activity.Current?.Id;
        logEvent.RequestId = AsyncLocalCorrelationScope.CurrentCorrelationId;

        // Try getting HttpContext details
        var httpContext = _httpContextAccessor.HttpContext;
        if (httpContext != null)
        {
            logEvent.TraceId ??= httpContext.TraceIdentifier;
            logEvent.RequestId ??= httpContext.TraceIdentifier;
            
            if (httpContext.User?.Identity?.IsAuthenticated == true)
            {
                logEvent.UserId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            }
        }

        // Process Exception Details
        if (exception != null)
        {
            logEvent.ExceptionType = exception.GetType().FullName;
            logEvent.ExceptionMessage = exception.Message;
            logEvent.StackTrace = exception.StackTrace;
        }

        // Fill Metadata
        if (metadata != null)
        {
            foreach (var kvp in metadata)
            {
                logEvent.Metadata[kvp.Key] = kvp.Value;
            }
        }
    }

    private string MaskSensitiveData(string message)
    {
        if (string.IsNullOrEmpty(message)) return message;

        return TokenRegex.Replace(message, m =>
        {
            var field = m.Groups[1].Value;
            var separator = m.Groups[2].Value;
            var value = m.Groups[3].Value;

            var maskedValue = value.Length > 8
                ? $"{value[..2]}...{value[^2..]}"
                : "***MASKED***";

            return $"{field}{separator}{maskedValue}";
        });
    }

    private Dictionary<string, object> MaskMetadata(Dictionary<string, object> metadata)
    {
        var sanitized = new Dictionary<string, object>();
        foreach (var (key, value) in metadata)
        {
            if (SensitiveKeys.Any(s => key.Contains(s, StringComparison.OrdinalIgnoreCase)))
            {
                if (value is string valStr && valStr.Length > 8)
                {
                    sanitized[key] = $"{valStr[..2]}...{valStr[^2..]}";
                }
                else
                {
                    sanitized[key] = "***MASKED***";
                }
            }
            else
            {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }
}
