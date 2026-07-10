using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.Modules.Auth.Middleware;

public class SessionValidationMiddleware
{
    private readonly RequestDelegate _next;

    public SessionValidationMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, IServiceProvider serviceProvider)
    {
        if (context.User.Identity?.IsAuthenticated == true)
        {
            var userIdClaim = context.User.FindFirst(ClaimTypes.NameIdentifier);
            var tokenVersionClaim = context.User.FindFirst("session_version");

            if (userIdClaim != null && Guid.TryParse(userIdClaim.Value, out var userId))
            {
                using var scope = serviceProvider.CreateScope();
                var cacheService = scope.ServiceProvider.GetRequiredService<ICacheService>();
                var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                var actorTypeClaim = context.User.FindFirst("actor_type")?.Value;
                bool isBusiness = string.Equals(actorTypeClaim, "business", StringComparison.OrdinalIgnoreCase) ||
                                  string.Equals(actorTypeClaim, "organization", StringComparison.OrdinalIgnoreCase);

                if (isBusiness)
                {
                    // Validate overall organization status
                    var orgCacheKey = $"auth:org:{userId}:status";
                    var cachedStatus = await cacheService.GetAsync<string>(orgCacheKey);

                    if (string.IsNullOrEmpty(cachedStatus))
                    {
                        var org = await dbContext.Organizations.FindAsync(userId);
                        if (org == null || org.DeletedAt != null || !string.Equals(org.Status, "active", StringComparison.OrdinalIgnoreCase))
                        {
                            InvalidateSession(context);
                            return;
                        }
                        await cacheService.SetAsync(orgCacheKey, "active", TimeSpan.FromHours(24));
                    }
                }
                else
                {
                    // 1. Validate overall user SessionVersion (user-wide invalidation)
                    var cacheKey = $"auth:user:{userId}:session_version";
                    var cachedVersionStr = await cacheService.GetAsync<string>(cacheKey);
                    int activeVersion;

                    if (string.IsNullOrEmpty(cachedVersionStr))
                    {
                        // Cache miss: Load from PostgreSQL
                        var user = await dbContext.Users.FindAsync(userId);
                        if (user == null || user.Status != UserStatus.ACTIVE)
                        {
                            InvalidateSession(context);
                            return;
                        }
                        activeVersion = user.SessionVersion;
                        await cacheService.SetAsync(cacheKey, activeVersion.ToString(), TimeSpan.FromHours(24));
                    }
                    else
                    {
                        activeVersion = int.Parse(cachedVersionStr);
                    }

                    if (tokenVersionClaim == null ||
                        !int.TryParse(tokenVersionClaim.Value, out var tokenVersion) ||
                        tokenVersion != activeVersion)
                    {
                        InvalidateSession(context);
                        return;
                    }
                }

                // 2. Validate SessionId (manual single/bulk remote session revocation)
                var sidClaim = context.User.FindFirst("sid");
                Guid? sessionId = null;

                if (sidClaim != null && Guid.TryParse(sidClaim.Value, out var parsedSid))
                {
                    sessionId = parsedSid;
                }
                else
                {
                    // Fallback for rolling deployment: identify session via refresh token cookie
                    var currentRefreshToken = context.Request.Cookies["refresh_token"];
                    if (!string.IsNullOrEmpty(currentRefreshToken))
                    {
                        var storedToken = await dbContext.RefreshTokens
                            .FirstOrDefaultAsync(t => t.Token == currentRefreshToken);
                        if (storedToken != null)
                        {
                            if (storedToken.RevokedAt != null)
                            {
                                InvalidateSession(context);
                                return;
                            }
                            sessionId = storedToken.SessionId;
                        }
                        else
                        {
                            InvalidateSession(context);
                            return;
                        }
                    }
                }

                if (sessionId.HasValue)
                {
                    var sessionCacheKey = $"auth:session:{sessionId.Value}:active";
                    var cachedSessionStatus = await cacheService.GetAsync<string>(sessionCacheKey);
                    bool isSessionActive = true;

                    if (string.IsNullOrEmpty(cachedSessionStatus))
                    {
                        try
                        {
                            // Cache miss: Query DB
                            isSessionActive = await dbContext.RefreshTokens
                                .AnyAsync(t => t.SessionId == sessionId.Value && t.RevokedAt == null);

                            await cacheService.SetAsync(sessionCacheKey, isSessionActive.ToString(), TimeSpan.FromMinutes(30));
                        }
                        catch
                        {
                            // Fail-safe fallback if Redis has transient issues
                            isSessionActive = await dbContext.RefreshTokens
                                .AnyAsync(t => t.SessionId == sessionId.Value && t.RevokedAt == null);
                        }
                    }
                    else
                    {
                        isSessionActive = bool.Parse(cachedSessionStatus);
                    }

                    if (!isSessionActive)
                    {
                        InvalidateSession(context);
                        return;
                    }
                }
            }
        }

        await _next(context);
    }

    private static void InvalidateSession(HttpContext context)
    {
        var isDevelopment = string.Equals(Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"), "Development", StringComparison.OrdinalIgnoreCase);
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = !isDevelopment,
            SameSite = SameSiteMode.Lax,
            Path = "/"
        };

        context.Response.Cookies.Delete("access_token", cookieOptions);
        context.Response.Cookies.Delete("refresh_token", cookieOptions);
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
    }
}
