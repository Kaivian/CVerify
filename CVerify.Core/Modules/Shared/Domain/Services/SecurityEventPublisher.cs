using System;
using System.Diagnostics;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Domain.Models;

namespace CVerify.API.Modules.Shared.Domain.Services;

public class SecurityEventPublisher : ISecurityEventPublisher
{
    private readonly SecurityEventChannel _channel;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public SecurityEventPublisher(SecurityEventChannel channel, IHttpContextAccessor httpContextAccessor)
    {
        _channel = channel;
        _httpContextAccessor = httpContextAccessor;
    }

    public async Task PublishAsync(
        string eventType,
        SecurityEventCategory category,
        string description,
        Guid? actorUserId = null,
        Guid? targetUserId = null,
        Guid? organizationId = null,
        object? details = null,
        SecuritySeverity? overrideSeverity = null)
    {
        var httpContext = _httpContextAccessor.HttpContext;
        string? ipAddress = null;
        string? userAgent = null;
        Guid? sessionId = null;
        Guid? resolvedActorUserId = actorUserId;

        if (httpContext != null)
        {
            // Resolve IP Address, accounting for proxy forwarding
            ipAddress = httpContext.Request.Headers["X-Forwarded-For"].ToString();
            if (string.IsNullOrEmpty(ipAddress))
            {
                ipAddress = httpContext.Connection.RemoteIpAddress?.ToString();
            }

            // Resolve User Agent
            userAgent = httpContext.Request.Headers["User-Agent"].ToString();

            // Extract claims if actor user is not explicitly passed
            if (!resolvedActorUserId.HasValue && httpContext.User?.Identity?.IsAuthenticated == true)
            {
                var userIdClaim = httpContext.User.FindFirst(ClaimTypes.NameIdentifier);
                if (userIdClaim != null && Guid.TryParse(userIdClaim.Value, out var parsedUserId))
                {
                    resolvedActorUserId = parsedUserId;
                }

                var sidClaim = httpContext.User.FindFirst("sid");
                if (sidClaim != null && Guid.TryParse(sidClaim.Value, out var parsedSid))
                {
                    sessionId = parsedSid;
                }
            }
        }

        string? device = null;
        string? browser = null;
        if (!string.IsNullOrEmpty(userAgent))
        {
            if (userAgent.Contains("Windows")) device = "Windows";
            else if (userAgent.Contains("Android")) device = "Android";
            else if (userAgent.Contains("iPhone") || userAgent.Contains("iPad")) device = "iOS Device";
            else if (userAgent.Contains("Mac") || userAgent.Contains("Macintosh")) device = "macOS";
            else if (userAgent.Contains("Linux")) device = "Linux";
            else device = "Unknown Device";

            if (userAgent.Contains("Firefox")) browser = "Firefox";
            else if (userAgent.Contains("Chrome")) browser = "Chrome";
            else if (userAgent.Contains("Safari")) browser = "Safari";
            else if (userAgent.Contains("Edge")) browser = "Edge";
            else browser = "Unknown Browser";
        }

        // Observability Trace details (OpenTelemetry / W3C Trace Context)
        var traceId = Guid.NewGuid(); // Fallback Correlation ID
        var currentActivity = Activity.Current;
        if (currentActivity != null && Guid.TryParse(currentActivity.TraceId.ToString(), out var activityTraceId))
        {
            traceId = activityTraceId;
        }

        var context = new SecurityEventCreationContext
        {
            EventType = eventType,
            Category = category,
            Description = description,
            ActorUserId = resolvedActorUserId,
            TargetUserId = targetUserId,
            OrganizationId = organizationId,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            Device = device,
            Browser = browser,
            Details = details,
            OverrideSeverity = overrideSeverity,
            CorrelationId = traceId,
            SessionId = sessionId,
            CreatedAt = DateTimeOffset.UtcNow
        };

        // Write to channel asynchronously
        await _channel.Writer.WriteAsync(context);
    }
}
