using Microsoft.AspNetCore.Http;
using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using CVerify.API.Application.Interfaces;
using CVerify.API.Infrastructure.Persistence;
using CVerify.API.Core.Entities;

namespace CVerify.API.API.Middleware;

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
