
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

public class ForgotPasswordFlowTests : BaseIntegrationTest
{
    public ForgotPasswordFlowTests(SharedTestcontainerFixture containerFixture) : base(containerFixture)
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
    public async Task ForgotPassword_For_Active_User_Should_Create_Token_And_Outbox()
    {
        var email = $"forgot_{Guid.NewGuid()}@cverify.ai";
        var userId = await CreateActiveUserAsync(email);

        var request = new ForgotPasswordRequest(Email: email);
        var response = await Client.PostAsJsonAsync("/api/auth/forgot-password", request);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        
        var token = await db.ResetPasswordTokens.FirstOrDefaultAsync(t => t.UserId == userId);
        token.Should().NotBeNull();
        token!.ConsumedAt.Should().BeNull();

        var outbox = await db.OutboxMessages.FirstOrDefaultAsync(m => m.Type == "PasswordReset");
        outbox.Should().NotBeNull();
    }

    [Fact]
    public async Task ForgotPassword_For_Unknown_Email_Should_Return_Success_Idempotently()
    {
        var request = new ForgotPasswordRequest(Email: "unknown@cverify.ai");
        var response = await Client.PostAsJsonAsync("/api/auth/forgot-password", request);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task ForgotPassword_Subsequent_Requests_Within_Cooldown_Should_Throw_CooldownActive_Error()
    {
        var email = $"forgot_{Guid.NewGuid()}@cverify.ai";
        await CreateActiveUserAsync(email);

        var request = new ForgotPasswordRequest(Email: email);
        
        // First request: OK
        var response1 = await Client.PostAsJsonAsync("/api/auth/forgot-password", request);
        response1.StatusCode.Should().Be(HttpStatusCode.OK);

        // Immediate second request: Cooldown Error
        var response2 = await Client.PostAsJsonAsync("/api/auth/forgot-password", request);
        response2.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var problem = await response2.Content.ReadFromJsonAsync<Microsoft.AspNetCore.Mvc.ProblemDetails>();
        problem.Should().NotBeNull();
        problem!.Extensions["code"]!.ToString().Should().Be(AuthErrorCodes.CooldownActive);
    }
}
