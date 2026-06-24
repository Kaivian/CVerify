
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using FluentAssertions;
using Xunit;
using CVerify.API.IntegrationTests.Fixtures;
using CVerify.API.Modules.Auth.DTOs;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Persistence;

namespace CVerify.API.IntegrationTests.Auth;

public class PerformanceStressTests : BaseIntegrationTest
{
    public PerformanceStressTests(SharedTestcontainerFixture containerFixture)
        : base(containerFixture, new Dictionary<string, string> { { "RateLimit__RegisterPermitLimit", "1000" } })
    {
    }

    private async Task SeedDefaultRolesAsync()
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var userRole = await db.Roles.FirstOrDefaultAsync(r => r.Name == "USER");
        if (userRole == null)
        {
            db.Roles.Add(new Role
            {
                Name = "USER",
                DisplayName = "General User",
                Description = "Basic app access",
                IsSystem = true,
                IsActive = true
            });
            await db.SaveChangesAsync();
        }
    }

    [Fact]
    public async Task HighConcurrency_Registrations_Should_Complete_Within_Acceptable_Thresholds()
    {
        await SeedDefaultRolesAsync();

        var stopwatch = Stopwatch.StartNew();
        var tasks = new List<Task<HttpResponseMessage>>();

        // Spawn 20 concurrent registration tasks
        for (int i = 0; i < 20; i++)
        {
            var request = new RegisterRequest(
                Email: $"concurrent_user_{i}_{Guid.NewGuid()}@cverify.ai",
                Password: "SecurePassword123!",
                ConfirmPassword: "SecurePassword123!",
                FullName: $"Concurrent User {i}"
            );
            tasks.Add(Client.PostAsJsonAsync("/api/auth/register", request));
        }

        var responses = await Task.WhenAll(tasks);
        stopwatch.Stop();

        // Timing benchmark gate
        stopwatch.ElapsedMilliseconds.Should().BeLessThan(10000, "High-concurrency registrations should scale smoothly.");

        foreach (var r in responses)
        {
            r.StatusCode.Should().Be(HttpStatusCode.OK);
        }
    }
}
