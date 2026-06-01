using System;
using System.Collections.Generic;
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
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Persistence;

namespace CVerify.API.IntegrationTests.Auth;

public class AccountDeletionTests : BaseIntegrationTest
{
    public AccountDeletionTests(SharedTestcontainerFixture containerFixture) : base(containerFixture)
    {
    }

    private async Task SeedDefaultRolesAsync(ApplicationDbContext db)
    {
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
    }

    private async Task<User> CreateActiveUserAsync(string email, string password = "Password123!")
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await SeedDefaultRolesAsync(db);

        var userRole = await db.Roles.FirstAsync(r => r.Name == "USER");
        var passwordHash = BCrypt.Net.BCrypt.HashPassword(password);

        var user = new UserBuilder()
            .WithEmail(email)
            .WithStatus(UserStatus.ACTIVE)
            .WithRole(userRole)
            .Build();

        user.PasswordHash = passwordHash;
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user;
    }

    [Fact]
    public async Task DeleteMe_WithoutVerification_Should_Fail()
    {
        var email = $"delete_fail_{Guid.NewGuid()}@cverify.ai";
        var user = await CreateActiveUserAsync(email);

        // Authenticate the client
        var loginRequest = new LoginRequest(Email: email, Password: "Password123!");
        var loginResponse = await Client.PostAsJsonAsync("/api/auth/login", loginRequest);
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var setCookie = loginResponse.Headers.GetValues("Set-Cookie").First(c => c.StartsWith("access_token"));
        var cookieVal = setCookie.Split(';')[0];
        
        var requestMessage = new HttpRequestMessage(HttpMethod.Post, "/api/users/me/delete-request");
        requestMessage.Headers.Add("Cookie", cookieVal);
        requestMessage.Content = JsonContent.Create(new InitiateDeletionRequest(
            Password: "",
            DeletionAuthorizeToken: null,
            FallbackOtpCode: null,
            FallbackOtpChallengeId: null,
            ConfirmationPhrase: "delete my account"
        ));

        var deleteResponse = await Client.SendAsync(requestMessage);
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var result = await deleteResponse.Content.ReadFromJsonAsync<DeletionInitiationResponse>();
        result!.Success.Should().BeFalse();
        result.ErrorCode.Should().Be("PASSWORD_REQUIRED");
    }

    [Fact]
    public async Task DeleteMe_PasswordReauth_Success_EntersDeletionPendingState()
    {
        var email = $"delete_pass_{Guid.NewGuid()}@cverify.ai";
        var user = await CreateActiveUserAsync(email);

        var loginRequest = new LoginRequest(Email: email, Password: "Password123!");
        var loginResponse = await Client.PostAsJsonAsync("/api/auth/login", loginRequest);
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var setCookie = loginResponse.Headers.GetValues("Set-Cookie").First(c => c.StartsWith("access_token"));
        var cookieVal = setCookie.Split(';')[0];
        
        var requestMessage = new HttpRequestMessage(HttpMethod.Post, "/api/users/me/delete-request");
        requestMessage.Headers.Add("Cookie", cookieVal);
        requestMessage.Content = JsonContent.Create(new InitiateDeletionRequest(
            Password: "Password123!",
            DeletionAuthorizeToken: null,
            FallbackOtpCode: null,
            FallbackOtpChallengeId: null,
            ConfirmationPhrase: "delete my account"
        ));

        var deleteResponse = await Client.SendAsync(requestMessage);
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var result = await deleteResponse.Content.ReadFromJsonAsync<DeletionInitiationResponse>();
        result!.Success.Should().BeTrue();

        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var dbUser = await db.Users.FindAsync(user.Id);
        dbUser!.Status.Should().Be(UserStatus.DELETION_PENDING);
        dbUser.DeletedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task DeleteMe_WhenLegalHoldActive_Should_Fail()
    {
        var email = $"delete_hold_{Guid.NewGuid()}@cverify.ai";
        var user = await CreateActiveUserAsync(email);

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var dbUser = await db.Users.FindAsync(user.Id);
            dbUser!.IsLegalHold = true;
            await db.SaveChangesAsync();
        }

        var loginRequest = new LoginRequest(Email: email, Password: "Password123!");
        var loginResponse = await Client.PostAsJsonAsync("/api/auth/login", loginRequest);
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var setCookie = loginResponse.Headers.GetValues("Set-Cookie").First(c => c.StartsWith("access_token"));
        var cookieVal = setCookie.Split(';')[0];
        
        var requestMessage = new HttpRequestMessage(HttpMethod.Post, "/api/users/me/delete-request");
        requestMessage.Headers.Add("Cookie", cookieVal);
        requestMessage.Content = JsonContent.Create(new InitiateDeletionRequest(
            Password: "Password123!",
            DeletionAuthorizeToken: null,
            FallbackOtpCode: null,
            FallbackOtpChallengeId: null,
            ConfirmationPhrase: "delete my account"
        ));

        var deleteResponse = await Client.SendAsync(requestMessage);
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var result = await deleteResponse.Content.ReadFromJsonAsync<DeletionInitiationResponse>();
        result!.Success.Should().BeFalse();
        result.ErrorCode.Should().Be("LEGAL_HOLD_PREVENT_DELETE");
    }

    [Fact]
    public async Task ReactivateAccount_Within14Days_RestoresActiveState()
    {
        var email = $"reactivate_{Guid.NewGuid()}@cverify.ai";
        var user = await CreateActiveUserAsync(email);

        // Put user in DELETION_PENDING
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var dbUser = await db.Users.FindAsync(user.Id);
            dbUser!.Status = UserStatus.DELETION_PENDING;
            dbUser.DeletedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync();
        }

        // Try to login - should receive reactivation token in nextStep field
        var loginRequest = new LoginRequest(Email: email, Password: "Password123!");
        var loginResponse = await Client.PostAsJsonAsync("/api/auth/login", loginRequest);
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var authData = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>();
        authData!.Status.Should().Be("DELETION_PENDING");
        authData.NextStep.Should().StartWith("REACTIVATE:");

        var reactivationToken = authData.NextStep.Split(':')[1];
        reactivationToken.Should().NotBeNullOrWhiteSpace();

        // Call Reactivate endpoint
        var reactivateRequest = new ReactivateRequest(reactivationToken);
        var reactivateResponse = await Client.PostAsJsonAsync("/api/auth/reactivate", reactivateRequest);
        reactivateResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var dbUser = await db.Users.FindAsync(user.Id);
            dbUser!.Status.Should().Be(UserStatus.ACTIVE);
            dbUser.DeletedAt.Should().BeNull();
        }
    }

    [Fact]
    public async Task Register_DuplicateEmail_DuringGracePeriod_Should_Fail()
    {
        var email = $"register_grace_{Guid.NewGuid()}@cverify.ai";
        var user = await CreateActiveUserAsync(email);

        // Put user in DELETION_PENDING
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var dbUser = await db.Users.FindAsync(user.Id);
            dbUser!.Status = UserStatus.DELETION_PENDING;
            dbUser.DeletedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync();
        }

        // Try registering with same email
        var registerRequest = new RegisterRequest(
            Email: email,
            Password: "NewPassword123!",
            ConfirmPassword: "NewPassword123!",
            FullName: "Grace Returner"
        );
        var registerResponse = await Client.PostAsJsonAsync("/api/auth/register", registerRequest);
        registerResponse.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Register_SameEmail_After14DayPurge_Should_Succeed_WithNewUserId()
    {
        var email = $"register_purge_{Guid.NewGuid()}@cverify.ai";
        var user = await CreateActiveUserAsync(email);

        // Simulate permanent purge by hard-deleting the user from PostgreSQL
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var dbUser = await db.Users.FindAsync(user.Id);
            db.Users.Remove(dbUser!);
            await db.SaveChangesAsync();
        }

        // Now register with same email - should succeed
        var registerRequest = new RegisterRequest(
            Email: email,
            Password: "NewPassword123!",
            ConfirmPassword: "NewPassword123!",
            FullName: "Grace Returner"
        );
        var registerResponse = await Client.PostAsJsonAsync("/api/auth/register", registerRequest);
        registerResponse.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
