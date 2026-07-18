using System;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using FluentAssertions;
using CVerify.API.IntegrationTests.Fixtures;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.IntegrationTests.Intelligence;

[Collection("Shared Containers Collection")]
public class AiServiceContractTests : BaseIntegrationTest
{
    public AiServiceContractTests(SharedTestcontainerFixture containerFixture)
        : base(containerFixture)
    {
    }

    [Fact]
    public void Verify_HmacFormula_MatchPython_Implementation()
    {
        // Arrange
        using var scope = Factory.Services.CreateScope();
        var hmacService = scope.ServiceProvider.GetRequiredService<IHmacSignatureService>();

        const string method = "POST";
        const string path = "/api/v1/candidate/assess/stream";
        const string body = "{\"cv\":{\"cvId\":\"test-cv\"}}";
        var config = scope.ServiceProvider.GetRequiredService<CVerify.API.Modules.Shared.Configuration.EnvConfiguration>();
        string secret = config.Ai.SharedSecret;

        // Act
        var (signature, timestamp, nonce) = hmacService.CreateSignatureHeaders(method, path, body);

        // Assert
        signature.Should().NotBeNullOrEmpty();
        timestamp.Should().NotBeNullOrEmpty();
        nonce.Should().NotBeNullOrEmpty();

        // Calculate expected HMAC manually in C# to verify it aligns with the Python formula:
        // HMAC_SHA256(Method + Path + Body + Timestamp + Nonce, Secret)
        string message = $"{method}{path}{body}{timestamp}{nonce}";
        byte[] keyBytes = Encoding.UTF8.GetBytes(secret);
        byte[] messageBytes = Encoding.UTF8.GetBytes(message);

        using var hmac = new HMACSHA256(keyBytes);
        byte[] hashBytes = hmac.ComputeHash(messageBytes);
        string expectedSignature = Convert.ToHexString(hashBytes).ToLower();

        signature.Should().Be(expectedSignature);
    }
}
