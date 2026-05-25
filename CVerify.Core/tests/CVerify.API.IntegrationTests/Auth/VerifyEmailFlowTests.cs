using System;
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

public class VerifyEmailFlowTests : BaseIntegrationTest
{
    public VerifyEmailFlowTests(SharedTestcontainerFixture containerFixture) : base(containerFixture)
    {
    }

    private async Task<(Guid UserId, string TokenValue)> CreatePendingUserAndTokenAsync(DateTimeOffset expiresAt)
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
            .WithEmail($"pending_{Guid.NewGuid()}@cverify.ai")
            .WithStatus(UserStatus.EMAIL_VERIFY_PENDING)
            .WithRole(userRole)
            .Build();

        db.Users.Add(user);
        await db.SaveChangesAsync();

        var tokenVal = "token_" + Guid.NewGuid().ToString("N");
        var tokenEntity = new TokenBuilder()
            .ForUser(user.Id)
            .WithToken(tokenVal)
            .WithExpiration(expiresAt)
            .BuildVerificationToken();

        db.VerificationTokens.Add(tokenEntity);
        await db.SaveChangesAsync();

        return (user.Id, tokenVal);
    }

    [Fact]
    public async Task Verify_With_Valid_Token_Should_Activate_User()
    {
        var (userId, tokenVal) = await CreatePendingUserAndTokenAsync(DateTimeOffset.UtcNow.AddHours(2));

        var request = new VerifyEmailRequest(Token: tokenVal);
        var response = await Client.PostAsJsonAsync("/api/auth/verify-email", request);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.FindAsync(userId);
        user!.Status.Should().Be(UserStatus.ACTIVE);
    }

    [Fact]
    public async Task Verify_With_Expired_Token_Should_Throw_ExpiredToken_Error()
    {
        var (_, tokenVal) = await CreatePendingUserAndTokenAsync(DateTimeOffset.UtcNow.AddHours(-1));

        var request = new VerifyEmailRequest(Token: tokenVal);
        var response = await Client.PostAsJsonAsync("/api/auth/verify-email", request);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var problem = await response.Content.ReadFromJsonAsync<Microsoft.AspNetCore.Mvc.ProblemDetails>();
        problem.Should().NotBeNull();
        problem!.Extensions["code"]!.ToString().Should().Be(AuthErrorCodes.ExpiredToken);
    }

    [Fact]
    public async Task Verify_Twice_With_Same_Token_Should_Throw_AlreadyConsumed_Error()
    {
        var (_, tokenVal) = await CreatePendingUserAndTokenAsync(DateTimeOffset.UtcNow.AddHours(2));

        var request = new VerifyEmailRequest(Token: tokenVal);
        var response1 = await Client.PostAsJsonAsync("/api/auth/verify-email", request);
        response1.StatusCode.Should().Be(HttpStatusCode.OK);

        var response2 = await Client.PostAsJsonAsync("/api/auth/verify-email", request);
        response2.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var problem = await response2.Content.ReadFromJsonAsync<Microsoft.AspNetCore.Mvc.ProblemDetails>();
        problem.Should().NotBeNull();
        problem!.Extensions["code"]!.ToString().Should().Be(AuthErrorCodes.TokenAlreadyConsumed);
    }
}
