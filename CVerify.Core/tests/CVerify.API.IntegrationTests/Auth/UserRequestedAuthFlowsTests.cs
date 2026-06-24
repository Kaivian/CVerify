using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using FluentAssertions;
using Xunit;
using Moq;
using CVerify.API.IntegrationTests.Fixtures;
using CVerify.API.IntegrationTests.Helpers;
using CVerify.API.Modules.Auth.DTOs;
using CVerify.API.Modules.Auth.Entities;
using CVerify.API.Modules.Auth.Enums;
using CVerify.API.Modules.Auth.Services;
using CVerify.API.Modules.Auth.Services.OtpPolicies;
using CVerify.API.Modules.Recovery.DTOs;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Exceptions;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Security;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.IntegrationTests.Auth;

[Collection("Shared Containers Collection")]
public class UserRequestedAuthFlowsTests : BaseIntegrationTest
{
    private readonly WebApplicationFactory<Program> _customFactory;
    private readonly HttpClient _client;

    public UserRequestedAuthFlowsTests(SharedTestcontainerFixture containerFixture) : base(containerFixture)
    {
        // Mutate the DI-registered EnvConfiguration singleton to set DisableRateLimits = false
        // to override the process-wide .env file override (DISABLE_RATE_LIMITS=true)
        _customFactory = Factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                var descriptor = services.FirstOrDefault(d => d.ServiceType == typeof(EnvConfiguration));
                if (descriptor != null)
                {
                    EnvConfiguration originalConfig;
                    if (descriptor.ImplementationInstance is EnvConfiguration instance)
                    {
                        originalConfig = instance;
                    }
                    else
                    {
                        using var tempProvider = services.BuildServiceProvider();
                        originalConfig = tempProvider.GetRequiredService<EnvConfiguration>();
                    }

                    originalConfig.Security.DisableRateLimits = false;

                    services.Replace(ServiceDescriptor.Singleton<EnvConfiguration>(originalConfig));
                }
            });
        });

        _client = _customFactory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });
    }

    private async Task SeedDefaultRolesAsync()
    {
        using var scope = _customFactory.Services.CreateScope();
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
        }

        var adminRole = await db.Roles.FirstOrDefaultAsync(r => r.Name == "SUPER_ADMIN");
        if (adminRole == null)
        {
            db.Roles.Add(new Role
            {
                Name = "SUPER_ADMIN",
                DisplayName = "System Administrator",
                Description = "Root access to all modules",
                IsSystem = true,
                IsActive = true
            });
        }

        await db.SaveChangesAsync();
    }

    private async Task<Guid> CreateUserWithStatusAsync(string email, string password, UserStatus status)
    {
        await SeedDefaultRolesAsync();
        using var scope = _customFactory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var userRole = await db.Roles.FirstAsync(r => r.Name == "USER");
        var user = new UserBuilder()
            .WithEmail(email)
            .WithPassword(password)
            .WithStatus(status)
            .WithRole(userRole)
            .Build();

        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user.Id;
    }

    private HttpClient CreateClientWithMockGoogleValidator(string subject, string email, bool emailVerified = true)
    {
        var mockValidator = new Mock<IGoogleTokenValidator>();
        mockValidator.Setup(v => v.ValidateAsync(It.IsAny<string>(), It.IsAny<Google.Apis.Auth.GoogleJsonWebSignature.ValidationSettings>()))
            .ReturnsAsync(new Google.Apis.Auth.GoogleJsonWebSignature.Payload
            {
                Subject = subject,
                Email = email,
                EmailVerified = emailVerified,
                Name = "Google Test User",
                Picture = "http://avatar.url"
            });

        var customFactory = _customFactory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.Replace(ServiceDescriptor.Scoped<IGoogleTokenValidator>(_ => mockValidator.Object));
            });
        });

        return customFactory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });
    }

    private HttpClient CreateClientWithFailingGoogleValidator()
    {
        var mockValidator = new Mock<IGoogleTokenValidator>();
        mockValidator.Setup(v => v.ValidateAsync(It.IsAny<string>(), It.IsAny<Google.Apis.Auth.GoogleJsonWebSignature.ValidationSettings>()))
            .ReturnsAsync((Google.Apis.Auth.GoogleJsonWebSignature.Payload)null);

        var customFactory = _customFactory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.Replace(ServiceDescriptor.Scoped<IGoogleTokenValidator>(_ => mockValidator.Object));
            });
        });

        return customFactory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });
    }

    // ==========================================
    // GOOGLE LOGIN TESTS (AUTH-001 - AUTH-004)
    // ==========================================

    [Fact]
    public async Task AUTH_001_Login_Via_Google_Success()
    {
        var email = $"google_success_{Guid.NewGuid()}@cverify.ai";
        var subject = $"sub_{Guid.NewGuid()}";

        // Seed user as Active in DB
        await CreateUserWithStatusAsync(email, "Password123!", UserStatus.ACTIVE);

        // Setup Provider manually in DB so the account is already registered with Google
        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstAsync(u => u.Email == email);
            db.AuthProviders.Add(new AuthProvider
            {
                Id = Guid.CreateVersion7(),
                UserId = user.Id,
                ProviderName = "Google",
                ProviderKey = subject,
                ProviderAccountId = email,
                CreatedAt = DateTimeOffset.UtcNow
            });
            await db.SaveChangesAsync();
        }

        var client = CreateClientWithMockGoogleValidator(subject, email);
        var response = await client.PostAsJsonAsync("/api/auth/google", new GoogleLoginRequest(IdToken: "valid-token"));

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var cookies = response.Headers.GetValues("Set-Cookie").ToList();
        cookies.Any(c => c.StartsWith("access_token")).Should().BeTrue();
    }

    [Fact]
    public async Task AUTH_002_Login_Via_Google_Invalid_Token_Fails()
    {
        var client = CreateClientWithFailingGoogleValidator();
        var response = await client.PostAsJsonAsync("/api/auth/google", new GoogleLoginRequest(IdToken: "invalid-token"));

        // CVerify maps UnauthorizedAccessException during google validation to HTTP 403 Forbidden
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task AUTH_003_Login_Via_Google_New_Account_Auto_Creates_And_Verifies()
    {
        var email = $"google_new_{Guid.NewGuid()}@cverify.ai";
        var subject = $"sub_{Guid.NewGuid()}";

        var client = CreateClientWithMockGoogleValidator(subject, email);
        var response = await client.PostAsJsonAsync("/api/auth/google", new GoogleLoginRequest(IdToken: "valid-token"));

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        using var scope = _customFactory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email);

        user.Should().NotBeNull();
        user!.Status.Should().Be(UserStatus.ACTIVE);
        user.EmailVerifiedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task AUTH_004_Login_Via_Google_Banned_Account_Fails()
    {
        var email = $"google_banned_{Guid.NewGuid()}@cverify.ai";
        var subject = $"sub_{Guid.NewGuid()}";

        var userId = await CreateUserWithStatusAsync(email, "Password123!", UserStatus.BANNED);

        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.AuthProviders.Add(new AuthProvider
            {
                Id = Guid.CreateVersion7(),
                UserId = userId,
                ProviderName = "Google",
                ProviderKey = subject,
                ProviderAccountId = email,
                CreatedAt = DateTimeOffset.UtcNow
            });
            await db.SaveChangesAsync();
        }

        var client = CreateClientWithMockGoogleValidator(subject, email);
        var response = await client.PostAsJsonAsync("/api/auth/google", new GoogleLoginRequest(IdToken: "valid-token"));

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ==========================================
    // EMAIL/PASSWORD LOGIN TESTS (AUTH-005 - AUTH-010)
    // ==========================================

    [Fact]
    public async Task AUTH_005_Login_EmailPassword_Success()
    {
        var email = $"traditional_{Guid.NewGuid()}@cverify.ai";
        await CreateUserWithStatusAsync(email, "Password123!", UserStatus.ACTIVE);

        var response = await _client.PostAsJsonAsync("/api/auth/login", new LoginRequest(Email: email, Password: "Password123!"));
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var cookies = response.Headers.GetValues("Set-Cookie").ToList();
        cookies.Any(c => c.StartsWith("access_token")).Should().BeTrue();
    }

    [Fact]
    public async Task AUTH_006_Login_EmailPassword_Wrong_Password_Increments_FailedAttempts()
    {
        var email = $"wrong_pass_{Guid.NewGuid()}@cverify.ai";
        var userId = await CreateUserWithStatusAsync(email, "Password123!", UserStatus.ACTIVE);

        var response = await _client.PostAsJsonAsync("/api/auth/login", new LoginRequest(Email: email, Password: "WrongPassword!"));
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        using var scope = _customFactory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.FindAsync(userId);
        user!.FailedAttempts.Should().Be(1);
    }

    [Fact]
    public async Task AUTH_007_Login_EmailPassword_Lockout_After_5_Attempts()
    {
        var email = $"lockout_{Guid.NewGuid()}@cverify.ai";
        var userId = await CreateUserWithStatusAsync(email, "Password123!", UserStatus.ACTIVE);

        for (int i = 0; i < 4; i++)
        {
            var res = await _client.PostAsJsonAsync("/api/auth/login", new LoginRequest(Email: email, Password: "WrongPassword!"));
            res.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        }

        // 5th attempt locks the account
        var response = await _client.PostAsJsonAsync("/api/auth/login", new LoginRequest(Email: email, Password: "WrongPassword!"));
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        using var scope = _customFactory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.FindAsync(userId);
        user!.LockUntil.Should().NotBeNull();
        user.LockUntil.Value.Should().BeAfter(DateTimeOffset.UtcNow);
    }

    [Fact]
    public async Task AUTH_008_Login_EmailPassword_Unverified_Email_Returns_VerifyEmailAction()
    {
        var email = $"unverified_{Guid.NewGuid()}@cverify.ai";
        await CreateUserWithStatusAsync(email, "Password123!", UserStatus.EMAIL_VERIFY_PENDING);

        var response = await _client.PostAsJsonAsync("/api/auth/login", new LoginRequest(Email: email, Password: "Password123!"));

        // CVerify permits unverified users to start login, returning 200 OK with redirection/nextStep metadata
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        body.GetProperty("isEmailVerified").GetBoolean().Should().BeFalse();
        body.GetProperty("status").GetString().Should().Be("EMAIL_VERIFY_PENDING");
        body.GetProperty("nextStep").GetString().Should().Be("VERIFY_EMAIL");
    }

    [Fact]
    public async Task AUTH_009_Login_EmailPassword_Account_Currently_Locked_Fails()
    {
        var email = $"currently_locked_{Guid.NewGuid()}@cverify.ai";
        var userId = await CreateUserWithStatusAsync(email, "Password123!", UserStatus.ACTIVE);

        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FindAsync(userId);
            user!.LockUntil = DateTimeOffset.UtcNow.AddMinutes(15);
            await db.SaveChangesAsync();
        }

        var response = await _client.PostAsJsonAsync("/api/auth/login", new LoginRequest(Email: email, Password: "Password123!"));

        // CVerify maps lock errors to HTTP 403 Forbidden via UnauthorizedAccessException
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task AUTH_010_Login_EmailPassword_NonExistent_Email_Fails_Idempotently()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/login", new LoginRequest(Email: "doesnotexist@cverify.ai", Password: "AnyPassword123!"));
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ==========================================
    // OTP TESTS (AUTH-011 - AUTH-015)
    // ==========================================

    [Fact]
    public async Task AUTH_011_VerifyOtp_Success()
    {
        var email = $"otp_{Guid.NewGuid()}@cverify.ai";
        await CreateUserWithStatusAsync(email, "Password123!", UserStatus.ACTIVE);

        // Register & authenticate
        var loginResponse = await _client.PostAsJsonAsync("/api/auth/login", new LoginRequest(Email: email, Password: "Password123!"));
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var setCookie = loginResponse.Headers.GetValues("Set-Cookie").First(c => c.StartsWith("access_token"));
        var accessToken = setCookie.Split(';')[0];

        var client = _customFactory.CreateClient();
        client.DefaultRequestHeaders.Add("Cookie", accessToken);

        var sendRes = await client.PostAsync("/api/auth/password-recovery/send-otp", null);
        sendRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // Get the OTP from mock Outbox/Database
        using var scope = _customFactory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var outboxMessage = await db.OutboxMessages.FirstAsync(m => m.Type == "EmailOtpVerification" && m.Payload.Contains(email));
        var payloadDict = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(outboxMessage.Payload);
        var plainOtp = payloadDict!["Otp"].ToString();

        // Verify OTP
        var verifyResponse = await client.PostAsJsonAsync("/api/auth/password-recovery/verify-otp", new VerifyRecoveryOtpRequest(Otp: plainOtp!));
        verifyResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var verifyData = await verifyResponse.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        verifyData.GetProperty("success").GetBoolean().Should().BeTrue();
        verifyData.GetProperty("recoveryToken").GetString().Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task AUTH_012_VerifyOtp_Three_Invalid_Attempts_Locks_Session()
    {
        var email = $"otp_lock_{Guid.NewGuid()}@cverify.ai";
        await CreateUserWithStatusAsync(email, "Password123!", UserStatus.ACTIVE);

        var loginResponse = await _client.PostAsJsonAsync("/api/auth/login", new LoginRequest(Email: email, Password: "Password123!"));
        var setCookie = loginResponse.Headers.GetValues("Set-Cookie").First(c => c.StartsWith("access_token"));
        var accessToken = setCookie.Split(';')[0];

        var client = _customFactory.CreateClient();
        client.DefaultRequestHeaders.Add("Cookie", accessToken);

        await client.PostAsync("/api/auth/password-recovery/send-otp", null);

        // 3 failed attempts
        var wrongOtpReq = new VerifyRecoveryOtpRequest(Otp: "000000");
        for (int i = 0; i < 3; i++)
        {
            var res = await client.PostAsJsonAsync("/api/auth/password-recovery/verify-otp", wrongOtpReq);
            res.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        }

        using var scope = _customFactory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var verification = await db.OtpVerifications.FirstAsync(v => v.Email == email && v.Purpose == "PASSWORD_RECOVERY");
        verification.Status.Should().Be(OtpSessionStatus.LOCKED);
    }

    [Fact]
    public async Task AUTH_013_VerifyOtp_Expired_Fails()
    {
        var email = $"otp_expired_{Guid.NewGuid()}@cverify.ai";
        await CreateUserWithStatusAsync(email, "Password123!", UserStatus.ACTIVE);

        var loginResponse = await _client.PostAsJsonAsync("/api/auth/login", new LoginRequest(Email: email, Password: "Password123!"));
        var setCookie = loginResponse.Headers.GetValues("Set-Cookie").First(c => c.StartsWith("access_token"));
        var accessToken = setCookie.Split(';')[0];

        var client = _customFactory.CreateClient();
        client.DefaultRequestHeaders.Add("Cookie", accessToken);

        await client.PostAsync("/api/auth/password-recovery/send-otp", null);

        // Manually expire in DB
        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var verification = await db.OtpVerifications.FirstAsync(v => v.Email == email && v.Purpose == "PASSWORD_RECOVERY");
            verification.ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(-1);
            await db.SaveChangesAsync();
        }

        var wrongOtpReq = new VerifyRecoveryOtpRequest(Otp: "000000");
        var res = await client.PostAsJsonAsync("/api/auth/password-recovery/verify-otp", wrongOtpReq);
        res.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task AUTH_014_VerifyOtp_Resend_Cooldown_Enforced()
    {
        var email = $"otp_cooldown_{Guid.NewGuid()}@cverify.ai";
        await CreateUserWithStatusAsync(email, "Password123!", UserStatus.ACTIVE);

        var otpReq = new SendOtpRequest(Email: email, Purpose: "PASSWORD_RECOVERY");

        // 1st request
        var sendRes1 = await _client.PostAsJsonAsync("/api/auth/send-otp", otpReq);
        sendRes1.StatusCode.Should().Be(HttpStatusCode.OK);

        // 2nd immediate request triggers cooldown error
        var sendRes2 = await _client.PostAsJsonAsync("/api/auth/send-otp", otpReq);
        sendRes2.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var problem = await sendRes2.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        problem.GetProperty("code").GetString().Should().Be(AuthErrorCodes.CooldownActive);
    }

    [Fact]
    public async Task AUTH_015_VerifyOtp_Resend_Max_Limits_Invalidates_Session()
    {
        var email = $"otp_maxresends_{Guid.NewGuid()}@cverify.ai";
        await CreateUserWithStatusAsync(email, "Password123!", UserStatus.ACTIVE);

        var otpReq = new SendOtpRequest(Email: email, Purpose: "PASSWORD_RECOVERY");

        // 1st send
        await _client.PostAsJsonAsync("/api/auth/send-otp", otpReq);

        // Manually manipulate the DB verification resend count to 5 to trigger db-level TooManyResends
        // This avoids triggering the general Redis Email Rate Limiter which enforces 5 max calls in 15 minutes globally
        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var verification = await db.OtpVerifications.FirstAsync(v => v.Email == email && v.Purpose == "PASSWORD_RECOVERY");
            verification.ResendCount = 5;
            verification.CooldownUntil = DateTimeOffset.UtcNow.AddSeconds(-1); // bypass cooldown
            await db.SaveChangesAsync();
        }

        var resBlock = await _client.PostAsJsonAsync("/api/auth/send-otp", otpReq);

        resBlock.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var json = await resBlock.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        json.GetProperty("code").GetString().Should().Be(AuthErrorCodes.TooManyResends);
    }

    // ==========================================
    // FORGOT PASSWORD TESTS (AUTH-016 - AUTH-021)
    // ==========================================

    [Fact]
    public async Task AUTH_016_ForgotPassword_Success()
    {
        var email = $"forgot_pass_{Guid.NewGuid()}@cverify.ai";
        await CreateUserWithStatusAsync(email, "Password123!", UserStatus.ACTIVE);

        var response = await _client.PostAsJsonAsync("/api/auth/forgot-password", new ForgotPasswordRequest(Email: email));
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task AUTH_017_ForgotPassword_NonExistent_Email_Idempotent()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/forgot-password", new ForgotPasswordRequest(Email: "not_registered@cverify.ai"));
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task AUTH_018_ResetPassword_Success()
    {
        var email = $"reset_pass_{Guid.NewGuid()}@cverify.ai";
        var userId = await CreateUserWithStatusAsync(email, "Password123!", UserStatus.ACTIVE);

        // Generate and Hash Token using TokenBuilder
        var tokenVal = "reset_token_auth018";
        var tokenEntity = new TokenBuilder()
            .ForUser(userId)
            .WithToken(tokenVal)
            .BuildResetPasswordToken();

        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.ResetPasswordTokens.Add(tokenEntity);
            await db.SaveChangesAsync();
        }

        var response = await _client.PostAsJsonAsync("/api/auth/reset-password", new ResetPasswordRequest(
            Token: tokenVal,
            Password: "NewSecurePassword123!",
            ConfirmPassword: "NewSecurePassword123!"
        ));

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        using var scope2 = _customFactory.Services.CreateScope();
        var db2 = scope2.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db2.Users.FindAsync(userId);
        BCrypt.Net.BCrypt.Verify("NewSecurePassword123!", user!.PasswordHash).Should().BeTrue();
    }

    [Fact]
    public async Task AUTH_019_ResetPassword_Weak_Password_Fails()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/reset-password", new ResetPasswordRequest(
            Token: "dummy_token",
            Password: "123",
            ConfirmPassword: "123"
        ));
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task AUTH_020_ResetPassword_No_Special_Characters_Fails()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/reset-password", new ResetPasswordRequest(
            Token: "dummy_token",
            Password: "Password123",
            ConfirmPassword: "Password123"
        ));
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task AUTH_021_ResetPassword_Consumed_Token_Fails()
    {
        var email = $"reset_consumed_{Guid.NewGuid()}@cverify.ai";
        var userId = await CreateUserWithStatusAsync(email, "Password123!", UserStatus.ACTIVE);

        var tokenVal = "reset_token_auth021";
        var tokenEntity = new TokenBuilder()
            .ForUser(userId)
            .WithToken(tokenVal)
            .BuildResetPasswordToken();
        tokenEntity.ConsumedAt = DateTimeOffset.UtcNow; // Mark as consumed

        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.ResetPasswordTokens.Add(tokenEntity);
            await db.SaveChangesAsync();
        }

        var response = await _client.PostAsJsonAsync("/api/auth/reset-password", new ResetPasswordRequest(
            Token: tokenVal,
            Password: "NewSecurePassword123!",
            ConfirmPassword: "NewSecurePassword123!"
        ));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ==========================================
    // CHANGE PASSWORD TESTS (AUTH-022 - AUTH-024)
    // ==========================================

    [Fact]
    public async Task AUTH_022_ChangePassword_Success()
    {
        var email = $"change_pass_{Guid.NewGuid()}@cverify.ai";
        await CreateUserWithStatusAsync(email, "Password123!", UserStatus.ACTIVE);

        var loginResponse = await _client.PostAsJsonAsync("/api/auth/login", new LoginRequest(Email: email, Password: "Password123!"));
        var setCookie = loginResponse.Headers.GetValues("Set-Cookie").First(c => c.StartsWith("access_token"));
        var accessToken = setCookie.Split(';')[0];

        var client = _customFactory.CreateClient();
        client.DefaultRequestHeaders.Add("Cookie", accessToken);

        var response = await client.PostAsJsonAsync("/api/auth/change-password", new ChangePasswordRequest(
            currentPassword: "Password123!",
            newPassword: "NewSecurePassword123!",
            confirmNewPassword: "NewSecurePassword123!"
        ));

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task AUTH_023_ChangePassword_Invalid_Current_Password_Fails()
    {
        var email = $"change_invalid_{Guid.NewGuid()}@cverify.ai";
        await CreateUserWithStatusAsync(email, "Password123!", UserStatus.ACTIVE);

        var loginResponse = await _client.PostAsJsonAsync("/api/auth/login", new LoginRequest(Email: email, Password: "Password123!"));
        var setCookie = loginResponse.Headers.GetValues("Set-Cookie").First(c => c.StartsWith("access_token"));
        var accessToken = setCookie.Split(';')[0];

        var client = _customFactory.CreateClient();
        client.DefaultRequestHeaders.Add("Cookie", accessToken);

        var response = await client.PostAsJsonAsync("/api/auth/change-password", new ChangePasswordRequest(
            currentPassword: "WrongPassword!",
            newPassword: "NewSecurePassword123!",
            confirmNewPassword: "NewSecurePassword123!"
        ));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task AUTH_024_ChangePassword_Mismatched_ConfirmPassword_Fails()
    {
        var email = $"change_mismatch_{Guid.NewGuid()}@cverify.ai";
        await CreateUserWithStatusAsync(email, "Password123!", UserStatus.ACTIVE);

        var loginResponse = await _client.PostAsJsonAsync("/api/auth/login", new LoginRequest(Email: email, Password: "Password123!"));
        var setCookie = loginResponse.Headers.GetValues("Set-Cookie").First(c => c.StartsWith("access_token"));
        var accessToken = setCookie.Split(';')[0];

        var client = _customFactory.CreateClient();
        client.DefaultRequestHeaders.Add("Cookie", accessToken);

        var response = await client.PostAsJsonAsync("/api/auth/change-password", new ChangePasswordRequest(
            currentPassword: "Password123!",
            newPassword: "NewSecurePassword123!",
            confirmNewPassword: "DifferentPassword123!"
        ));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ==========================================
    // LOGOUT TESTS (AUTH-025 - AUTH-026)
    // ==========================================

    [Fact]
    public async Task AUTH_025_Logout_Success()
    {
        var email = $"logout_{Guid.NewGuid()}@cverify.ai";
        await CreateUserWithStatusAsync(email, "Password123!", UserStatus.ACTIVE);

        var loginResponse = await _client.PostAsJsonAsync("/api/auth/login", new LoginRequest(Email: email, Password: "Password123!"));
        var setCookie = loginResponse.Headers.GetValues("Set-Cookie").First(c => c.StartsWith("access_token"));
        var accessToken = setCookie.Split(';')[0];

        var client = _customFactory.CreateClient();
        client.DefaultRequestHeaders.Add("Cookie", accessToken);

        var logoutResponse = await client.PostAsync("/api/auth/logout", null);
        logoutResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var cookies = logoutResponse.Headers.GetValues("Set-Cookie").ToList();
        cookies.Any(c => c.Contains("access_token=;") || c.Contains("access_token= ")).Should().BeTrue();
    }

    [Fact]
    public async Task AUTH_026_Logout_Refresh_Token_Revoked_Fails()
    {
        var email = $"logout_refresh_{Guid.NewGuid()}@cverify.ai";
        await CreateUserWithStatusAsync(email, "Password123!", UserStatus.ACTIVE);

        var loginResponse = await _client.PostAsJsonAsync("/api/auth/login", new LoginRequest(Email: email, Password: "Password123!"));
        var cookies = loginResponse.Headers.GetValues("Set-Cookie").ToList();

        // Cleanly extract name=value for both cookies
        var accessTokenCookie = cookies.First(c => c.StartsWith("access_token")).Split(';')[0];
        var refreshTokenCookie = cookies.First(c => c.StartsWith("refresh_token")).Split(';')[0];

        var client = _customFactory.CreateClient();
        client.DefaultRequestHeaders.Add("Cookie", $"{accessTokenCookie}; {refreshTokenCookie}");

        // Logout
        var logoutResponse = await client.PostAsync("/api/auth/logout", null);
        logoutResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // Manually adjust the RevokedAt in the database to be in the past to bypass the 10-second concurrency grace period
        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var tokenStr = Uri.UnescapeDataString(refreshTokenCookie.Split('=')[1]);
            var token = await db.RefreshTokens.FirstOrDefaultAsync(t => t.Token == tokenStr);
            if (token != null)
            {
                token.RevokedAt = DateTimeOffset.UtcNow.AddSeconds(-15);
                await db.SaveChangesAsync();
            }
        }

        // Remove old Cookie header and construct a new one containing ONLY the logged out refresh token
        client.DefaultRequestHeaders.Remove("Cookie");
        client.DefaultRequestHeaders.Add("Cookie", refreshTokenCookie);

        // Attempt to refresh token using the logged out/revoked refresh token
        var refreshResponse = await client.PostAsync("/api/auth/refresh-token", null);
        refreshResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
