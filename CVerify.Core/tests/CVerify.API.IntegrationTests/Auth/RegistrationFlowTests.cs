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
using CVerify.API.Modules.Auth.Entities;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Exceptions;
using CVerify.API.Modules.Shared.Exceptions.Catalogs;
using CVerify.API.Modules.Shared.Persistence;

namespace CVerify.API.IntegrationTests.Auth;

public class RegistrationFlowTests : BaseIntegrationTest
{
    public RegistrationFlowTests(SharedTestcontainerFixture containerFixture) : base(containerFixture)
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
    public async Task Register_With_Valid_Inputs_Should_Return_Success()
    {
        await SeedDefaultRolesAsync();

        var request = new RegisterRequest(
            Email: "valid@cverify.ai",
            Password: "SecurePassword123!",
            ConfirmPassword: "SecurePassword123!",
            FullName: "Valid User"
        );

        var response = await Client.PostAsJsonAsync("/api/auth/register", request);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var data = await response.Content.ReadFromJsonAsync<RegisterResponse>();
        data.Should().NotBeNull();
        data!.StatusCode.Should().Be("REGISTRATION_SUCCESS");
    }

    [Fact]
    public async Task Register_With_Duplicate_Email_Active_Should_Return_Conflict()
    {
        await SeedDefaultRolesAsync();

        var userRequest = new RegisterRequest(
            Email: "valid_active@cverify.ai",
            Password: "SecurePassword123!",
            ConfirmPassword: "SecurePassword123!",
            FullName: "Valid User"
        );

        await Client.PostAsJsonAsync("/api/auth/register", userRequest);

        // Manually activate user
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == "valid_active@cverify.ai");
            user!.Status = UserStatus.ACTIVE;
            await db.SaveChangesAsync();
        }

        // Try to register same email again
        var response2 = await Client.PostAsJsonAsync("/api/auth/register", userRequest).ConfigureAwait(false);
        response2.StatusCode.Should().Be(HttpStatusCode.Conflict);

        var problem = await response2.Content.ReadFromJsonAsync<Microsoft.AspNetCore.Mvc.ProblemDetails>().ConfigureAwait(false);
        problem.Should().NotBeNull();
        problem!.Extensions.Should().ContainKey("code");
        problem.Extensions["code"]!.ToString().Should().Be(AuthErrorCodes.EmailAlreadyExists);
    }

    [Fact]
    public async Task Register_With_Duplicate_Email_Pending_Should_Resend_Verification()
    {
        await SeedDefaultRolesAsync();

        var userRequest = new RegisterRequest(
            Email: "valid_pending@cverify.ai",
            Password: "SecurePassword123!",
            ConfirmPassword: "SecurePassword123!",
            FullName: "Valid User"
        );

        await Client.PostAsJsonAsync("/api/auth/register", userRequest);

        // Try to register same email again without activating
        var response2 = await Client.PostAsJsonAsync("/api/auth/register", userRequest).ConfigureAwait(false);
        response2.StatusCode.Should().Be(HttpStatusCode.OK);

        var data2 = await response2.Content.ReadFromJsonAsync<RegisterResponse>().ConfigureAwait(false);
        data2.Should().NotBeNull();
        data2!.StatusCode.Should().Be("REGISTRATION_PENDING_VERIFY");
        data2.UiAction.Should().Be("SHOW_WARNING_TOAST");
    }

    [Fact]
    public async Task Register_With_Weak_Password_Should_Return_BadRequest()
    {
        await SeedDefaultRolesAsync();

        var request = new RegisterRequest(
            Email: "weak@cverify.ai",
            Password: "123",
            ConfirmPassword: "123",
            FullName: "Weak User"
        );

        var response = await Client.PostAsJsonAsync("/api/auth/register", request);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Register_With_Mismatched_ConfirmPassword_Should_Return_BadRequest()
    {
        await SeedDefaultRolesAsync();

        var request = new RegisterRequest(
            Email: "mismatch@cverify.ai",
            Password: "SecurePassword123!",
            ConfirmPassword: "DifferentPassword123!",
            FullName: "Mismatch User"
        );

        var response = await Client.PostAsJsonAsync("/api/auth/register", request);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Register_Should_Normalize_Email()
    {
        await SeedDefaultRolesAsync();

        var request = new RegisterRequest(
            Email: "  NoRmAlIzE@cVeRiFy.aI   ",
            Password: "SecurePassword123!",
            ConfirmPassword: "SecurePassword123!",
            FullName: "Normalized User"
        );

        var response = await Client.PostAsJsonAsync("/api/auth/register", request);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == "normalize@cverify.ai");
        user.Should().NotBeNull();
    }

    [Fact]
    public async Task CreatePassword_WithoutFullName_ShouldResolveNameFromEmail()
    {
        await SeedDefaultRolesAsync();

        var challengeId = Guid.CreateVersion7();
        var plainOtp = "123456";
        var key = "super_secret_key_super_secret_key_super_secret_key_32_characters";
        var hmac = new System.Security.Cryptography.HMACSHA256(System.Text.Encoding.UTF8.GetBytes(key));
        var hashBytes = hmac.ComputeHash(System.Text.Encoding.UTF8.GetBytes(plainOtp));
        var otpHash = Convert.ToHexString(hashBytes).ToLowerInvariant();

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.OtpVerifications.Add(new OtpVerification
            {
                ChallengeId = challengeId,
                Email = "luc.fr.test+123@cverify.ai",
                OtpHash = otpHash,
                Purpose = "Authentication",
                ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(5)
            });
            await db.SaveChangesAsync();
        }

        var verifyOtpRequest = new VerifyOtpRequest(
            ChallengeId: challengeId,
            Email: "luc.fr.test+123@cverify.ai",
            Code: "123456",
            Purpose: "Authentication"
        );

        var verifyResponse = await Client.PostAsJsonAsync("/api/auth/verify-otp", verifyOtpRequest);
        verifyResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var verifyData = await verifyResponse.Content.ReadFromJsonAsync<VerifyOtpResponse>();
        verifyData.Should().NotBeNull();
        var verificationToken = verifyData!.VerificationToken;

        var createPasswordRequest = new CreatePasswordRequest
        {
            ChallengeId = challengeId,
            Email = "luc.fr.test+123@cverify.ai",
            VerificationToken = verificationToken,
            Password = "SecurePassword123!",
            ConfirmPassword = "SecurePassword123!",
            FullName = null
        };

        var createResponse = await Client.PostAsJsonAsync("/api/auth/create-password", createPasswordRequest);
        createResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == "luc.fr.test+123@cverify.ai");
            user.Should().NotBeNull();
            user!.FullName.Should().Be("Luc Fr Test");
        }
    }

    [Fact]
    public async Task CreatePassword_WhenUserAlreadyExists_ShouldSetPasswordHash()
    {
        await SeedDefaultRolesAsync();

        var challengeId = Guid.CreateVersion7();
        var plainOtp = "123456";
        var key = "super_secret_key_super_secret_key_super_secret_key_32_characters";
        var hmac = new System.Security.Cryptography.HMACSHA256(System.Text.Encoding.UTF8.GetBytes(key));
        var hashBytes = hmac.ComputeHash(System.Text.Encoding.UTF8.GetBytes(plainOtp));
        var otpHash = Convert.ToHexString(hashBytes).ToLowerInvariant();

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            
            // Seed existing user with NULL password hash
            var userRole = await db.Roles.FirstAsync(r => r.Name == "USER");
            db.Users.Add(new User
            {
                Email = "existing@cverify.ai",
                Username = "existing_user",
                FullName = "Existing User",
                PasswordHash = null,
                Status = UserStatus.EMAIL_VERIFY_PENDING,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                Roles = new List<Role> { userRole }
            });

            db.OtpVerifications.Add(new OtpVerification
            {
                ChallengeId = challengeId,
                Email = "existing@cverify.ai",
                OtpHash = otpHash,
                Purpose = "Authentication",
                ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(5)
            });
            await db.SaveChangesAsync();
        }

        var verifyOtpRequest = new VerifyOtpRequest(
            ChallengeId: challengeId,
            Email: "existing@cverify.ai",
            Code: "123456",
            Purpose: "Authentication"
        );

        var verifyResponse = await Client.PostAsJsonAsync("/api/auth/verify-otp", verifyOtpRequest);
        verifyResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var verifyData = await verifyResponse.Content.ReadFromJsonAsync<VerifyOtpResponse>();
        verifyData.Should().NotBeNull();
        var verificationToken = verifyData!.VerificationToken;

        var createPasswordRequest = new CreatePasswordRequest
        {
            ChallengeId = challengeId,
            Email = "existing@cverify.ai",
            VerificationToken = verificationToken,
            Password = "NewSecurePassword123!",
            ConfirmPassword = "NewSecurePassword123!",
            FullName = "Updated Existing User"
        };

        var createResponse = await Client.PostAsJsonAsync("/api/auth/create-password", createPasswordRequest);
        createResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == "existing@cverify.ai");
            user.Should().NotBeNull();
            user!.PasswordHash.Should().NotBeNullOrEmpty();
            user.FullName.Should().Be("Updated Existing User");
            BCrypt.Net.BCrypt.Verify("NewSecurePassword123!", user.PasswordHash).Should().BeTrue();
        }
    }

    [Theory]
    [InlineData("theluc.1746@gmail.com")]
    [InlineData("theluc+work@gmail.com")]
    [InlineData("the-luc@gmail.com")]
    [InlineData("the_luc@gmail.com")]
    public async Task Register_With_Special_Email_Characters_Should_Preserve_Email_Exactly(string email)
    {
        await SeedDefaultRolesAsync();

        var request = new RegisterRequest(
            Email: email,
            Password: "SecurePassword123!",
            ConfirmPassword: "SecurePassword123!",
            FullName: "Special Email User"
        );

        var response = await Client.PostAsJsonAsync("/api/auth/register", request);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email.Trim().ToLowerInvariant());
        user.Should().NotBeNull();
        user!.Email.Should().Be(email.Trim().ToLowerInvariant());
    }

    [Fact]
    public async Task Login_With_Gmail_Containing_Dot_Should_Fallback_To_Legacy_Normalized_Email()
    {
        await SeedDefaultRolesAsync();

        var legacyEmail = "theluc1746@gmail.com";
        var passwordHash = BCrypt.Net.BCrypt.HashPassword("SecurePassword123!");
        
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var userRole = await db.Roles.FirstAsync(r => r.Name == "USER");
            db.Users.Add(new User
            {
                Email = legacyEmail,
                Username = "theluc1746",
                FullName = "Legacy User",
                PasswordHash = passwordHash,
                Status = UserStatus.ACTIVE,
                EmailVerifiedAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                Roles = new List<Role> { userRole }
            });
            await db.SaveChangesAsync();
        }

        var loginRequest = new LoginRequest(
            Email: "theluc.1746@gmail.com",
            Password: "SecurePassword123!"
        );

        var response = await Client.PostAsJsonAsync("/api/auth/login", loginRequest);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var data = await response.Content.ReadFromJsonAsync<AuthResponse>();
        data.Should().NotBeNull();
        data!.Email.Should().Be(legacyEmail);
    }
}
