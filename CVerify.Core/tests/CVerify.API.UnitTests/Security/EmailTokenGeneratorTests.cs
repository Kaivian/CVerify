
using System;
using System.Collections.Concurrent;
using System.Linq;
using System.Threading.Tasks;
using FluentAssertions;
using Xunit;
using CVerify.API.Modules.Shared.Security;

namespace CVerify.API.UnitTests.Security;

/// <summary>
/// Verifies that cryptographically secure token generations produce high-entropy, unique, and URL-safe Base64Url outputs.
/// </summary>
public class EmailTokenGeneratorTests
{
    [Fact]
    public void GenerateSecureToken_ShouldReturnNonEmptyString()
    {
        // Act
        var token = EmailTokenGenerator.GenerateSecureToken();

        // Assert
        token.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public void GenerateSecureToken_ShouldBeBase64UrlSafe()
    {
        // Act
        var token = EmailTokenGenerator.GenerateSecureToken();

        // Assert
        // Base64Url encoding strictly excludes '+', '/' and padding '=' characters
        token.Should().NotContain("+")
             .And.NotContain("/")
             .And.NotContain("=");

        // Only alphanumeric characters, dashes, and underscores are allowed
        token.All(c => char.IsLetterOrDigit(c) || c == '-' || c == '_').Should().BeTrue();
    }

    [Theory]
    [InlineData(16)]
    [InlineData(32)]
    [InlineData(64)]
    public void GenerateSecureToken_ShouldVaryLengthBasedOnEntropy(int byteLength)
    {
        // Act
        var token = EmailTokenGenerator.GenerateSecureToken(byteLength);

        // Assert
        // Safe URL Base64 string length should exceed the raw entropy byte count (roughly 4/3 ratio)
        token.Length.Should().BeGreaterThan(byteLength);
    }

    [Fact]
    public void GenerateSecureToken_ShouldProduceUniqueTokens()
    {
        // Act
        var tokens = Enumerable.Range(0, 1000)
            .Select(_ => EmailTokenGenerator.GenerateSecureToken())
            .ToList();

        // Assert
        tokens.Distinct().Count().Should().Be(1000);
    }

    [Fact]
    public async Task GenerateSecureToken_ShouldBeThreadSafeAndUniqueInParallel()
    {
        var tokens = new ConcurrentBag<string>();

        // Act - Spawn 1000 tasks simultaneously
        await Task.WhenAll(Enumerable.Range(0, 1000).Select(_ => Task.Run(() =>
        {
            tokens.Add(EmailTokenGenerator.GenerateSecureToken());
        })));

        // Assert
        tokens.Distinct().Count().Should().Be(1000);
    }
}
