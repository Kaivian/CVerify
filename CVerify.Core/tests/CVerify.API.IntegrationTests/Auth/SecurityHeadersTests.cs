using System;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using FluentAssertions;
using Xunit;
using CVerify.API.IntegrationTests.Fixtures;

namespace CVerify.API.IntegrationTests.Auth;

public class SecurityHeadersTests : BaseIntegrationTest
{
    public SecurityHeadersTests(SharedTestcontainerFixture containerFixture) : base(containerFixture)
    {
    }

    [Fact]
    public async Task Auth_Endpoints_Should_Expose_Strict_Security_Headers()
    {
        var response = await Client.GetAsync("/openapi/v1.json"); // Trigger a request to the server
        
        // Let's call a post endpoint to see headers applied by our SecurityHeadersMiddleware
        var loginResponse = await Client.PostAsync("/api/auth/login", null);
        
        // Assert anti-caching headers
        loginResponse.Headers.CacheControl.ToString().Should().Contain("no-store");
        loginResponse.Headers.CacheControl.ToString().Should().Contain("no-cache");
        loginResponse.Headers.Pragma.ToString().Should().Contain("no-cache");

        // Assert MIME-sniffing protection
        loginResponse.Headers.Contains("X-Content-Type-Options").Should().BeTrue();
        loginResponse.Headers.GetValues("X-Content-Type-Options").First().Should().Be("nosniff");

        // Assert clickjacking frame protection
        loginResponse.Headers.Contains("X-Frame-Options").Should().BeTrue();
        loginResponse.Headers.GetValues("X-Frame-Options").First().Should().Be("DENY");
    }
}
