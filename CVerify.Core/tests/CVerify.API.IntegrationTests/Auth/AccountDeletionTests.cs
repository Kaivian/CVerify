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
using CVerify.API.Core.Entities;
using CVerify.API.Infrastructure.Persistence;
using CVerify.API.IntegrationTests.Fixtures;
using CVerify.API.IntegrationTests.Helpers;
using Xunit;

namespace CVerify.API.IntegrationTests.Auth;

public class AccountDeletionTests : BaseIntegrationTest
{
    public AccountDeletionTests(SharedTestcontainerFixture containerFixture) : base(containerFixture)
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
    public async Task DeleteMe_Should_SoftDelete_User_And_Revoke_Sessions()
    {
        var email = $"delete_{Guid.NewGuid()}@cverify.ai";
        var userId = await CreateActiveUserAsync(email);

        // Authenticate the client
        var loginRequest = new LoginRequest(Email: email, Password: "Password123!");
        var loginResponse = await Client.PostAsJsonAsync("/api/auth/login", loginRequest);
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var setCookie = loginResponse.Headers.GetValues("Set-Cookie").First(c => c.StartsWith("access_token"));
        var cookieVal = setCookie.Split(';')[0];
        
        var requestMessage = new HttpRequestMessage(HttpMethod.Delete, "/api/users/me");
        requestMessage.Headers.Add("Cookie", cookieVal);

        var deleteResponse = await Client.SendAsync(requestMessage);
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.FindAsync(userId);
        
        user!.Status.Should().Be(UserStatus.DELETED);
        user.DeletedAt.Should().NotBeNull();

        // Active tokens should be cleaned
        var refreshActive = await db.RefreshTokens.AnyAsync(t => t.UserId == userId && t.RevokedAt == null);
        refreshActive.Should().BeFalse();

        // Persistent audit log check
        var audit = await db.AuditLogs.FirstOrDefaultAsync(l => l.UserId == userId && l.EventType == "USER_DELETED");
        audit.Should().NotBeNull();
    }
}
