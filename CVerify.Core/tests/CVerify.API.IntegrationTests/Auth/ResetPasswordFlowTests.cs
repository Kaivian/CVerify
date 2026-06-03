
using System;
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
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Exceptions;
using CVerify.API.Modules.Shared.Persistence;

namespace CVerify.API.IntegrationTests.Auth;

public class ResetPasswordFlowTests : BaseIntegrationTest
{
    public ResetPasswordFlowTests(SharedTestcontainerFixture containerFixture) : base(containerFixture)
    {
    }

    private async Task<(Guid UserId, string TokenValue)> CreateActiveUserAndResetTokenAsync(DateTimeOffset expiresAt)
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
            .WithEmail($"active_{Guid.NewGuid()}@cverify.ai")
            .WithStatus(UserStatus.ACTIVE)
            .WithRole(userRole)
            .Build();

        db.Users.Add(user);
        await db.SaveChangesAsync();

        var tokenVal = "token_" + Guid.NewGuid().ToString("N");
        var tokenEntity = new TokenBuilder()
            .ForUser(user.Id)
            .WithToken(tokenVal)
            .WithExpiration(expiresAt)
            .BuildResetPasswordToken();

        db.ResetPasswordTokens.Add(tokenEntity);
        await db.SaveChangesAsync();

        return (user.Id, tokenVal);
    }

    [Fact]
    public async Task ResetPassword_With_Valid_Token_Should_Succeed_And_Update_Password()
    {
        var (userId, tokenVal) = await CreateActiveUserAndResetTokenAsync(DateTimeOffset.UtcNow.AddHours(1));

        var request = new ResetPasswordRequest(
            Token: tokenVal,
            Password: "NewSecurePassword123!",
            ConfirmPassword: "NewSecurePassword123!"
        );

        var response = await Client.PostAsJsonAsync("/api/auth/reset-password", request);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.FindAsync(userId);
        BCrypt.Net.BCrypt.Verify("NewSecurePassword123!", user!.PasswordHash).Should().BeTrue();
    }

    [Fact]
    public async Task ResetPassword_With_Expired_Token_Should_Throw_ExpiredToken_Error()
    {
        var (_, tokenVal) = await CreateActiveUserAndResetTokenAsync(DateTimeOffset.UtcNow.AddHours(-1));

        var request = new ResetPasswordRequest(
            Token: tokenVal,
            Password: "NewSecurePassword123!",
            ConfirmPassword: "NewSecurePassword123!"
        );

        var response = await Client.PostAsJsonAsync("/api/auth/reset-password", request);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var problem = await response.Content.ReadFromJsonAsync<Microsoft.AspNetCore.Mvc.ProblemDetails>();
        problem.Should().NotBeNull();
        problem!.Extensions["code"]!.ToString().Should().Be(AuthErrorCodes.ExpiredToken);
    }

    [Fact]
    public async Task ResetPassword_With_Mismatched_Passwords_Should_Return_BadRequest()
    {
        var (_, tokenVal) = await CreateActiveUserAndResetTokenAsync(DateTimeOffset.UtcNow.AddHours(1));

        var request = new ResetPasswordRequest(
            Token: tokenVal,
            Password: "NewSecurePassword123!",
            ConfirmPassword: "MismatchedConfirmPassword123!"
        );

        var response = await Client.PostAsJsonAsync("/api/auth/reset-password", request);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
