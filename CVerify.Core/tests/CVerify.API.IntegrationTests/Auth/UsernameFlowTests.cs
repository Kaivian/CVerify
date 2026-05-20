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
using CVerify.API.Modules.Profiles.DTOs;
using CVerify.API.Modules.Profiles.Entities;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Persistence;

namespace CVerify.API.IntegrationTests.Auth;

public class UsernameFlowTests : BaseIntegrationTest
{
    public UsernameFlowTests(SharedTestcontainerFixture containerFixture) : base(containerFixture)
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
                Description = "Basic application access",
                IsSystem = true,
                IsActive = true
            });
            await db.SaveChangesAsync();
        }
    }

    [Fact]
    public async Task Registration_ShouldGenerateUniqueUsername_WithSequentialSuffixOnCollision()
    {
        await SeedDefaultRolesAsync();

        // 1. First user registration
        var registerRequest1 = new RegisterRequest(
            Email: "john.doe@example.com",
            Password: "SecurePassword123!",
            ConfirmPassword: "SecurePassword123!",
            FullName: "John Doe"
        );

        var response1 = await Client.PostAsJsonAsync("/api/auth/register", registerRequest1);
        response1.StatusCode.Should().Be(HttpStatusCode.OK);
        var data1 = await response1.Content.ReadFromJsonAsync<RegisterResponse>();
        data1.Should().NotBeNull();
        data1!.StatusCode.Should().Be("REGISTRATION_SUCCESS");

        // Verify username in database
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user1 = await db.Users.FirstOrDefaultAsync(u => u.Email == "john.doe@example.com");
            user1.Should().NotBeNull();
            user1!.Username.Should().Be("john.doe");
        }

        // 2. Second user registration with colliding local-part
        var registerRequest2 = new RegisterRequest(
            Email: "john.doe@gmail.com",
            Password: "SecurePassword123!",
            ConfirmPassword: "SecurePassword123!",
            FullName: "John Doe Two"
        );

        var response2 = await Client.PostAsJsonAsync("/api/auth/register", registerRequest2);
        response2.StatusCode.Should().Be(HttpStatusCode.OK);
        var data2 = await response2.Content.ReadFromJsonAsync<RegisterResponse>();
        data2.Should().NotBeNull();
        data2!.StatusCode.Should().Be("REGISTRATION_SUCCESS");

        // Verify suffix collision username in database
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user2 = await db.Users.FirstOrDefaultAsync(u => u.Email == "john.doe@gmail.com");
            user2.Should().NotBeNull();
            user2!.Username.Should().Be("john.doe1");
        }
    }

    [Fact]
    public async Task PublicProfileApi_ShouldReturnProfile_OnlyWhenPublic()
    {
        await SeedDefaultRolesAsync();

        var userId = Guid.CreateVersion7();
        var username = "testuser" + Guid.NewGuid().ToString("N").Substring(0, 8);

        // 1. Seed user and profile
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var role = await db.Roles.FirstAsync(r => r.Name == "USER");
            var user = new User
            {
                Id = userId,
                Email = $"{username}@example.com",
                FullName = "Test User",
                Username = username,
                Status = UserStatus.ACTIVE,
                Roles = new[] { role }
            };
            db.Users.Add(user);

            var profile = new UserProfile
            {
                UserId = userId,
                Username = username,
                ProfileVisibility = "public",
                Headline = "Software Engineer",
                Bio = "Hello world!",
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            db.UserProfiles.Add(profile);
            await db.SaveChangesAsync();
        }

        // 2. Query public profile endpoint anonymously
        var publicResponse = await Client.GetAsync($"/api/v1/users/profile/public/{username}");
        var body = await publicResponse.Content.ReadAsStringAsync();
        publicResponse.StatusCode.Should().Be(HttpStatusCode.OK, because: $"Response body: {body}");
        var publicProfile = await publicResponse.Content.ReadFromJsonAsync<PublicProfileResponse>();
        publicProfile.Should().NotBeNull();
        publicProfile!.Username.Should().Be(username);
        publicProfile.Headline.Should().Be("Software Engineer");

        // 3. Update visibility to private
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var profile = await db.UserProfiles.FirstAsync(p => p.UserId == userId);
            profile.ProfileVisibility = "private";
            await db.SaveChangesAsync();
        }

        // 4. Query again - should return 404
        var privateResponse = await Client.GetAsync($"/api/v1/users/profile/public/{username}");
        privateResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task PublicProfileApi_ShouldGateScoreAndBadges_WhenNoCompletedAssessment()
    {
        await SeedDefaultRolesAsync();

        var userId = Guid.CreateVersion7();
        var username = "scoreuser" + Guid.NewGuid().ToString("N").Substring(0, 8);

        // 1. Seed user and profile
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var role = await db.Roles.FirstAsync(r => r.Name == "USER");
            var user = new User
            {
                Id = userId,
                Email = $"{username}@example.com",
                FullName = "Score User",
                Username = username,
                Status = UserStatus.ACTIVE,
                Roles = new[] { role }
            };
            db.Users.Add(user);

            var profile = new UserProfile
            {
                UserId = userId,
                Username = username,
                ProfileVisibility = "public",
                Headline = "Software Architect",
                Bio = "Self evaluation.",
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            db.UserProfiles.Add(profile);
            await db.SaveChangesAsync();
        }

        // 2. Query public profile endpoint anonymously when NO completed assessment exists
        var publicResponse1 = await Client.GetAsync($"/api/v1/users/profile/public/{username}");
        publicResponse1.StatusCode.Should().Be(HttpStatusCode.OK);
        var publicProfile1 = await publicResponse1.Content.ReadFromJsonAsync<PublicProfileResponse>();
        publicProfile1.Should().NotBeNull();
        publicProfile1!.HasCompletedAssessment.Should().BeFalse();
        publicProfile1.LastAssessmentDate.Should().BeNull();
        publicProfile1.TrustScore.Should().BeNull();

        // 3. Seed a completed CandidateAssessment
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var assessment = new CandidateAssessment
            {
                Id = Guid.CreateVersion7(),
                UserId = userId,
                Status = "Completed",
                OverallScore = 85.0,
                CreatedAtUtc = DateTimeOffset.UtcNow.AddMinutes(-5),
                CompletedAtUtc = DateTimeOffset.UtcNow,
                LastProfileUpdateAt = DateTimeOffset.UtcNow,
                LastRepositoryAnalysisAt = DateTimeOffset.UtcNow,
                PipelineVersion = "2.1.0",
                AssessmentSchemaVersion = "1.1.0"
            };
            db.CandidateAssessments.Add(assessment);
            await db.SaveChangesAsync();
        }

        // 4. Query again - should return assessment info and overall score as TrustScore
        var publicResponse2 = await Client.GetAsync($"/api/v1/users/profile/public/{username}");
        publicResponse2.StatusCode.Should().Be(HttpStatusCode.OK);
        var publicProfile2 = await publicResponse2.Content.ReadFromJsonAsync<PublicProfileResponse>();
        publicProfile2.Should().NotBeNull();
        publicProfile2!.HasCompletedAssessment.Should().BeTrue();
        publicProfile2.LastAssessmentDate.Should().NotBeNull();
        publicProfile2.TrustScore.Should().Be(85.0);
    }
}
