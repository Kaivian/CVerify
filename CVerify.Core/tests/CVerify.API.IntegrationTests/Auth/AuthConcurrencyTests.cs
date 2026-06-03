
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
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Persistence;

namespace CVerify.API.IntegrationTests.Auth;

public class AuthConcurrencyTests : BaseIntegrationTest
{
    public AuthConcurrencyTests(SharedTestcontainerFixture containerFixture) : base(containerFixture)
    {
    }

    [Fact]
    public async Task EFCore_Concurrency_Should_Throw_DbUpdateConcurrencyException_On_Simultaneous_Entity_Updates()
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
            .WithEmail($"concurrency_{Guid.NewGuid()}@cverify.ai")
            .WithStatus(UserStatus.EMAIL_VERIFY_PENDING)
            .WithRole(userRole)
            .Build();

        db.Users.Add(user);
        await db.SaveChangesAsync();

        // Simulate reading the user entity concurrently in two separate scopes
        using var scope1 = Factory.Services.CreateScope();
        var db1 = scope1.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var userInstance1 = await db1.Users.FindAsync(user.Id);

        using var scope2 = Factory.Services.CreateScope();
        var db2 = scope2.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var userInstance2 = await db2.Users.FindAsync(user.Id);

        // Edit in first transaction
        userInstance1!.Status = UserStatus.ACTIVE;
        await db1.SaveChangesAsync();

        // Edit in second transaction (should trigger concurrency conflict)
        userInstance2!.Status = UserStatus.BANNED;
        Func<Task> act = async () => await db2.SaveChangesAsync();
        
        await act.Should().ThrowAsync<DbUpdateConcurrencyException>();
    }
}
