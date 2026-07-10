
using System;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using FluentAssertions;
using Xunit;
using CVerify.API.IntegrationTests.Fixtures;
using CVerify.API.IntegrationTests.Helpers;
using CVerify.API.Modules.Auth.DTOs;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Email.Services;
using CVerify.API.Modules.Shared.Exceptions;
using CVerify.API.Modules.Shared.Persistence;

namespace CVerify.API.IntegrationTests.Auth;

/// <summary>
/// Executes complete end-to-end integration tests for user registration, email verification, 
/// forgot password, reset password, soft deletion, and security auditing.
/// </summary>
public class AuthFlowsApiTests : BaseIntegrationTest
{
    public AuthFlowsApiTests(SharedTestcontainerFixture containerFixture) : base(containerFixture)
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

    [Fact]
    public async Task E2E_Auth_And_Deletion_Lifecycle_Should_Succeed()
    {
        // Seed default roles first
        await SeedDefaultRolesAsync();

        // =========================================================
        // E1-E2. REGISTER A NEW USER
        // =========================================================
        var registerRequest = new RegisterRequest(
            Email: "lifecycle@cverify.ai",
            Password: "SecurePassword123!",
            ConfirmPassword: "SecurePassword123!",
            FullName: "Luc Test User"
        );

        var registerResponse = await Client.PostAsJsonAsync("/api/auth/register", registerRequest);
        registerResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // =========================================================
        // E3-E4. VERIFY USER STATUS IN DATABASE & OUTBOX ENROLLMENT
        // =========================================================
        Guid userId;
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == "lifecycle@cverify.ai");
            user.Should().NotBeNull();
            userId = user!.Id;
            user.Status.Should().Be(UserStatus.EMAIL_VERIFY_PENDING);
            user.EmailVerifiedAt.Should().BeNull();

            // Verify OutboxMessage exists
            var outboxMessage = await db.OutboxMessages.FirstOrDefaultAsync(m => m.Type == "EmailVerification");
            outboxMessage.Should().NotBeNull();
            outboxMessage!.ProcessedAt.Should().BeNull();

            // Verify persistent security AuditLog
            var auditLog = await db.AuditLogs.FirstOrDefaultAsync(l => l.UserId == userId && l.EventType == "USER_REGISTERED");
            auditLog.Should().NotBeNull();
        }

        // Manually process outbox message to trigger immediate delivery
        await ProcessOutboxMessagesAsync();

        // =========================================================
        // E5. EXTRACT & VALIDATE BASE64URL-SAFE VERIFICATION LINK
        // =========================================================
        EmailSender.SentMessages.Should().ContainSingle();
        var verifyEmail = EmailSender.SentMessages.First();
        verifyEmail.ToEmail.Should().Be("lifecycle@cverify.ai");
        verifyEmail.HtmlContent.Should().Contain("verify-email?token=");

        var tokenPrefix = "verify-email?token=";
        var tokenStartIdx = verifyEmail.HtmlContent.IndexOf(tokenPrefix) + tokenPrefix.Length;
        var tokenLength = verifyEmail.HtmlContent.IndexOf("\"", tokenStartIdx) - tokenStartIdx;
        var plainVerifyToken = verifyEmail.HtmlContent.Substring(tokenStartIdx, tokenLength);
        plainVerifyToken.Should().NotBeNullOrWhiteSpace();

        // Verify base64url characters count safety
        plainVerifyToken.Any(c => c == '+' || c == '/' || c == '=').Should().BeFalse();

        EmailSender.Clear();

        // =========================================================
        // E6-E7. EMAIL VERIFICATION & ACTIVE TRANSITION
        // =========================================================
        var verifyRequest = new VerifyEmailRequest(Token: plainVerifyToken);
        var verifyResponse = await Client.PostAsJsonAsync("/api/auth/verify-email", verifyRequest);
        verifyResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId);
            user!.Status.Should().Be(UserStatus.ACTIVE);
            user.EmailVerifiedAt.Should().NotBeNull();

            var auditLog = await db.AuditLogs.FirstOrDefaultAsync(l => l.UserId == userId && l.EventType == "USER_EMAIL_VERIFIED");
            auditLog.Should().NotBeNull();
        }

        // Process WelcomeNotice onboarding email outbox and clear fake mail queue
        await ProcessOutboxMessagesAsync();
        EmailSender.Clear();

        // =========================================================
        // E8. LOGIN (SUCCESS) & COOKIE SETTINGS
        // =========================================================
        var loginRequest = new LoginRequest(Email: "lifecycle@cverify.ai", Password: "SecurePassword123!");
        var loginResponse = await Client.PostAsJsonAsync("/api/auth/login", loginRequest);
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var authData = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>();
        authData.Should().NotBeNull();
        authData!.Email.Should().Be("lifecycle@cverify.ai");

        // Verify HTTP cookies are set
        loginResponse.Headers.Contains("Set-Cookie").Should().BeTrue();
        var setCookieHeaders = loginResponse.Headers.GetValues("Set-Cookie").ToList();
        setCookieHeaders.Any(c => c.Contains("access_token") && c.Contains("httponly", StringComparison.OrdinalIgnoreCase)).Should().BeTrue();
        setCookieHeaders.Any(c => c.Contains("refresh_token") && c.Contains("httponly", StringComparison.OrdinalIgnoreCase)).Should().BeTrue();

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var activeSession = await db.RefreshTokens.FirstOrDefaultAsync(t => t.UserId == userId && t.RevokedAt == null);
            activeSession.Should().NotBeNull();

            var auditLog = await db.AuditLogs.FirstOrDefaultAsync(l => l.UserId == userId && l.EventType == "USER_LOGIN_SUCCESS");
            auditLog.Should().NotBeNull();
        }

        // =========================================================
        // E9. FORGOT PASSWORD & COOLDOWN
        // =========================================================
        var forgotRequest = new ForgotPasswordRequest(Email: "lifecycle@cverify.ai");
        var forgotResponse = await Client.PostAsJsonAsync("/api/auth/forgot-password", forgotRequest);
        forgotResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // Manually process recovery outbox message
        await ProcessOutboxMessagesAsync();
        EmailSender.SentMessages.Should().ContainSingle();
        var resetEmail = EmailSender.SentMessages.First();
        resetEmail.HtmlContent.Should().Contain("reset-password?token=");

        // Extract reset token
        var resetPrefix = "reset-password?token=";
        var resetStartIdx = resetEmail.HtmlContent.IndexOf(resetPrefix) + resetPrefix.Length;
        var resetTokenLen = resetEmail.HtmlContent.IndexOf("\"", resetStartIdx) - resetStartIdx;
        var plainResetToken = resetEmail.HtmlContent.Substring(resetStartIdx, resetTokenLen);
        plainResetToken.Should().NotBeNullOrWhiteSpace();

        EmailSender.Clear();

        // =========================================================
        // E10. RESET PASSWORD & GLOBAL SESSION REVOCATION
        // =========================================================
        var resetRequest = new ResetPasswordRequest(
            Token: plainResetToken,
            Password: "NewSecurePassword456!",
            ConfirmPassword: "NewSecurePassword456!"
        );

        var resetResponse = await Client.PostAsJsonAsync("/api/auth/reset-password", resetRequest);
        resetResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId);
            BCrypt.Net.BCrypt.Verify("NewSecurePassword456!", user!.PasswordHash).Should().BeTrue();

            // Verify all refresh tokens are revoked except the newly issued auto-login token
            var activeTokensCount = await db.RefreshTokens.CountAsync(t => t.UserId == userId && t.RevokedAt == null);
            activeTokensCount.Should().Be(1);

            var auditLog = await db.AuditLogs.FirstOrDefaultAsync(l => l.UserId == userId && l.EventType == "USER_PASSWORD_RESET_SUCCESS");
            auditLog.Should().NotBeNull();
        }

        // =========================================================
        // E11-E13. ACCOUNT DELETION, COOKIE CLEARING, TOKENS DELETED, AUDIT
        // =========================================================
        // Log in again with new credentials to acquire fresh cookies
        var reLoginRequest = new LoginRequest(Email: "lifecycle@cverify.ai", Password: "NewSecurePassword456!");
        var reLoginResponse = await Client.PostAsJsonAsync("/api/auth/login", reLoginRequest);
        reLoginResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // Inject active access_token cookie to the outgoing client request
        var setCookie = reLoginResponse.Headers.GetValues("Set-Cookie").First(c => c.StartsWith("access_token"));
        var cookieVal = setCookie.Split(';')[0];
        Client.DefaultRequestHeaders.Add("Cookie", cookieVal);

        // Call protected DELETE endpoint
        var deleteResponse = await Client.DeleteAsync("/api/users/me");
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // Assert cookie clearing response headers
        var deleteCookies = deleteResponse.Headers.GetValues("Set-Cookie").ToList();
        deleteCookies.Any(c => c.Contains("access_token") && c.Contains("expires=")).Should().BeTrue();

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId);
            user!.DeletedAt.Should().NotBeNull();
            user.Status.Should().Be(UserStatus.DELETED);

            // Assert active refresh sessions, verification tokens, reset tokens are all deactivated/revoked
            var sessionsActive = await db.RefreshTokens.AnyAsync(t => t.UserId == userId && t.RevokedAt == null);
            sessionsActive.Should().BeFalse();

            var verificationsActive = await db.VerificationTokens.AnyAsync(t => t.UserId == userId && t.ConsumedAt == null);
            verificationsActive.Should().BeFalse();

            var resetsActive = await db.ResetPasswordTokens.AnyAsync(t => t.UserId == userId && t.ConsumedAt == null);
            resetsActive.Should().BeFalse();

            // Assert persistent security audit log of deletion
            var auditLog = await db.AuditLogs.FirstOrDefaultAsync(l => l.UserId == userId && l.EventType == "USER_DELETED");
            auditLog.Should().NotBeNull();
        }
    }

    [Fact]
    public async Task Register_With_Existing_Active_Email_Should_Fail()
    {
        // Seed default roles first
        await SeedDefaultRolesAsync();

        // 1. Setup an active user
        var userRequest = new RegisterRequest(
            Email: "duplicate@cverify.ai",
            Password: "SecurePassword123!",
            ConfirmPassword: "SecurePassword123!",
            FullName: "Original User"
        );

        var response1 = await Client.PostAsJsonAsync("/api/auth/register", userRequest);
        response1.StatusCode.Should().Be(HttpStatusCode.OK);

        // Activate the user manually in the DB
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == "duplicate@cverify.ai");
            user!.Status = UserStatus.ACTIVE;
            await db.SaveChangesAsync();
        }

        // 2. Try to register same email again
        var response2 = await Client.PostAsJsonAsync("/api/auth/register", userRequest);

        // Assert: Conflict (409) returned for active duplicates (hardened security)
        response2.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Verify_With_Invalid_Token_Should_Throw_Structured_Error()
    {
        var verifyRequest = new VerifyEmailRequest(Token: "completely_fake_token_value_abc");
        var response = await Client.PostAsJsonAsync("/api/auth/verify-email", verifyRequest);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var problem = await response.Content.ReadFromJsonAsync<Microsoft.AspNetCore.Mvc.ProblemDetails>();
        problem.Should().NotBeNull();
        problem!.Extensions.Should().ContainKey("code");
        problem.Extensions["code"]!.ToString().Should().Be(AuthErrorCodes.InvalidToken);
    }

    private async Task ProcessOutboxMessagesAsync()
    {
        using var scope = Factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var emailService = scope.ServiceProvider.GetRequiredService<IEmailService>();
        var timeProvider = scope.ServiceProvider.GetRequiredService<TimeProvider>();

        var pending = await context.OutboxMessages.Where(m => m.ProcessedAt == null).ToListAsync().ConfigureAwait(false);
        foreach (var message in pending)
        {
            if (message.Type == "EmailVerification")
            {
                var payload = System.Text.Json.JsonSerializer.Deserialize<VerificationPayloadTemp>(message.Payload);
                await emailService.SendVerificationEmailAsync(payload!.Email, payload.FullName, payload.Link).ConfigureAwait(false);
            }
            else if (message.Type == "PasswordReset")
            {
                var payload = System.Text.Json.JsonSerializer.Deserialize<ResetPayloadTemp>(message.Payload);
                await emailService.SendResetPasswordEmailAsync(payload!.Email, payload.FullName, payload.Link).ConfigureAwait(false);
            }
            else if (message.Type == "WelcomeNotice")
            {
                var payload = System.Text.Json.JsonSerializer.Deserialize<WelcomePayloadTemp>(message.Payload);
                await emailService.SendWelcomeEmailAsync(payload!.Email, payload.FullName).ConfigureAwait(false);
            }
            message.ProcessedAt = timeProvider.GetUtcNow();
        }
        await context.SaveChangesAsync().ConfigureAwait(false);
    }

    private class VerificationPayloadTemp
    {
        public string Email { get; set; } = null!;
        public string FullName { get; set; } = null!;
        public string Link { get; set; } = null!;
    }

    private class ResetPayloadTemp
    {
        public string Email { get; set; } = null!;
        public string FullName { get; set; } = null!;
        public string Link { get; set; } = null!;
    }

    private class WelcomePayloadTemp
    {
        public string Email { get; set; } = null!;
        public string FullName { get; set; } = null!;
    }
}
