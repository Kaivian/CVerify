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
using CVerify.API.Modules.Auth.Entities;
using CVerify.API.Modules.Auth.Services;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Exceptions;
using CVerify.API.Modules.Shared.Persistence;

namespace CVerify.API.IntegrationTests.Auth;

public class SessionRevocationTests : BaseIntegrationTest
{
    public SessionRevocationTests(SharedTestcontainerFixture containerFixture) : base(containerFixture)
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
    public async Task RefreshTokenTheft_Should_Revoke_Compromised_Session_Lineage_Only_Leaving_Other_Sessions_Active()
    {
        var email = $"theft_{Guid.NewGuid()}@cverify.ai";
        var userId = await CreateActiveUserAsync(email);

        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var compromisedSessionId = Guid.NewGuid();
        var safeSessionId = Guid.NewGuid();

        // Create active and revoked tokens with distinct Session IDs for this user
        var revokedToken = new RefreshToken
        {
            UserId = userId,
            Token = "already_revoked_token_value_abc",
            SessionId = compromisedSessionId,
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(7),
            RevokedAt = DateTimeOffset.UtcNow.AddMinutes(-5)
        };
        db.RefreshTokens.Add(revokedToken);

        var activeToken = new RefreshToken
        {
            UserId = userId,
            Token = "currently_active_token_value_xyz",
            SessionId = safeSessionId,
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(7)
        };
        db.RefreshTokens.Add(activeToken);

        await db.SaveChangesAsync();

        // Simulate presenting the already revoked token (theft scenario)
        Client.DefaultRequestHeaders.Add("X-CSRF-Token", "test_csrf");
        Client.DefaultRequestHeaders.Add("Cookie", "CSRF-TOKEN=test_csrf; refresh_token=already_revoked_token_value_abc");

        var response = await Client.PostAsync("/api/auth/refresh-token", null);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        Client.DefaultRequestHeaders.Remove("X-CSRF-Token");
        Client.DefaultRequestHeaders.Remove("Cookie");

        var problem = await response.Content.ReadFromJsonAsync<Microsoft.AspNetCore.Mvc.ProblemDetails>();
        problem.Should().NotBeNull();
        problem!.Extensions["code"]!.ToString().Should().Be(AuthErrorCodes.InvalidToken);

        // Verify compromised session chain has no active tokens, but safeSessionId remains untouched!
        using var scope2 = Factory.Services.CreateScope();
        var db2 = scope2.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var compromisedTokens = await db2.RefreshTokens
            .Where(t => t.SessionId == compromisedSessionId && t.RevokedAt == null)
            .ToListAsync();
        compromisedTokens.Should().BeEmpty();

        var safeTokens = await db2.RefreshTokens
            .Where(t => t.SessionId == safeSessionId && t.RevokedAt == null)
            .ToListAsync();
        safeTokens.Should().NotBeEmpty();
        safeTokens.First().Token.Should().Be("currently_active_token_value_xyz");
    }

    [Fact]
    public async Task ValidSid_ActiveSession_Should_Pass()
    {
        var email = $"active_{Guid.NewGuid()}@cverify.ai";
        var userId = await CreateActiveUserAsync(email);
        var sessionId = Guid.NewGuid();
        var refreshTokenValue = $"active_rt_{Guid.NewGuid()}";

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FindAsync(userId);
            var tokenService = scope.ServiceProvider.GetRequiredService<ITokenService>();

            var rt = new RefreshToken
            {
                UserId = userId,
                Token = refreshTokenValue,
                SessionId = sessionId,
                ExpiresAt = DateTimeOffset.UtcNow.AddDays(7)
            };
            db.RefreshTokens.Add(rt);
            await db.SaveChangesAsync();

            var jwt = tokenService.GenerateJwtToken(user!, new[] { "USER" }, Enumerable.Empty<string>(), sessionId: sessionId);

            Client.DefaultRequestHeaders.Add("Cookie", $"access_token={jwt}; refresh_token={refreshTokenValue}");
        }

        var response = await Client.GetAsync("/api/auth/me");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        Client.DefaultRequestHeaders.Remove("Cookie");
    }

    [Fact]
    public async Task ValidSid_RevokedSession_Should_Fail()
    {
        var email = $"revoked_{Guid.NewGuid()}@cverify.ai";
        var userId = await CreateActiveUserAsync(email);
        var sessionId = Guid.NewGuid();
        var refreshTokenValue = $"revoked_rt_{Guid.NewGuid()}";

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FindAsync(userId);
            var tokenService = scope.ServiceProvider.GetRequiredService<ITokenService>();

            var rt = new RefreshToken
            {
                UserId = userId,
                Token = refreshTokenValue,
                SessionId = sessionId,
                ExpiresAt = DateTimeOffset.UtcNow.AddDays(7),
                RevokedAt = DateTimeOffset.UtcNow.AddMinutes(-5)
            };
            db.RefreshTokens.Add(rt);
            await db.SaveChangesAsync();

            var jwt = tokenService.GenerateJwtToken(user!, new[] { "USER" }, Enumerable.Empty<string>(), sessionId: sessionId);

            Client.DefaultRequestHeaders.Add("Cookie", $"access_token={jwt}; refresh_token={refreshTokenValue}");
        }

        var response = await Client.GetAsync("/api/auth/me");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        Client.DefaultRequestHeaders.Remove("Cookie");
    }

    [Fact]
    public async Task MissingSid_ActiveCookieFallback_Should_Pass()
    {
        var email = $"fallback_active_{Guid.NewGuid()}@cverify.ai";
        var userId = await CreateActiveUserAsync(email);
        var sessionId = Guid.NewGuid();
        var refreshTokenValue = $"fallback_rt_{Guid.NewGuid()}";

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FindAsync(userId);
            var tokenService = scope.ServiceProvider.GetRequiredService<ITokenService>();

            var rt = new RefreshToken
            {
                UserId = userId,
                Token = refreshTokenValue,
                SessionId = sessionId,
                ExpiresAt = DateTimeOffset.UtcNow.AddDays(7)
            };
            db.RefreshTokens.Add(rt);
            await db.SaveChangesAsync();

            var jwt = tokenService.GenerateJwtToken(user!, new[] { "USER" }, Enumerable.Empty<string>(), sessionId: null);

            Client.DefaultRequestHeaders.Add("Cookie", $"access_token={jwt}; refresh_token={refreshTokenValue}");
        }

        var response = await Client.GetAsync("/api/auth/me");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        Client.DefaultRequestHeaders.Remove("Cookie");
    }

    [Fact]
    public async Task MissingSid_RevokedCookieFallback_Should_Fail()
    {
        var email = $"fallback_revoked_{Guid.NewGuid()}@cverify.ai";
        var userId = await CreateActiveUserAsync(email);
        var sessionId = Guid.NewGuid();
        var refreshTokenValue = $"fallback_revoked_rt_{Guid.NewGuid()}";

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FindAsync(userId);
            var tokenService = scope.ServiceProvider.GetRequiredService<ITokenService>();

            var rt = new RefreshToken
            {
                UserId = userId,
                Token = refreshTokenValue,
                SessionId = sessionId,
                ExpiresAt = DateTimeOffset.UtcNow.AddDays(7),
                RevokedAt = DateTimeOffset.UtcNow.AddMinutes(-5)
            };
            db.RefreshTokens.Add(rt);
            await db.SaveChangesAsync();

            var jwt = tokenService.GenerateJwtToken(user!, new[] { "USER" }, Enumerable.Empty<string>(), sessionId: null);

            Client.DefaultRequestHeaders.Add("Cookie", $"access_token={jwt}; refresh_token={refreshTokenValue}");
        }

        var response = await Client.GetAsync("/api/auth/me");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        Client.DefaultRequestHeaders.Remove("Cookie");
    }

    [Fact]
    public async Task InvalidSid_Should_Fail()
    {
        var email = $"invalid_sid_{Guid.NewGuid()}@cverify.ai";
        var userId = await CreateActiveUserAsync(email);
        var sessionId = Guid.NewGuid();

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FindAsync(userId);
            var tokenService = scope.ServiceProvider.GetRequiredService<ITokenService>();

            var jwt = tokenService.GenerateJwtToken(user!, new[] { "USER" }, Enumerable.Empty<string>(), sessionId: sessionId);

            Client.DefaultRequestHeaders.Add("Cookie", $"access_token={jwt}");
        }

        var response = await Client.GetAsync("/api/auth/me");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        Client.DefaultRequestHeaders.Remove("Cookie");
    }

    [Fact]
    public async Task RevokeCurrentSession_Should_Return_BadRequest_And_Fail()
    {
        var email = $"self_revoke_{Guid.NewGuid()}@cverify.ai";
        var userId = await CreateActiveUserAsync(email);
        var sessionId = Guid.NewGuid();
        var refreshTokenValue = $"rt_{Guid.NewGuid()}";

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FindAsync(userId);
            var tokenService = scope.ServiceProvider.GetRequiredService<ITokenService>();

            var rt = new RefreshToken
            {
                UserId = userId,
                Token = refreshTokenValue,
                SessionId = sessionId,
                ExpiresAt = DateTimeOffset.UtcNow.AddDays(7)
            };
            db.RefreshTokens.Add(rt);
            await db.SaveChangesAsync();

            var jwt = tokenService.GenerateJwtToken(user!, new[] { "USER" }, Enumerable.Empty<string>(), sessionId: sessionId);

            Client.DefaultRequestHeaders.Add("Cookie", $"access_token={jwt}; refresh_token={refreshTokenValue}");
        }

        var response = await Client.DeleteAsync($"/api/auth/sessions/{sessionId}");
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        Client.DefaultRequestHeaders.Remove("Cookie");
    }
}
