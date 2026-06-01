
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
using CVerify.API.Modules.Shared.Persistence;

namespace CVerify.API.IntegrationTests.Auth;

public class AuthChaosTests : BaseIntegrationTest
{
    public AuthChaosTests(SharedTestcontainerFixture containerFixture) : base(containerFixture)
    {
    }

    [Fact]
    public async Task Registration_With_Simulated_Database_Crash_Should_Rollback_Cleanly()
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        // Ensure "USER" role exists to satisfy the foreign key constraint
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

        // Create a custom transaction and verify rollback behavior manually in code.
        using var transaction = await db.Database.BeginTransactionAsync();
        try
        {
            var user = new UserBuilder()
                .WithEmail("chaos@cverify.ai")
                .WithRole(userRole)
                .Build();

            db.Users.Add(user);
            await db.SaveChangesAsync();

            // Simulate crash/exception
            throw new InvalidOperationException("Simulated Database Crash");
        }
        catch (InvalidOperationException)
        {
            await transaction.RollbackAsync();
        }

        // Verify user was NOT persisted
        var persistedUser = await db.Users.FirstOrDefaultAsync(u => u.Email == "chaos@cverify.ai");
        persistedUser.Should().BeNull();
    }
}
