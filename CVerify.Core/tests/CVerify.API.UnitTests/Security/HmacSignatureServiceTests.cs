
using System;
using FluentAssertions;
using Xunit;
using CVerify.API.Modules.Auth.Services;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.UnitTests.Security;

public class HmacSignatureServiceTests
{
    private readonly EnvConfiguration _config;
    private readonly HmacSignatureService _service;
    private const string TestSecret = "test-hmac-shared-secret-key-1234567890";

    public HmacSignatureServiceTests()
    {
        _config = new EnvConfiguration
        {
            Ai = new AiSettings
            {
                SharedSecret = TestSecret
            }
        };

        _service = new HmacSignatureService(_config);
    }

    [Fact]
    public void CreateSignatureHeaders_ShouldReturnValidHeaders()
    {
        // Act
        var result = _service.CreateSignatureHeaders("POST", "/api/v1/chat/stream", "{}");

        // Assert
        result.Signature.Should().NotBeNullOrWhiteSpace();
        result.Timestamp.Should().NotBeNullOrWhiteSpace();
        result.Nonce.Should().NotBeNullOrWhiteSpace();
        result.Nonce.Length.Should().Be(32); // Hex representation of 16 bytes
    }

    [Fact]
    public void ComputeSignature_ShouldProduceDeterministicOutput()
    {
        // Arrange
        const string method = "POST";
        const string url = "/api/v1/chat/stream";
        const string body = "{\"message\":\"hello\"}";
        const string timestamp = "1716000000";
        const string nonce = "abcdefghijklmnopqrstuvwxyz";

        // Act
        var sig1 = _service.ComputeSignature(method, url, body, timestamp, nonce);
        var sig2 = _service.ComputeSignature(method, url, body, timestamp, nonce);

        // Assert
        sig1.Should().NotBeNullOrWhiteSpace();
        sig1.Should().Be(sig2);
    }

    [Fact]
    public void ComputeSignature_ShouldDifferWhenInputsDiffer()
    {
        // Arrange
        const string method = "POST";
        const string url = "/api/v1/chat/stream";
        const string body = "{\"message\":\"hello\"}";
        const string timestamp = "1716000000";
        const string nonce1 = "nonce1";
        const string nonce2 = "nonce2";

        // Act
        var sig1 = _service.ComputeSignature(method, url, body, timestamp, nonce1);
        var sig2 = _service.ComputeSignature(method, url, body, timestamp, nonce2);

        // Assert
        sig1.Should().NotBe(sig2);
    }
}
