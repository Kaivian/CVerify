using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using System;
using System.Diagnostics;
using System.Threading.Tasks;

namespace CVerify.API.Infrastructure.Diagnostics;

/// <summary>
/// Middleware to intercept HTTP requests, establish correlation scopes, and log request summaries.
/// </summary>
public class RequestLoggingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IAppLogger _logger;

    public RequestLoggingMiddleware(RequestDelegate next, IAppLogger logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value;

        // Skip noisy paths to eliminate console spam
        if (IsNoisyPath(path))
        {
            await _next(context);
            return;
        }

        // Establish correlation ID from request header or generate a new one
        if (!context.Request.Headers.TryGetValue("X-Correlation-ID", out var correlationIdValues) || 
            string.IsNullOrEmpty(correlationIdValues.ToString()))
        {
            correlationIdValues = Guid.NewGuid().ToString("N");
        }
        
        var correlationId = correlationIdValues.ToString();
        context.Response.Headers["X-Correlation-ID"] = correlationId;

        // Propagate correlation scope down async task boundary
        using (AsyncLocalCorrelationScope.BeginScope(correlationId))
        {
            var stopwatch = Stopwatch.StartNew();
            try
            {
                await _next(context);
            }
            finally
            {
                stopwatch.Stop();
                var duration = stopwatch.ElapsedMilliseconds;
                var statusCode = context.Response.StatusCode;
                var method = context.Request.Method;

                var message = $"HTTP {method} {path} completed with {statusCode} in {duration}ms";

                // Classify logging severity based on result
                if (statusCode >= 500)
                {
                    _logger.LogSystem(LogLevel.Error, message);
                }
                else if (statusCode >= 400 || duration > 500)
                {
                    _logger.LogSystem(LogLevel.Warning, message);
                }
                else
                {
                    _logger.LogSystem(LogLevel.Information, message);
                }
            }
        }
    }

    private static bool IsNoisyPath(string? path)
    {
        if (string.IsNullOrEmpty(path)) return false;

        return path.StartsWith("/health", StringComparison.OrdinalIgnoreCase) ||
               path.StartsWith("/swagger", StringComparison.OrdinalIgnoreCase) ||
               path.StartsWith("/openapi", StringComparison.OrdinalIgnoreCase) ||
               path.Contains(".") ||
               path.StartsWith("/favicon.ico", StringComparison.OrdinalIgnoreCase);
    }
}
