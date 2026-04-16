using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using FluentAssertions;
using Xunit;
using CVerify.API.IntegrationTests.Fixtures;
using CVerify.API.IntegrationTests.Helpers;
using CVerify.API.Modules.Auth.DTOs;
using CVerify.API.Modules.Profiles.DTOs;
using CVerify.API.Modules.Profiles.Entities;
using CVerify.API.Modules.Recovery.DTOs;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Exceptions;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.IntegrationTests.Auth;

public class ProductionEnforcementTests : BaseIntegrationTest
{
    private readonly SharedTestcontainerFixture _containerFixture;

    public ProductionEnforcementTests(SharedTestcontainerFixture containerFixture) 
        : base(containerFixture, new Dictionary<string, string> { { "DISABLE_RATE_LIMITS", "false" } })
    {
        _containerFixture = containerFixture;
    }

    public class CacheSpyTracker
    {
        public List<(string Key, object Value, TimeSpan? Expiration)> SetCalls { get; } = new();
    }

    public class CacheServiceSpy : ICacheService
    {
        private readonly ICacheService _inner;
        private readonly CacheSpyTracker _tracker;

        public CacheServiceSpy(ICacheService inner, CacheSpyTracker tracker)
        {
            _inner = inner;
            _tracker = tracker;
        }

        public Task<T?> GetAsync<T>(string key) => _inner.GetAsync<T>(key);

        public Task SetAsync<T>(string key, T value, TimeSpan? expiration = null)
        {
            _tracker.SetCalls.Add((key, value!, expiration));
            return _inner.SetAsync(key, value, expiration);
        }

        public Task RemoveAsync(string key) => _inner.RemoveAsync(key);
        public Task<bool> ExistsAsync(string key) => _inner.ExistsAsync(key);
        public Task AddToSetAsync(string key, string value) => _inner.AddToSetAsync(key, value);
        public Task<IEnumerable<string>> GetSetAsync(string key) => _inner.GetSetAsync(key);
        public Task RemoveFromSetAsync(string key, string value) => _inner.RemoveFromSetAsync(key, value);
        public Task<bool> AcquireLockAsync(string key, string value, TimeSpan expiry) => _inner.AcquireLockAsync(key, value, expiry);
        public Task<bool> ReleaseLockAsync(string key, string value) => _inner.ReleaseLockAsync(key, value);
    }

    private async Task<Guid> CreateActiveUserAsync(string email, string? username = null)
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
            .WithPassword("SecurePassword123!")
            .WithStatus(UserStatus.ACTIVE)
            .WithRole(userRole)
            .Build();

        if (username != null)
        {
            user.Username = username;
        }

        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user.Id;
    }

    private async Task<Organization> SeedLevel2OrganizationAsync(string taxCode, string companyName)
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var org = new Organization
        {
            TaxCode = taxCode,
            Name = companyName,
            Email = $"info@{taxCode}.com",
            Username = $"org-{taxCode}",
            Status = "active",
            VerificationLevel = 2,
            IsVerified = true,
            RepresentativeName = "Original Representative",
            RepresentativeEmail = "original@representative.com",
            RepresentativePhone = "+84900000001",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.Organizations.Add(org);
        await db.SaveChangesAsync();
        return org;
    }

    [Fact]
    public async Task ForgotPassword_EnforcesCooldown_And_WritesToRedis()
    {
        var email = $"forgot_prod_{Guid.NewGuid()}@cverify.ai";
        await CreateActiveUserAsync(email);

        var spyTracker = new CacheSpyTracker();
        var customizedFactory = Factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.AddSingleton(spyTracker);
                var realDescriptor = services.FirstOrDefault(d => d.ServiceType == typeof(ICacheService));
                if (realDescriptor != null)
                {
                    services.Remove(realDescriptor);
                    services.AddScoped<CacheService>();
                    services.AddScoped<ICacheService>(provider => 
                        new CacheServiceSpy(
                            provider.GetRequiredService<CacheService>(),
                            provider.GetRequiredService<CacheSpyTracker>()));
                }
            });
        });

        var client = customizedFactory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        var request = new ForgotPasswordRequest(Email: email);
        
        // Request 1: OK
        var response1 = await client.PostAsJsonAsync("/api/auth/forgot-password", request);
        response1.StatusCode.Should().Be(HttpStatusCode.OK);

        // Request 2: Cooldown block
        var response2 = await client.PostAsJsonAsync("/api/auth/forgot-password", request);
        response2.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var problem = await response2.Content.ReadFromJsonAsync<Microsoft.AspNetCore.Mvc.ProblemDetails>();
        problem.Should().NotBeNull();
        problem!.Extensions["code"]!.ToString().Should().Be(AuthErrorCodes.CooldownActive);

        // Verify SetAsync was called with positive expiration
        var cooldownCall = spyTracker.SetCalls
            .FirstOrDefault(call => call.Key.Contains("cooldown:forgot-password") || call.Key.Contains("cooldown:candidate-forgot-password"));

        cooldownCall.Should().NotBeNull();
        cooldownCall.Expiration.Should().NotBeNull();
        cooldownCall.Expiration.Value.TotalMinutes.Should().Be(1.0);
    }

    [Fact]
    public async Task ResendVerificationEmail_EnforcesCooldown_And_WritesToRedis()
    {
        var email = $"resend_prod_{Guid.NewGuid()}@cverify.ai";
        
        // Create user with EMAIL_VERIFY_PENDING status
        using (var scope = Factory.Services.CreateScope())
        {
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
                .WithStatus(UserStatus.EMAIL_VERIFY_PENDING)
                .WithRole(userRole)
                .Build();
            db.Users.Add(user);
            await db.SaveChangesAsync();
        }

        var spyTracker = new CacheSpyTracker();
        var customizedFactory = Factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.AddSingleton(spyTracker);
                var realDescriptor = services.FirstOrDefault(d => d.ServiceType == typeof(ICacheService));
                if (realDescriptor != null)
                {
                    services.Remove(realDescriptor);
                    services.AddScoped<CacheService>();
                    services.AddScoped<ICacheService>(provider => 
                        new CacheServiceSpy(
                            provider.GetRequiredService<CacheService>(),
                            provider.GetRequiredService<CacheSpyTracker>()));
                }
            });
        });

        var client = customizedFactory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        var request = new ResendVerificationRequest(Email: email);
        
        // Request 1: OK
        var response1 = await client.PostAsJsonAsync("/api/auth/resend-verification", request);
        response1.StatusCode.Should().Be(HttpStatusCode.OK);

        // Request 2: Cooldown block
        var response2 = await client.PostAsJsonAsync("/api/auth/resend-verification", request);
        response2.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var problem = await response2.Content.ReadFromJsonAsync<Microsoft.AspNetCore.Mvc.ProblemDetails>();
        problem.Should().NotBeNull();
        problem!.Extensions["code"]!.ToString().Should().Be(AuthErrorCodes.CooldownActive);

        // Verify SetAsync was called with positive expiration
        var cooldownCall = spyTracker.SetCalls
            .FirstOrDefault(call => call.Key.Contains("cooldown:verify-email"));

        cooldownCall.Should().NotBeNull();
        cooldownCall.Expiration.Should().NotBeNull();
        cooldownCall.Expiration.Value.TotalSeconds.Should().Be(60.0);
    }

    [Fact]
    public async Task LoginFailedAttempts_EnforcesAccountLockout()
    {
        var email = $"login_enforced_{Guid.NewGuid()}@cverify.ai";
        await CreateActiveUserAsync(email);

        var loginRequest = new LoginRequest(Email: email, Password: "WrongPassword!");

        // Execute 5 failed login attempts
        for (int i = 0; i < 5; i++)
        {
            var response = await Client.PostAsJsonAsync("/api/auth/login", loginRequest);
            response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        }

        // 6th attempt should return Forbidden (403) due to lockout
        var response6 = await Client.PostAsJsonAsync("/api/auth/login", loginRequest);
        response6.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        var responseBody = await response6.Content.ReadAsStringAsync();
        responseBody.Should().Contain("locked");

        // Verify user is locked in database
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email);
            user.Should().NotBeNull();
            user!.LockUntil.Should().NotBeNull();
            user.LockUntil.Value.Should().BeAfter(DateTimeOffset.UtcNow);
        }
    }

    [Fact]
    public async Task UsernameChange_EnforcesCooldown()
    {
        var email = $"username_prod_{Guid.NewGuid()}@cverify.ai";
        var username = "produser" + Guid.NewGuid().ToString("N").Substring(0, 8);
        var userId = await CreateActiveUserAsync(email, username);

        // Auto-provision profile
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var profile = new UserProfile
            {
                UserId = userId,
                Username = username,
                ProfileVisibility = "public",
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            db.UserProfiles.Add(profile);
            await db.SaveChangesAsync();
        }

        // Login to get access token cookie
        var loginRequest = new LoginRequest(Email: email, Password: "SecurePassword123!");
        var loginResponse = await Client.PostAsJsonAsync("/api/auth/login", loginRequest);
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var setCookie = loginResponse.Headers.GetValues("Set-Cookie").First(c => c.StartsWith("access_token"));
        var cookieVal = setCookie.Split(';')[0];
        
        var requestClient = Factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });
        requestClient.DefaultRequestHeaders.Add("Cookie", cookieVal);

        // Update username 1: Succeeds
        var newUsername1 = username + "1";
        var response1 = await requestClient.PutAsJsonAsync("/api/v1/users/profile/username", new UpdateUsernameRequest(newUsername1));
        response1.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Update username 2 immediately: Fails with BadRequest (400)
        var newUsername2 = username + "2";
        var response2 = await requestClient.PutAsJsonAsync("/api/v1/users/profile/username", new UpdateUsernameRequest(newUsername2));
        response2.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var responseBody = await response2.Content.ReadAsStringAsync();
        responseBody.Should().Contain("You can only change your username once every 30 days");
    }

    [Fact]
    public async Task RepresentativeRotation_EnforcesCooldown()
    {
        var taxCode = "5432109876";
        await SeedLevel2OrganizationAsync(taxCode, "Enforced Cooldown Org");

        var rotationRequest = new RepresentativeRotationRequestDto(
            TaxCode: taxCode,
            NewRepresentativeFullName: "New Nominee 1",
            NewRepresentativePosition: "Director",
            NewRepresentativeEmail: "nominee1@cooldown.com",
            NewRepresentativePhone: "+84905111222",
            ReasonForRepresentativeChange: "reason 1",
            OptionalSupportingMessage: "Enforce test 1."
        );

        // Send first rotation request: Succeeds
        var response1 = await Client.PostAsJsonAsync("/api/auth/recovery/level2/request-rotation", rotationRequest);
        response1.StatusCode.Should().Be(HttpStatusCode.OK);

        var rotationRequest2 = rotationRequest with
        {
            NewRepresentativeFullName = "New Nominee 2",
            NewRepresentativeEmail = "nominee2@cooldown.com"
        };

        // Send second rotation request immediately: Fails with BadRequest (400)
        var response2 = await Client.PostAsJsonAsync("/api/auth/recovery/level2/request-rotation", rotationRequest2);
        response2.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var responseBody = await response2.Content.ReadAsStringAsync();
        responseBody.Should().Contain("rotation request has already been initiated");
    }

    [Fact]
    public void Startup_ThrowsException_If_DisableRateLimits_In_Production()
    {
        var overrides = new Dictionary<string, string>
        {
            { "DISABLE_RATE_LIMITS", "true" },
            { "ASPNETCORE_ENVIRONMENT", "Production" }
        };

        // Instantiating the factory and building the host should throw InvalidOperationException
        var factory = new IntegrationTestApplicationFactory(_containerFixture, overrides);
        
        var exception = Assert.Throws<InvalidOperationException>(() => factory.CreateClient());
        exception.Message.Should().Contain("Fatal: Rate limits cannot be disabled in the Production environment.");
    }
}
