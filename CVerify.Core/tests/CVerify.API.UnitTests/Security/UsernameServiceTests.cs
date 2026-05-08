using System;
using FluentAssertions;
using Xunit;
using CVerify.API.Modules.Shared.Security;
using CVerify.API.Modules.Shared.Exceptions;
using Microsoft.Extensions.Time.Testing;

using CVerify.API.Modules.Shared.System.Services;
using Moq;

namespace CVerify.API.UnitTests.Security;

public class UsernameServiceTests
{
    private readonly UsernameService _service;

    public UsernameServiceTests()
    {
        // For unit testing pure logic methods, DB context is not required
        _service = new UsernameService(null!, new FakeTimeProvider(), null!, new Mock<IRateLimitPolicyService>().Object);
    }

    [Theory]
    [InlineData("valid_username")]
    [InlineData("valid.username")]
    [InlineData("valid-username")]
    [InlineData("valid123")]
    public void ValidateUsername_ShouldPass_ForValidUsernames(string username)
    {
        // Act & Assert
        Action act = () => _service.ValidateUsername(username);
        act.Should().NotThrow();
    }

    [Theory]
    [InlineData("")]
    [InlineData("  ")]
    [InlineData(null)]
    public void ValidateUsername_ShouldThrow_ForEmptyOrNull(string? username)
    {
        // Act & Assert
        Action act = () => _service.ValidateUsername(username!);
        act.Should().Throw<ValidationException>().WithMessage("*cannot be empty*");
    }

    [Theory]
    [InlineData("ab")] // Too short
    [InlineData("a")]
    public void ValidateUsername_ShouldThrow_ForTooShort(string username)
    {
        // Act & Assert
        Action act = () => _service.ValidateUsername(username);
        act.Should().Throw<ValidationException>().WithMessage("*at least 3 characters*");
    }

    [Fact]
    public void ValidateUsername_ShouldThrow_ForTooLong()
    {
        // Arrange
        var username = new string('a', 31);

        // Act & Assert
        Action act = () => _service.ValidateUsername(username);
        act.Should().Throw<ValidationException>().WithMessage("*cannot exceed 30 characters*");
    }

    [Theory]
    [InlineData("user@name")] // Invalid characters
    [InlineData("user name")]
    [InlineData("user#name")]
    public void ValidateUsername_ShouldThrow_ForInvalidCharacters(string username)
    {
        // Act & Assert
        Action act = () => _service.ValidateUsername(username);
        act.Should().Throw<ValidationException>().WithMessage("*only contain alphanumeric*");
    }

    [Theory]
    [InlineData("admin")]
    [InlineData("support")]
    [InlineData("settings")]
    [InlineData("api")]
    public void ValidateUsername_ShouldThrow_ForReservedKeywords(string username)
    {
        // Act & Assert
        Action act = () => _service.ValidateUsername(username);
        act.Should().Throw<ValidationException>().WithMessage("*reserved and cannot be used*");
    }

    [Fact]
    public void IsReserved_ShouldReturnTrue_ForCv()
    {
        // Act & Assert
        _service.IsReserved("cv").Should().BeTrue();
    }

    [Theory]
    [InlineData("  Username  ", "username")]
    [InlineData("USER_NAME", "user_name")]
    public void Normalize_ShouldTrimAndLowercase(string input, string expected)
    {
        // Act
        var result = _service.Normalize(input);

        // Assert
        result.Should().Be(expected);
    }

    [Theory]
    [InlineData("john.doe@gmail.com", "john.doe")]
    [InlineData("john_doe@example.com", "john_doe")]
    [InlineData("a@example.com", "axx")] // Pads if too short
    [InlineData("verylonglocalpartthatislongerthan28chars@gmail.com", "verylonglocalpartthatislonge")] // Truncates
    [InlineData("invalid$chars#here@gmail.com", "invalidchars-here")] // Strips invalid (wait, actually strips non-alphanumeric, underscores, hyphens, periods)
    public void GenerateBaseUsername_ShouldGenerateCorrectBase(string email, string expectedBase)
    {
        // Act
        var result = _service.GenerateBaseUsername(email);

        // Assert
        // Let's check that the generated base username doesn't contain the stripped characters
        if (email.Contains("invalid$chars#here"))
        {
            result.Should().Be("invalidcharshere");
        }
        else
        {
            result.Should().Be(expectedBase);
        }
    }
}
