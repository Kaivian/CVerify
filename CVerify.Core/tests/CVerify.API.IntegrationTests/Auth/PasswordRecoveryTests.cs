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
using CVerify.API.Application.Exceptions;
using CVerify.API.Application.Interfaces;
using CVerify.API.Core.Entities;
using CVerify.API.Core.Enums;
using CVerify.API.Infrastructure.Persistence;
using CVerify.API.IntegrationTests.Fixtures;
using CVerify.API.IntegrationTests.Helpers;
using Xunit;

namespace CVerify.API.IntegrationTests.Auth;

public class PasswordRecoveryTests : BaseIntegrationTest
{
    public PasswordRecoveryTests(SharedTestcontainerFixture containerFixture) : base(containerFixture)
    {
    }

    private async Task<Guid> CreateActiveUserAsync(string email, string password)
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
            .WithPassword(password)
            .WithStatus(UserStatus.ACTIVE)
            .WithRole(userRole)
            .Build();

        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user.Id;
    }

    private async Task AuthenticateUserAsync(string email, string password)
    {
        var loginRequest = new LoginRequest(Email: email, Password: password);
        var loginResponse = await Client.PostAsJsonAsync("/api/auth/login", loginRequest);
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var setCookieHeaders = loginResponse.Headers.GetValues("Set-Cookie").ToList();
        var accessTokenCookie = setCookieHeaders.First(c => c.StartsWith("access_token"));
        var accessToken = accessTokenCookie.Split(';')[0];
        
        Client.DefaultRequestHeaders.Remove("Cookie");
        Client.DefaultRequestHeaders.Add("Cookie", accessToken);
    }

    [Fact]
    public async Task SendOtp_Should_Create_Verification_And_Send_Email()
    {
        var email = $"recovery_{Guid.NewGuid()}@cverify.ai";
        await CreateActiveUserAsync(email, "Password123!");
        await AuthenticateUserAsync(email, "Password123!");

        EmailSender.Clear();

        var response = await Client.PostAsync("/api/auth/password-recovery/send-otp", null);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        json.GetProperty("success").GetBoolean().Should().BeTrue();

        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var verification = await db.OtpVerifications.FirstOrDefaultAsync(v => v.Email == email && v.Purpose == "PASSWORD_RECOVERY");
        verification.Should().NotBeNull();
        verification!.Status.Should().Be(OtpSessionStatus.ACTIVE);

        await ProcessOutboxMessagesAsync();

        EmailSender.SentMessages.Should().ContainSingle();
        var emailMsg = EmailSender.SentMessages.First();
        emailMsg.ToEmail.Should().Be(email);
        emailMsg.Subject.Should().Be("Password Recovery Verification - CVerify");
        emailMsg.PlainTextContent.Should().Contain("your CVerify verification code is:");
    }

    [Fact]
    public async Task VerifyOtp_With_Invalid_Code_Should_Return_BadRequest()
    {
        var email = $"recovery_{Guid.NewGuid()}@cverify.ai";
        await CreateActiveUserAsync(email, "Password123!");
        await AuthenticateUserAsync(email, "Password123!");

        var sendResponse = await Client.PostAsync("/api/auth/password-recovery/send-otp", null);
        sendResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var verifyRequest = new VerifyRecoveryOtpRequest(Otp: "000000");
        var verifyResponse = await Client.PostAsJsonAsync("/api/auth/password-recovery/verify-otp", verifyRequest);
        verifyResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var problem = await verifyResponse.Content.ReadFromJsonAsync<Microsoft.AspNetCore.Mvc.ProblemDetails>();
        problem.Should().NotBeNull();
        problem!.Extensions["code"]!.ToString().Should().Be(AuthErrorCodes.InvalidCredentials);
    }

    [Fact]
    public async Task VerifyOtp_With_Three_Invalid_Codes_Should_Lockout_And_Invalidate_Challenge()
    {
        var email = $"recovery_{Guid.NewGuid()}@cverify.ai";
        await CreateActiveUserAsync(email, "Password123!");
        await AuthenticateUserAsync(email, "Password123!");

        var sendResponse = await Client.PostAsync("/api/auth/password-recovery/send-otp", null);
        sendResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var verifyRequest = new VerifyRecoveryOtpRequest(Otp: "000000");

        // Attempt 1
        var res1 = await Client.PostAsJsonAsync("/api/auth/password-recovery/verify-otp", verifyRequest);
        res1.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // Attempt 2
        var res2 = await Client.PostAsJsonAsync("/api/auth/password-recovery/verify-otp", verifyRequest);
        res2.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // Attempt 3: Lockout
        var res3 = await Client.PostAsJsonAsync("/api/auth/password-recovery/verify-otp", verifyRequest);
        res3.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var problem = await res3.Content.ReadFromJsonAsync<Microsoft.AspNetCore.Mvc.ProblemDetails>();
        problem.Should().NotBeNull();
        problem!.Extensions["code"]!.ToString().Should().Be(AuthErrorCodes.SuspiciousActivity);

        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var verification = await db.OtpVerifications.FirstOrDefaultAsync(v => v.Email == email && v.Purpose == "PASSWORD_RECOVERY");
        verification.Should().NotBeNull();
        verification!.Status.Should().Be(OtpSessionStatus.LOCKED);
    }

    [Fact]
    public async Task ChangePassword_With_Valid_Flow_Should_Update_Password_Successfully()
    {
        var email = $"recovery_{Guid.NewGuid()}@cverify.ai";
        var userId = await CreateActiveUserAsync(email, "Password123!");
        await AuthenticateUserAsync(email, "Password123!");

        EmailSender.Clear();

        // 1. Send OTP
        var sendResponse = await Client.PostAsync("/api/auth/password-recovery/send-otp", null);
        sendResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // Process Outbox message
        await ProcessOutboxMessagesAsync();

        // 2. Parse OTP from SentMessages
        EmailSender.SentMessages.Should().ContainSingle();
        var emailMsg = EmailSender.SentMessages.First();
        var parts = emailMsg.PlainTextContent.Split(':');
        var otpCode = parts.Last().Trim();
        otpCode.Length.Should().Be(6);

        // 3. Verify OTP
        var verifyRequest = new VerifyRecoveryOtpRequest(Otp: otpCode);
        var verifyResponse = await Client.PostAsJsonAsync("/api/auth/password-recovery/verify-otp", verifyRequest);
        verifyResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var verifyData = await verifyResponse.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        verifyData.GetProperty("success").GetBoolean().Should().BeTrue();
        string recoveryToken = verifyData.GetProperty("recoveryToken").GetString()!;
        recoveryToken.Should().NotBeNullOrEmpty();

        // 4. Change Password
        var newPassword = "NewSecurePassword123!";
        var changeRequest = new ChangePasswordViaRecoveryRequest(
            recoveryToken: recoveryToken,
            newPassword: newPassword,
            confirmPassword: newPassword
        );

        var changeResponse = await Client.PostAsJsonAsync("/api/auth/password-recovery/change-password", changeRequest);
        changeResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify password hash in DB
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId);
        user.Should().NotBeNull();
        BCrypt.Net.BCrypt.Verify(newPassword, user!.PasswordHash).Should().BeTrue();

        // Verify challenge status is invalidated
        var verification = await db.OtpVerifications.FirstOrDefaultAsync(v => v.Email == email && v.Purpose == "PASSWORD_RECOVERY");
        verification.Should().NotBeNull();
        verification!.Status.Should().Be(OtpSessionStatus.INVALIDATED);
    }

    private async Task ProcessOutboxMessagesAsync()
    {
        using var scope = Factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var emailService = scope.ServiceProvider.GetRequiredService<IEmailService>();
        var timeProvider = scope.ServiceProvider.GetRequiredService<TimeProvider>();

        var pending = await context.OutboxMessages.Where(m => m.ProcessedAt == null).ToListAsync();
        foreach (var message in pending)
        {
            if (message.Type == "EmailOtpVerification")
            {
                var payload = System.Text.Json.JsonSerializer.Deserialize<OtpVerificationPayloadTemp>(message.Payload);
                if (payload != null)
                {
                    await emailService.SendOtpEmailAsync(
                        payload.Email,
                        "Candidate User",
                        payload.Otp,
                        payload.Template,
                        default);
                }
            }
            message.ProcessedAt = timeProvider.GetUtcNow();
        }
        await context.SaveChangesAsync();
    }

    private class OtpVerificationPayloadTemp
    {
        public string Email { get; set; } = null!;
        public string Otp { get; set; } = null!;
        public string ChallengeId { get; set; } = null!;
        public string Purpose { get; set; } = null!;
        public string? Template { get; set; }
    }
}
