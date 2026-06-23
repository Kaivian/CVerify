using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using FluentAssertions;
using Xunit;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.Security;

namespace CVerify.API.UnitTests.Security;

public class SecurityHeadersMiddlewareTests
{
    private class FakeHttpResponseFeature : IHttpResponseFeature
    {
        public List<(Func<object, Task> Callback, object State)> OnStartingCallbacks { get; } = new();

        public int StatusCode { get; set; } = 200;
        public string ReasonPhrase { get; set; } = "";
        public IHeaderDictionary Headers { get; set; } = new HeaderDictionary();
        public Stream Body { get; set; } = new MemoryStream();
        public bool HasStarted { get; private set; }

        public void OnStarting(Func<object, Task> callback, object state)
        {
            OnStartingCallbacks.Add((callback, state));
        }

        public void OnCompleted(Func<object, Task> callback, object state)
        {
        }

        public async Task FireOnStartingAsync()
        {
            HasStarted = true;
            // Execute in reverse order as standard ASP.NET Core pipeline
            for (int i = OnStartingCallbacks.Count - 1; i >= 0; i--)
            {
                var (callback, state) = OnStartingCallbacks[i];
                await callback(state);
            }
        }
    }

    [Fact]
    public async Task InvokeAsync_OnAuthPath_ShouldApplySecurityHeaders()
    {
        // Arrange
        var middleware = new SecurityHeadersMiddleware(async (ctx) =>
        {
            // Simulate response starting inside the next delegate or writing
            var feature = ctx.Features.Get<IHttpResponseFeature>() as FakeHttpResponseFeature;
            if (feature != null)
            {
                await feature.FireOnStartingAsync();
            }
            await ctx.Response.WriteAsync("test content");
        });

        var context = new DefaultHttpContext();
        context.Request.Path = "/api/auth/login";

        var responseFeature = new FakeHttpResponseFeature();
        context.Features.Set<IHttpResponseFeature>(responseFeature);

        var services = new ServiceCollection();
        var mockEnvConfig = new EnvConfiguration
        {
            Auth = new AuthSettings { DisableCsrf = true }
        };
        services.AddSingleton(mockEnvConfig);
        context.RequestServices = services.BuildServiceProvider();

        var mockLogger = new Mock<ILogger<SecurityHeadersMiddleware>>();

        // Act
        await middleware.InvokeAsync(context, mockLogger.Object);

        // Assert
        context.Response.Headers.Should().ContainKey("Cache-Control");
        context.Response.Headers["Cache-Control"].ToString().Should().Contain("no-store");
        context.Response.Headers["Cache-Control"].ToString().Should().Contain("no-cache");
        context.Response.Headers["Pragma"].ToString().Should().Contain("no-cache");
        context.Response.Headers["X-Content-Type-Options"].ToString().Should().Be("nosniff");
        context.Response.Headers["X-Frame-Options"].ToString().Should().Be("DENY");
    }
}
