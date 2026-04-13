using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using FluentAssertions;
using Moq;
using Xunit;
using CVerify.API.IntegrationTests.Fixtures;
using CVerify.API.IntegrationTests.Helpers;
using CVerify.API.Modules.Auth.DTOs;
using CVerify.API.Modules.Auth.Entities;
using CVerify.API.Modules.Auth.Services;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Email.Services;
using CVerify.API.Modules.Shared.Persistence;

namespace CVerify.API.IntegrationTests.Auth;

public class EmailManagementTests : BaseIntegrationTest
{
    public EmailManagementTests(SharedTestcontainerFixture containerFixture) : base(containerFixture)
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

    private async Task<string> RegisterAndLoginUserAsync(string email, string password)
    {
        await SeedDefaultRolesAsync().ConfigureAwait(false);

        // Register
        var registerRequest = new RegisterRequest(
            Email: email,
            Password: password,
            ConfirmPassword: password,
            FullName: "Test Linked Email User"
        );
        var regResponse = await Client.PostAsJsonAsync("/api/auth/register", registerRequest);
        regResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // Activate manually in DB
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email);
            user.Should().NotBeNull();
            user!.Status = UserStatus.ACTIVE;
            user.EmailVerifiedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync();
        }

        // Login
        var loginRequest = new LoginRequest(Email: email, Password: password);
        var loginResponse = await Client.PostAsJsonAsync("/api/auth/login", loginRequest);
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var setCookie = loginResponse.Headers.GetValues("Set-Cookie").First(c => c.StartsWith("access_token"));
        return setCookie.Split(';')[0];
    }

    [Fact]
    public async Task EmailManagement_Full_Lifecycle_Should_Succeed()
    {
        var primaryEmail = $"primary_{Guid.NewGuid()}@cverify.ai";
        var password = "SecurePassword123!";
        var cookieVal = await RegisterAndLoginUserAsync(primaryEmail, password);

        // Setup authenticated client
        var authClient = Factory.CreateClient();
        authClient.DefaultRequestHeaders.Add("Cookie", cookieVal);

        // 1. GET emails - should return only primary initially
        var getResponse1 = await authClient.GetAsync("/api/auth/emails");
        getResponse1.StatusCode.Should().Be(HttpStatusCode.OK);
        
        var emailsList1 = await getResponse1.Content.ReadFromJsonAsync<List<EmailItemTemp>>();
        emailsList1.Should().NotBeNull();
        emailsList1!.Count.Should().Be(1);
        emailsList1[0].Email.Should().Be(primaryEmail);
        emailsList1[0].IsPrimary.Should().BeTrue();
        emailsList1[0].IsVerified.Should().BeTrue();

        // 2. POST emails/send-otp - unique email should succeed
        var secondaryEmail = $"secondary_{Guid.NewGuid()}@cverify.ai";
        var sendOtpRequest = new { Email = secondaryEmail };
        var sendOtpResponse = await authClient.PostAsJsonAsync("/api/auth/emails/send-otp", sendOtpRequest);
        sendOtpResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var otpResult = await sendOtpResponse.Content.ReadFromJsonAsync<SendOtpResponse>();
        otpResult.Should().NotBeNull();
        otpResult!.ChallengeId.Should().NotBeEmpty();

        // Process Outbox message to dispatch the OTP email
        await ProcessOutboxMessagesAsync();

        // Extract OTP code from fake in-memory email sender
        EmailSender.SentMessages.Should().ContainSingle();
        var sentEmail = EmailSender.SentMessages.First();
        sentEmail.ToEmail.Should().Be(secondaryEmail);
        
        var otpCode = sentEmail.PlainTextContent.Split(':').Last().Trim();
        otpCode.Length.Should().Be(6);

        // 3. POST emails/verify-otp - should successfully link
        var verifyOtpRequest = new
        {
            Email = secondaryEmail,
            Code = otpCode,
            ChallengeId = otpResult.ChallengeId
        };
        var verifyResponse = await authClient.PostAsJsonAsync("/api/auth/emails/verify-otp", verifyOtpRequest);
        verifyResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // GET emails - should return primary and secondary
        var getResponse2 = await authClient.GetAsync("/api/auth/emails");
        getResponse2.StatusCode.Should().Be(HttpStatusCode.OK);
        
        var emailsList2 = await getResponse2.Content.ReadFromJsonAsync<List<EmailItemTemp>>();
        emailsList2.Should().NotBeNull();
        emailsList2!.Count.Should().Be(2);
        
        var linkedSecondary = emailsList2.FirstOrDefault(e => !e.IsPrimary);
        linkedSecondary.Should().NotBeNull();
        linkedSecondary!.Email.Should().Be(secondaryEmail);
        linkedSecondary.IsVerified.Should().BeTrue();

        // 4. POST emails/make-primary - should promote secondary
        var makePrimaryRequest = new { Email = secondaryEmail, Password = password };
        var makePrimaryResponse = await authClient.PostAsJsonAsync("/api/auth/emails/make-primary", makePrimaryRequest);
        makePrimaryResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // GET emails - secondary is now primary, primary is secondary
        var getResponse3 = await authClient.GetAsync("/api/auth/emails");
        getResponse3.StatusCode.Should().Be(HttpStatusCode.OK);
        
        var emailsList3 = await getResponse3.Content.ReadFromJsonAsync<List<EmailItemTemp>>();
        emailsList3!.Count.Should().Be(2);

        var newPrimary = emailsList3.First(e => e.IsPrimary);
        newPrimary.Email.Should().Be(secondaryEmail);

        var newSecondary = emailsList3.First(e => !e.IsPrimary);
        newSecondary.Email.Should().Be(primaryEmail);

        // 5. DELETE emails/{id} - should delete secondary
        var deleteResponse = await authClient.DeleteAsync($"/api/auth/emails/{newSecondary.Id}");
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // GET emails - should return only 1 primary email now
        var getResponse4 = await authClient.GetAsync("/api/auth/emails");
        getResponse4.StatusCode.Should().Be(HttpStatusCode.OK);
        
        var emailsList4 = await getResponse4.Content.ReadFromJsonAsync<List<EmailItemTemp>>();
        emailsList4!.Count.Should().Be(1);
        emailsList4[0].Email.Should().Be(secondaryEmail);
    }

    [Fact]
    public async Task EmailManagement_Link_Same_Email_Twice_Should_Fail_Global_Uniqueness()
    {
        var primaryEmail = $"primary_{Guid.NewGuid()}@cverify.ai";
        var password = "SecurePassword123!";
        var cookieVal = await RegisterAndLoginUserAsync(primaryEmail, password);

        var authClient = Factory.CreateClient();
        authClient.DefaultRequestHeaders.Add("Cookie", cookieVal);

        // Link primary email - should fail
        var sendOtpRequest = new { Email = primaryEmail };
        var sendOtpResponse = await authClient.PostAsJsonAsync("/api/auth/emails/send-otp", sendOtpRequest);
        sendOtpResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);
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

    [Fact]
    public async Task GoogleLogin_With_Verified_Secondary_Email_Should_Resolve_Correct_User()
    {
        var primaryEmail = $"primary_{Guid.NewGuid()}@cverify.ai";
        var secondaryEmail = $"secondary_{Guid.NewGuid()}@cverify.ai";
        var password = "SecurePassword123!";

        // 1. Register and verify user
        var cookieVal = await RegisterAndLoginUserAsync(primaryEmail, password);

        // 2. Link secondary email as verified
        var authClient = Factory.CreateClient();
        authClient.DefaultRequestHeaders.Add("Cookie", cookieVal);

        var sendOtpResponse = await authClient.PostAsJsonAsync("/api/auth/emails/send-otp", new { Email = secondaryEmail });
        sendOtpResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var otpResult = await sendOtpResponse.Content.ReadFromJsonAsync<SendOtpResponse>();
        await ProcessOutboxMessagesAsync();

        var sentEmail = EmailSender.SentMessages.First(m => m.ToEmail == secondaryEmail);
        var otpCode = sentEmail.PlainTextContent.Split(':').Last().Trim();

        var verifyResponse = await authClient.PostAsJsonAsync("/api/auth/emails/verify-otp", new
        {
            Email = secondaryEmail,
            Code = otpCode,
            ChallengeId = otpResult!.ChallengeId
        });
        verifyResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // 3. Setup mock google token validator returning the secondary email
        var googleSubject = $"google_sub_{Guid.NewGuid()}";
        var mockValidator = new Moq.Mock<IGoogleTokenValidator>();
        mockValidator.Setup(v => v.ValidateAsync(Moq.It.IsAny<string>(), Moq.It.IsAny<Google.Apis.Auth.GoogleJsonWebSignature.ValidationSettings>()))
            .ReturnsAsync(new Google.Apis.Auth.GoogleJsonWebSignature.Payload
            {
                Subject = googleSubject,
                Email = secondaryEmail,
                EmailVerified = true,
                Name = "Google Test User",
                Picture = "http://avatar.url"
            });

        var customFactory = Factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.Replace(ServiceDescriptor.Scoped<IGoogleTokenValidator>(_ => mockValidator.Object));
            });
        });
        var customClient = customFactory.CreateClient();

        // Clear password hash to allow auto-linking (simulates non-credential-secured profile)
        using (var initScope = customFactory.Services.CreateScope())
        {
            var initDb = initScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var dbUser = await initDb.Users.FirstOrDefaultAsync(u => u.Email == primaryEmail);
            dbUser.Should().NotBeNull();
            dbUser!.PasswordHash = null;
            await initDb.SaveChangesAsync();
        }

        // 4. Call google login API
        var googleLoginResponse = await customClient.PostAsJsonAsync("/api/auth/google", new GoogleLoginRequest(IdToken: "dummy-token"));
        googleLoginResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var authResponse = await googleLoginResponse.Content.ReadFromJsonAsync<AuthResponse>();
        authResponse.Should().NotBeNull();
        
        // Assert it resolved to the primary email
        authResponse!.Email.Should().Be(primaryEmail);

        // Verify the AuthProvider Google mapping was created in the DB
        using var scope = customFactory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var provider = await db.AuthProviders.FirstOrDefaultAsync(ap => ap.UserId == authResponse.Id && ap.ProviderName == "Google");
        provider.Should().NotBeNull();
        provider!.ProviderKey.Should().Be(googleSubject);
        provider.ProviderAccountId.Should().Be(secondaryEmail);
    }

    [Fact]
    public async Task GoogleLogin_Should_Update_ProviderAccountId_On_Email_Changes()
    {
        var primaryEmail = $"primary_{Guid.NewGuid()}@cverify.ai";
        var password = "SecurePassword123!";
        var cookieVal = await RegisterAndLoginUserAsync(primaryEmail, password);

        var googleSubject = $"google_sub_{Guid.NewGuid()}";
        var mockValidator = new Moq.Mock<IGoogleTokenValidator>();
        mockValidator.Setup(v => v.ValidateAsync(Moq.It.IsAny<string>(), Moq.It.IsAny<Google.Apis.Auth.GoogleJsonWebSignature.ValidationSettings>()))
            .ReturnsAsync(new Google.Apis.Auth.GoogleJsonWebSignature.Payload
            {
                Subject = googleSubject,
                Email = primaryEmail,
                EmailVerified = true,
                Name = "Google Test User",
                Picture = "http://avatar.url"
            });

        var customFactory = Factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.Replace(ServiceDescriptor.Scoped<IGoogleTokenValidator>(_ => mockValidator.Object));
            });
        });
        var customClient = customFactory.CreateClient();

        // Seed linked Google provider to simulate already connected account
        using (var initScope = customFactory.Services.CreateScope())
        {
            var initDb = initScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var dbUser = await initDb.Users.FirstOrDefaultAsync(u => u.Email == primaryEmail);
            dbUser.Should().NotBeNull();
            initDb.AuthProviders.Add(new AuthProvider
            {
                Id = Guid.CreateVersion7(),
                UserId = dbUser!.Id,
                ProviderName = "Google",
                ProviderKey = googleSubject,
                ProviderAccountId = primaryEmail,
                CreatedAt = DateTimeOffset.UtcNow
            });
            await initDb.SaveChangesAsync();
        }

        // First login: maps Google provider with primary email
        var login1 = await customClient.PostAsJsonAsync("/api/auth/google", new GoogleLoginRequest(IdToken: "dummy"));
        login1.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify provider exists in DB with primary email
        using (var scope = customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var provider = await db.AuthProviders.FirstOrDefaultAsync(ap => ap.ProviderKey == googleSubject);
            provider.Should().NotBeNull();
            provider!.ProviderAccountId.Should().Be(primaryEmail);
        }

        // Change the mock email payload for the same subject
        var updatedEmail = $"new_google_email_{Guid.NewGuid()}@cverify.ai";
        mockValidator.Setup(v => v.ValidateAsync(Moq.It.IsAny<string>(), Moq.It.IsAny<Google.Apis.Auth.GoogleJsonWebSignature.ValidationSettings>()))
            .ReturnsAsync(new Google.Apis.Auth.GoogleJsonWebSignature.Payload
            {
                Subject = googleSubject,
                Email = updatedEmail,
                EmailVerified = true,
                Name = "Google Test User",
                Picture = "http://avatar.url"
            });

        // Second login: should update provider account ID
        var login2 = await customClient.PostAsJsonAsync("/api/auth/google", new GoogleLoginRequest(IdToken: "dummy"));
        login2.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify updated in DB
        using (var scope = customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var provider = await db.AuthProviders.FirstOrDefaultAsync(ap => ap.ProviderKey == googleSubject);
            provider.Should().NotBeNull();
            provider!.ProviderAccountId.Should().Be(updatedEmail);
        }
    }

    [Fact]
    public async Task Register_Fails_If_Email_Matches_Verified_Secondary_Email()
    {
        var primaryEmail = $"primary_{Guid.NewGuid()}@cverify.ai";
        var secondaryEmail = $"secondary_{Guid.NewGuid()}@cverify.ai";
        var password = "SecurePassword123!";

        // Register User A and link secondaryEmail
        var cookieVal = await RegisterAndLoginUserAsync(primaryEmail, password);
        var authClient = Factory.CreateClient();
        authClient.DefaultRequestHeaders.Add("Cookie", cookieVal);

        var sendOtpResponse = await authClient.PostAsJsonAsync("/api/auth/emails/send-otp", new { Email = secondaryEmail });
        var otpResult = await sendOtpResponse.Content.ReadFromJsonAsync<SendOtpResponse>();
        await ProcessOutboxMessagesAsync();

        var sentEmail = EmailSender.SentMessages.First(m => m.ToEmail == secondaryEmail);
        var otpCode = sentEmail.PlainTextContent.Split(':').Last().Trim();

        await authClient.PostAsJsonAsync("/api/auth/emails/verify-otp", new
        {
            Email = secondaryEmail,
            Code = otpCode,
            ChallengeId = otpResult!.ChallengeId
        });

        // Attempt to register User B with the same secondary email
        var registerRequest = new RegisterRequest(
            Email: secondaryEmail,
            Password: "SecurePassword123!",
            ConfirmPassword: "SecurePassword123!",
            FullName: "User B"
        );
        var registerResponse = await Client.PostAsJsonAsync("/api/auth/register", registerRequest);
        
        // Assert registration is rejected due to global uniqueness
        registerResponse.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Unlinking_Secondary_Email_Fully_Releases_It_For_Immediate_Reuse()
    {
        var primaryEmail = $"primary_{Guid.NewGuid()}@cverify.ai";
        var secondaryEmail = $"secondary_{Guid.NewGuid()}@cverify.ai";
        var password = "SecurePassword123!";

        // Register User A and link secondaryEmail
        var cookieVal = await RegisterAndLoginUserAsync(primaryEmail, password);
        var authClient = Factory.CreateClient();
        authClient.DefaultRequestHeaders.Add("Cookie", cookieVal);

        var sendOtpResponse = await authClient.PostAsJsonAsync("/api/auth/emails/send-otp", new { Email = secondaryEmail });
        var otpResult = await sendOtpResponse.Content.ReadFromJsonAsync<SendOtpResponse>();
        await ProcessOutboxMessagesAsync();

        var sentEmail = EmailSender.SentMessages.First(m => m.ToEmail == secondaryEmail);
        var otpCode = sentEmail.PlainTextContent.Split(':').Last().Trim();

        await authClient.PostAsJsonAsync("/api/auth/emails/verify-otp", new
        {
            Email = secondaryEmail,
            Code = otpCode,
            ChallengeId = otpResult!.ChallengeId
        });

        // Find the Guid of the linked secondary email
        var getResponse = await authClient.GetAsync("/api/auth/emails");
        var emailsList = await getResponse.Content.ReadFromJsonAsync<List<EmailItemTemp>>();
        var linkedItem = emailsList!.First(e => e.Email == secondaryEmail);

        // Delete (unlink) the secondary email
        var deleteResponse = await authClient.DeleteAsync($"/api/auth/emails/{linkedItem.Id}");
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // Try to register a new user with that same email immediately
        var registerRequest = new RegisterRequest(
            Email: secondaryEmail,
            Password: "SecurePassword123!",
            ConfirmPassword: "SecurePassword123!",
            FullName: "Reuse User"
        );
        var registerResponse = await Client.PostAsJsonAsync("/api/auth/register", registerRequest);
        
        // Assert it is allowed now
        registerResponse.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    private class EmailItemTemp
    {
        public Guid Id { get; set; }
        public string Email { get; set; } = null!;
        public bool IsPrimary { get; set; }
        public bool IsVerified { get; set; }
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
