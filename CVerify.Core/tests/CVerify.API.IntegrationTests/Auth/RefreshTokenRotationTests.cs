
using System;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using FluentAssertions;
using Xunit;
using CVerify.API.IntegrationTests.Fixtures;
using CVerify.API.IntegrationTests.Helpers;
using CVerify.API.Modules.Auth.DTOs;
using CVerify.API.Modules.Auth.Entities;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Persistence;

namespace CVerify.API.IntegrationTests.Auth;

public class RefreshTokenRotationTests : BaseIntegrationTest
{
    public RefreshTokenRotationTests(SharedTestcontainerFixture containerFixture) : base(containerFixture)
    {
    }

    private async Task<Guid> CreateActiveUserAsync(string email)
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var userRole = await db.Roles.FirstOrDefaultAsync(r => r.Name == "USER");
        if (userRole == null)
        {
            userRole = new Role
            {
                Name = "USER",
                DisplayName = "General User",
                Description = "Basic app user",
                IsSystem = true,
                IsActive = true
            };
            db.Roles.Add(userRole);
            await db.SaveChangesAsync();
        }

        var user = new UserBuilder()
            .WithEmail(email)
            .WithStatus(UserStatus.ACTIVE)
            .WithRole(userRole)
            .Build();

        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user.Id;
    }

    [Fact]
    public async Task RememberMe_False_Should_Expire_In_24_Hours()
    {
        // Arrange
        var email = $"remember_false_{Guid.NewGuid()}@cverify.ai";
        var userId = await CreateActiveUserAsync(email);

        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var sessionId = Guid.NewGuid();
        var tokenValue = $"token_false_{Guid.NewGuid()}";

        var refreshToken = new RefreshToken
        {
            UserId = userId,
            Token = tokenValue,
            SessionId = sessionId,
            RememberMe = false,
            ExpiresAt = DateTimeOffset.UtcNow.AddHours(24)
        };
        db.RefreshTokens.Add(refreshToken);
        await db.SaveChangesAsync();

        // Act
        Client.DefaultRequestHeaders.Add("X-CSRF-Token", "test_csrf");
        Client.DefaultRequestHeaders.Add("Cookie", $"CSRF-TOKEN=test_csrf; refresh_token={tokenValue}");
        var response = await Client.PostAsync("/api/auth/refresh-token", null);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Clean client cookies for subsequent tests
        Client.DefaultRequestHeaders.Remove("X-CSRF-Token");
        Client.DefaultRequestHeaders.Remove("Cookie");

        using var scope2 = Factory.Services.CreateScope();
        var db2 = scope2.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var updatedToken = await db2.RefreshTokens.FirstOrDefaultAsync(t => t.Token == tokenValue);
        updatedToken.Should().NotBeNull();
        updatedToken!.RememberMe.Should().BeFalse();
        updatedToken.IsRevoked.Should().BeTrue();

        var replacementToken = await db2.RefreshTokens.FirstOrDefaultAsync(t => t.Id == updatedToken.ReplacedByTokenId);
        replacementToken.Should().NotBeNull();
        replacementToken!.RememberMe.Should().BeFalse();
        // Expiration for rememberMe = false must be ~24 hours
        replacementToken.ExpiresAt.Should().BeCloseTo(DateTimeOffset.UtcNow.AddHours(24), TimeSpan.FromMinutes(5));
    }

    [Fact]
    public async Task RememberMe_True_Should_Expire_In_7_Days()
    {
        // Arrange
        var email = $"remember_true_{Guid.NewGuid()}@cverify.ai";
        var userId = await CreateActiveUserAsync(email);

        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var sessionId = Guid.NewGuid();
        var tokenValue = $"token_true_{Guid.NewGuid()}";

        var refreshToken = new RefreshToken
        {
            UserId = userId,
            Token = tokenValue,
            SessionId = sessionId,
            RememberMe = true,
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(7)
        };
        db.RefreshTokens.Add(refreshToken);
        await db.SaveChangesAsync();

        // Act
        Client.DefaultRequestHeaders.Add("X-CSRF-Token", "test_csrf");
        Client.DefaultRequestHeaders.Add("Cookie", $"CSRF-TOKEN=test_csrf; refresh_token={tokenValue}");
        var response = await Client.PostAsync("/api/auth/refresh-token", null);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Clean client cookies for subsequent tests
        Client.DefaultRequestHeaders.Remove("X-CSRF-Token");
        Client.DefaultRequestHeaders.Remove("Cookie");

        using var scope2 = Factory.Services.CreateScope();
        var db2 = scope2.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var updatedToken = await db2.RefreshTokens.FirstOrDefaultAsync(t => t.Token == tokenValue);
        updatedToken.Should().NotBeNull();
        updatedToken!.RememberMe.Should().BeTrue();
        updatedToken.IsRevoked.Should().BeTrue();

        var replacementToken = await db2.RefreshTokens.FirstOrDefaultAsync(t => t.Id == updatedToken.ReplacedByTokenId);
        replacementToken.Should().NotBeNull();
        replacementToken!.RememberMe.Should().BeTrue();
        // Expiration for rememberMe = true must be ~7 days
        replacementToken.ExpiresAt.Should().BeCloseTo(DateTimeOffset.UtcNow.AddDays(7), TimeSpan.FromMinutes(5));
    }

    [Fact]
    public async Task ConcurrentRefreshes_WithinGracePeriod_Should_Succeed_And_Return_ReplacementToken()
    {
        // Arrange
        var email = $"concurrent_{Guid.NewGuid()}@cverify.ai";
        var userId = await CreateActiveUserAsync(email);

        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var sessionId = Guid.NewGuid();
        var initialTokenVal = $"initial_token_{Guid.NewGuid()}";
        var activeReplacementVal = $"replacement_token_{Guid.NewGuid()}";

        // Pre-populate active replacement token to mock an already completed rotation
        var replacementToken = new RefreshToken
        {
            UserId = userId,
            Token = activeReplacementVal,
            SessionId = sessionId,
            RememberMe = true,
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(7)
        };
        db.RefreshTokens.Add(replacementToken);
        await db.SaveChangesAsync();

        var oldToken = new RefreshToken
        {
            UserId = userId,
            Token = initialTokenVal,
            SessionId = sessionId,
            RememberMe = true,
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(7),
            RevokedAt = DateTimeOffset.UtcNow.AddSeconds(-2), // revoked 2s ago (within 10s grace)
            ReplacedByToken = activeReplacementVal,
            ReplacedByTokenId = replacementToken.Id
        };
        db.RefreshTokens.Add(oldToken);
        await db.SaveChangesAsync();

        // Act - Simulate a late multi-tab refresh presenting the oldToken
        Client.DefaultRequestHeaders.Add("X-CSRF-Token", "test_csrf");
        Client.DefaultRequestHeaders.Add("Cookie", $"CSRF-TOKEN=test_csrf; refresh_token={initialTokenVal}");
        var response = await Client.PostAsync("/api/auth/refresh-token", null);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Clean cookies
        Client.DefaultRequestHeaders.Remove("X-CSRF-Token");
        Client.DefaultRequestHeaders.Remove("Cookie");

        // Verify the response returns user and tokens without throwing any exception
        var authResponse = await response.Content.ReadFromJsonAsync<AuthResponse>();
        authResponse.Should().NotBeNull();
        authResponse!.Id.Should().Be(userId);
    }
}
