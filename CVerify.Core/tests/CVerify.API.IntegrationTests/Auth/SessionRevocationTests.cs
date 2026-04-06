using System;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using CVerify.API.Application.DTOs;
using CVerify.API.Application.Exceptions;
using CVerify.API.Core.Entities;
using CVerify.API.Infrastructure.Persistence;
using CVerify.API.IntegrationTests.Fixtures;
using CVerify.API.IntegrationTests.Helpers;
using Xunit;

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
}
