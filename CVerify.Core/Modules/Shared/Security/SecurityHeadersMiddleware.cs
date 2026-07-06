using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.Exceptions.Catalogs;

namespace CVerify.API.Modules.Shared.Security;

public class SecurityHeadersMiddleware
{
    private readonly RequestDelegate _next;
    private static readonly HashSet<string> ExcludedMutatingPaths = new(StringComparer.OrdinalIgnoreCase)
    {
        "/api/auth/login",
        "/api/auth/register",
        "/api/auth/google",
        "/health",
        "/api/system/status",
        "/api/ai/chat/stream",
        "/hubs/notifications/negotiate",
        "/hubs/admin/negotiate"
    };

    public SecurityHeadersMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, Microsoft.Extensions.Logging.ILogger<SecurityHeadersMiddleware> logger)
    {
        // 1. Centralized Cache-Control and standard security headers for /api/auth endpoints
        context.Response.OnStarting(() =>
        {
            if (context.Request.Path.StartsWithSegments("/api/auth"))
            {
                context.Response.Headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0";
                context.Response.Headers["Pragma"] = "no-cache";
                context.Response.Headers["X-Content-Type-Options"] = "nosniff";
                context.Response.Headers["X-Frame-Options"] = "DENY";
                context.Response.Headers["X-XSS-Protection"] = "1; mode=block";
                context.Response.Headers["Referrer-Policy"] = "no-referrer";
                context.Response.Headers["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups";
            }
            return Task.CompletedTask;
        });

        // Get Configuration for CORS/Origin check
        var envConfig = context.RequestServices.GetRequiredService<EnvConfiguration>();
        var frontendUrl = envConfig.Auth.FrontendUrl?.TrimEnd('/');
        var isDevelopment = string.Equals(Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"), "Development", StringComparison.OrdinalIgnoreCase);

        // 2. Generate and Set CSRF-TOKEN Cookie if not present
        if (!context.Request.Cookies.ContainsKey("CSRF-TOKEN"))
        {
            var csrfTokenBytes = new byte[32];
            using (var rng = RandomNumberGenerator.Create())
            {
                rng.GetBytes(csrfTokenBytes);
            }
            var csrfToken = Convert.ToHexString(csrfTokenBytes).ToLower();

            var cookieOptions = new CookieOptions
            {
                HttpOnly = false, // Must be readable by Axios on frontend
                Secure = !isDevelopment,    // Enforce Secure in production, false in development
                SameSite = SameSiteMode.Lax,
                Path = "/"
            };
            context.Response.Cookies.Append("CSRF-TOKEN", csrfToken, cookieOptions);
        }

        // 3. Validate CSRF on mutating HTTP requests (POST, PUT, DELETE, PATCH)
        var method = context.Request.Method;
        if (HttpMethods.IsPost(method) || HttpMethods.IsPut(method) || HttpMethods.IsDelete(method) || HttpMethods.IsPatch(method))
        {
            var path = context.Request.Path.Value ?? "";

            // Check if the endpoint is explicitly excluded from CSRF checks
            bool isExcluded = ExcludedMutatingPaths.Any(excluded => path.Equals(excluded, StringComparison.OrdinalIgnoreCase))
                              || path.StartsWith("/hubs/", StringComparison.OrdinalIgnoreCase)
                              || path.StartsWith("/api/v1/admin/", StringComparison.OrdinalIgnoreCase);

            if (!isExcluded && !envConfig.Auth.DisableCsrf)
            {
                // Double Submit Cookie Check
                context.Request.Headers.TryGetValue("X-CSRF-Token", out var headerCsrfToken);
                context.Request.Cookies.TryGetValue("CSRF-TOKEN", out var cookieCsrfToken);

                if (string.IsNullOrEmpty(headerCsrfToken) ||
                    string.IsNullOrEmpty(cookieCsrfToken) ||
                    !string.Equals(headerCsrfToken, cookieCsrfToken, StringComparison.Ordinal))
                {
                    logger.LogWarning("CSRF Token Validation Failed for path {Path}. Header Token present: {HeaderTokenPresent}, Cookie Token present: {CookieTokenPresent}",
                        path, !string.IsNullOrEmpty(headerCsrfToken), !string.IsNullOrEmpty(cookieCsrfToken));
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    context.Response.ContentType = "application/json";
                    await context.Response.WriteAsync("{\"error\": \"CSRF token validation failed.\"}");
                    return;
                }

                // Origin & Referer Defense-in-Depth Validation
                var origin = context.Request.Headers["Origin"].ToString()?.TrimEnd('/');
                var referer = context.Request.Headers["Referer"].ToString()?.TrimEnd('/');

                var allowedOrigins = new List<string> { "http://localhost:3000", "http://127.0.0.1:3000" };
                if (!string.IsNullOrEmpty(frontendUrl))
                {
                    var cleanFrontend = frontendUrl.TrimEnd('/');
                    if (!allowedOrigins.Contains(cleanFrontend, StringComparer.OrdinalIgnoreCase))
                    {
                        allowedOrigins.Add(cleanFrontend);
                    }
                }

                bool isValidOrigin = false;
                if (!string.IsNullOrEmpty(origin))
                {
                    isValidOrigin = allowedOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase);
                }
                else if (!string.IsNullOrEmpty(referer))
                {
                    isValidOrigin = allowedOrigins.Any(allowed => referer.StartsWith(allowed, StringComparison.OrdinalIgnoreCase));
                }

                // If Origin/Referer present and doesn't match configured frontend, block the request
                if ((!string.IsNullOrEmpty(origin) || !string.IsNullOrEmpty(referer)) && !isValidOrigin)
                {
                    logger.LogWarning("CSRF Origin Validation Failed for path {Path}. Origin: {Origin}, Referer: {Referer}, Allowed: {AllowedOrigins}",
                        path, origin, referer, string.Join(", ", allowedOrigins));
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    context.Response.ContentType = "application/json";
                    await context.Response.WriteAsync("{\"error\": \"Invalid request origin or referer.\"}");
                    return;
                }
            }
        }

        await _next(context);
    }
}
