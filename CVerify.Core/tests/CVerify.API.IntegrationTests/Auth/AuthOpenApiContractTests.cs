using System;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using FluentAssertions;
using Xunit;
using CVerify.API.IntegrationTests.Fixtures;

namespace CVerify.API.IntegrationTests.Auth;

public class AuthOpenApiContractTests : BaseIntegrationTest
{
    public AuthOpenApiContractTests(SharedTestcontainerFixture containerFixture) : base(containerFixture)
    {
    }

    [Fact]
    public async Task OpenAPI_Endpoint_Should_Return_Success_And_Valid_JSON_Contract()
    {
        var response = await Client.GetAsync("/openapi/v1.json");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadAsStringAsync();
        content.Should().NotBeNullOrWhiteSpace();
        content.Should().Contain("\"openapi\":");
        content.Should().Contain("\"/api/auth/login\"");
        content.Should().Contain("\"/api/auth/register\"");
    }
}
