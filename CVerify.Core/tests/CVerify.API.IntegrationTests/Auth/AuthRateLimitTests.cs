using System;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using FluentAssertions;
using CVerify.API.Application.DTOs;
using CVerify.API.IntegrationTests.Fixtures;
using Xunit;

namespace CVerify.API.IntegrationTests.Auth;

public class AuthRateLimitTests : BaseIntegrationTest
{
    public AuthRateLimitTests(SharedTestcontainerFixture containerFixture) : base(containerFixture)
    {
    }

    [Fact]
    public async Task ForgotPassword_Should_Rate_Limit_If_Threshold_Exceeded()
    {
        var request = new ForgotPasswordRequest(Email: "ratelimit@cverify.ai");

        // We execute up to 20 immediate requests to trigger the 429 rate limit safely.
        HttpResponseMessage? response = null;
        for (int i = 0; i < 20; i++)
        {
            response = await Client.PostAsJsonAsync("/api/auth/forgot-password", request);
            if (response.StatusCode == HttpStatusCode.TooManyRequests)
            {
                break;
            }
        }

        response!.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
    }
}
