using System;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using CVerify.API.Application.DTOs;
using CVerify.API.Application.Exceptions;
using CVerify.API.Application.Interfaces;
using CVerify.API.Core.Entities;
using CVerify.API.Infrastructure.Persistence;
using CVerify.API.IntegrationTests.Fixtures;
using CVerify.API.IntegrationTests.Helpers;
using Xunit;

namespace CVerify.API.IntegrationTests.Auth;

public class AuthOutboxTests : BaseIntegrationTest
{
    public AuthOutboxTests(SharedTestcontainerFixture containerFixture) : base(containerFixture)
    {
    }

    [Fact]
    public async Task Outbox_Should_Be_Atomic_With_Database_Transaction()
    {
        // Try registering a user, but trigger a validation or registration failure
        // We will pass an empty Email which causes validation to fail.
        var request = new RegisterRequest(
            Email: "", // Invalid email
            Password: "SecurePassword123!",
            ConfirmPassword: "SecurePassword123!",
            FullName: "Failed User"
        );

        var response = await Client.PostAsJsonAsync("/api/auth/register", request);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // Ensure NO outbox messages were committed
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var outboxMessages = await db.OutboxMessages.ToListAsync();
        outboxMessages.Should().BeEmpty();
    }
}
