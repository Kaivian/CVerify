using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Security.Claims;
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
using CVerify.API.Modules.Recovery.DTOs;
using CVerify.API.Modules.Recovery.Entities;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Exceptions;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Security;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.IntegrationTests.Auth;

[Collection("Shared Containers Collection")]
public class UserRequestedBusinessFlowsTests : BaseIntegrationTest
{
    private readonly WebApplicationFactory<Program> _customFactory;
    private readonly HttpClient _client;

    public UserRequestedBusinessFlowsTests(SharedTestcontainerFixture containerFixture) : base(containerFixture)
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

    // ==========================================
    // REGISTER ACCOUNT TESTS (BUS-REG-001 - BUS-REG-008)
    // ==========================================

    [Fact]
    public async Task BUS_REG_001_Register_Company_With_Valid_MST_Success()
    {
        await SeedDefaultRolesAsync();
        
        // 1. Verify Company (Step 1)
        var verifyCompanyRequest = new VerifyCompanyOnboardingRequest(
            CompanyName: "CÔNG TY TNHH PHẦN MỀM FPT",
            TaxCode: "0101243156"
        );
        
        var response = await _client.PostAsJsonAsync("/api/auth/onboarding/verify-company", verifyCompanyRequest);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        
        var data = await response.Content.ReadFromJsonAsync<VerifyOrganizationOnboardingResponse>();
        data.Should().NotBeNull();
        data!.SignedToken.Should().NotBeNullOrEmpty();
        data.OfficialOrganizationName.Should().Be("CÔNG TY TNHH PHẦN MỀM FPT");
        
        var step1Token = data.SignedToken!;

        // 2. Dispatch OTP to representative email (must use public domain like gmail.com to pass DNS lookup check)
        var repEmail = "rep@gmail.com";
        var otpReq = new SendOtpRequest(Email: repEmail, Purpose: "Authentication");
        var sendOtpRes = await _client.PostAsJsonAsync("/api/auth/send-otp", otpReq);
        sendOtpRes.StatusCode.Should().Be(HttpStatusCode.OK);
        
        var otpData = await sendOtpRes.Content.ReadFromJsonAsync<SendOtpResponse>();
        otpData.Should().NotBeNull();
        var challengeId = otpData!.ChallengeId;

        // Retrieve OTP plain text from database outbox
        using var scope = _customFactory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var outboxMessage = await db.OutboxMessages.FirstAsync(m => m.Type == "EmailOtpVerification" && m.Payload.Contains(repEmail));
        var payloadDict = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(outboxMessage.Payload);
        var plainOtp = payloadDict!["Otp"].ToString();

        // 3. Verify OTP (Step 2)
        var verifyOtpRequest = new VerifyOtpRequest(
            ChallengeId: challengeId,
            Email: repEmail,
            Code: plainOtp!,
            Purpose: "Authentication"
        );

        var verifyOtpMsg = new HttpRequestMessage(HttpMethod.Post, "/api/auth/onboarding/verify-otp")
        {
            Content = JsonContent.Create(verifyOtpRequest)
        };
        verifyOtpMsg.Headers.Add("X-Step1-Token", step1Token);

        var verifyOtpRes = await _client.SendAsync(verifyOtpMsg);
        verifyOtpRes.StatusCode.Should().Be(HttpStatusCode.OK);
        
        var step2Data = await verifyOtpRes.Content.ReadFromJsonAsync<VerifyOtpResponse>();
        step2Data.Should().NotBeNull();
        step2Data!.VerificationToken.Should().NotBeNullOrEmpty();
        var step2Token = step2Data.VerificationToken;

        // 4. Complete Onboarding
        var completeOnboardingRequest = new CompleteOnboardingRequest(
            Step2Token: step2Token,
            OrganizationUsername: "fpt-test-workspace",
            OrganizationDisplayName: "FPT Software Co",
            Password: "SecurePassword123!"
        );

        var completeRes = await _client.PostAsJsonAsync("/api/auth/onboarding/complete", completeOnboardingRequest);
        completeRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // 5. Verify Workspace Credentials created
        using var scope2 = _customFactory.Services.CreateScope();
        var db2 = scope2.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var org = await db2.Organizations.FirstOrDefaultAsync(o => o.Username == "fpt-test-workspace" && o.DeletedAt == null);
        org.Should().NotBeNull();
        org!.Name.Should().Be("CÔNG TY TNHH PHẦN MỀM FPT");
        
        var cred = await db2.OrganizationCredentials.FirstOrDefaultAsync(c => c.OrganizationId == org.Id);
        cred.Should().NotBeNull();
        BCrypt.Net.BCrypt.Verify("SecurePassword123!", cred!.PasswordHash).Should().BeTrue();
    }

    [Fact]
    public async Task BUS_REG_002_Register_With_Invalid_MST_Format_Fails()
    {
        var verifyCompanyRequest = new VerifyCompanyOnboardingRequest(
            CompanyName: "CÔNG TY TNHH PHẦN MỀM FPT",
            TaxCode: "12345" // Invalid format (should be 10 digits or 10-3)
        );
        
        var response = await _client.PostAsJsonAsync("/api/auth/onboarding/verify-company", verifyCompanyRequest);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task BUS_REG_003_Register_With_Mismatched_Company_Name_Fails()
    {
        var verifyCompanyRequest = new VerifyCompanyOnboardingRequest(
            CompanyName: "CONG TY SAI HOAN TOAN", // Similarity similarity < 75%
            TaxCode: "0101243156"
        );
        
        var response = await _client.PostAsJsonAsync("/api/auth/onboarding/verify-company", verifyCompanyRequest);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task BUS_REG_004_Register_MST_Already_Exists_Triggers_Reclaim()
    {
        await SeedDefaultRolesAsync();
        
        // Seed Organization in DB
        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var existingOrg = new Organization
            {
                Id = Guid.CreateVersion7(),
                Name = "CÔNG TY TNHH PHẦN MỀM FPT",
                TaxCode = "0101243156",
                Email = "fpt@gmail.com",
                Username = "fpt-test-workspace",
                IsVerified = true,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            db.Organizations.Add(existingOrg);
            await db.SaveChangesAsync();
        }

        var verifyCompanyRequest = new VerifyCompanyOnboardingRequest(
            CompanyName: "CÔNG TY TNHH PHẦN MỀM FPT",
            TaxCode: "0101243156"
        );
        
        var response = await _client.PostAsJsonAsync("/api/auth/onboarding/verify-company", verifyCompanyRequest);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        
        var data = await response.Content.ReadFromJsonAsync<VerifyOrganizationOnboardingResponse>();
        data.Should().NotBeNull();
        data!.OrganizationExists.Should().BeTrue();
        data.RecoveryRequired.Should().BeTrue();
        data.OrganizationSlug.Should().Be("fpt-test-workspace");
    }

    [Fact]
    public async Task BUS_REG_005_Register_Workspace_Slug_Reserved_Word_Fails()
    {
        var step2Token = OnboardingTokenHelper.GenerateStep2Token(
            "0101243156", 
            "CÔNG TY TNHH PHẦN MỀM FPT", 
            "rep@gmail.com", 
            false, 
            "super_secret_key_super_secret_key_super_secret_key_32_characters"
        );

        var request = new CompleteOnboardingRequest(
            Step2Token: step2Token,
            OrganizationUsername: "admin", // Reserved word
            OrganizationDisplayName: "FPT Software",
            Password: "SecurePassword123!"
        );

        var response = await _client.PostAsJsonAsync("/api/auth/onboarding/complete", request);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task BUS_REG_006_Register_Workspace_Slug_Too_Short_Fails()
    {
        var step2Token = OnboardingTokenHelper.GenerateStep2Token(
            "0101243156", 
            "CÔNG TY TNHH PHẦN MỀM FPT", 
            "rep@gmail.com", 
            false, 
            "super_secret_key_super_secret_key_super_secret_key_32_characters"
        );

        var request = new CompleteOnboardingRequest(
            Step2Token: step2Token,
            OrganizationUsername: "abc", // Under 4 characters
            OrganizationDisplayName: "FPT Software",
            Password: "SecurePassword123!"
        );

        var response = await _client.PostAsJsonAsync("/api/auth/onboarding/complete", request);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task BUS_REG_007_Register_Workspace_Slug_Contains_Uppercase_Fails()
    {
        var step2Token = OnboardingTokenHelper.GenerateStep2Token(
            "0101243156", 
            "CÔNG TY TNHH PHẦN MỀM FPT", 
            "rep@gmail.com", 
            false, 
            "super_secret_key_super_secret_key_super_secret_key_32_characters"
        );

        var request = new CompleteOnboardingRequest(
            Step2Token: step2Token,
            OrganizationUsername: "MyCompany", // Contains uppercase
            OrganizationDisplayName: "FPT Software",
            Password: "SecurePassword123!"
        );

        var response = await _client.PostAsJsonAsync("/api/auth/onboarding/complete", request);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task BUS_REG_008_Register_Workspace_Weak_Password_Fails()
    {
        var step2Token = OnboardingTokenHelper.GenerateStep2Token(
            "0101243156", 
            "CÔNG TY TNHH PHẦN MỀM FPT", 
            "rep@gmail.com", 
            false, 
            "super_secret_key_super_secret_key_super_secret_key_32_characters"
        );

        var request = new CompleteOnboardingRequest(
            Step2Token: step2Token,
            OrganizationUsername: "fpt-workspace",
            OrganizationDisplayName: "FPT Software",
            Password: "123" // Weak password
        );

        var response = await _client.PostAsJsonAsync("/api/auth/onboarding/complete", request);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ==========================================
    // LOGIN WITH SLUG TESTS (BUS-REG-009 - BUS-REG-011)
    // ==========================================

    [Fact]
    public async Task BUS_REG_009_Login_Business_Success()
    {
        // Seed Organization and Credentials
        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var org = new Organization
            {
                Id = Guid.CreateVersion7(),
                Name = "CÔNG TY TNHH PHẦN MỀM FPT",
                TaxCode = "0101243156",
                Email = "fpt@gmail.com",
                Username = "fpt-workspace",
                IsVerified = true,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            db.Organizations.Add(org);
            await db.SaveChangesAsync();

            var cred = new OrganizationCredential
            {
                OrganizationId = org.Id,
                Username = org.Username,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("SecurePassword123!"),
                FailedLoginAttempts = 0,
                LockoutEnd = null,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            db.OrganizationCredentials.Add(cred);
            await db.SaveChangesAsync();
        }

        var loginRequest = new OrganizationLoginRequest(
            OrganizationUsername: "fpt-workspace",
            Password: "SecurePassword123!"
        );

        var response = await _client.PostAsJsonAsync("/api/auth/company-login", loginRequest);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        
        var cookies = response.Headers.GetValues("Set-Cookie").ToList();
        cookies.Any(c => c.StartsWith("access_token")).Should().BeTrue();
    }

    [Fact]
    public async Task BUS_REG_010_Login_Business_Nonexistent_Slug_Fails()
    {
        var loginRequest = new OrganizationLoginRequest(
            OrganizationUsername: "nonexistent-company",
            Password: "SecurePassword123!"
        );

        var response = await _client.PostAsJsonAsync("/api/auth/company-login", loginRequest);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task BUS_REG_011_Login_Business_Wrong_Password_Fails_And_Increments()
    {
        // Seed Organization and Credentials
        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var org = new Organization
            {
                Id = Guid.CreateVersion7(),
                Name = "CÔNG TY TNHH PHẦN MỀM FPT",
                TaxCode = "0101243156",
                Email = "fpt@gmail.com",
                Username = "fpt-workspace",
                IsVerified = true,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            db.Organizations.Add(org);
            await db.SaveChangesAsync();

            var cred = new OrganizationCredential
            {
                OrganizationId = org.Id,
                Username = org.Username,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("SecurePassword123!"),
                FailedLoginAttempts = 0,
                LockoutEnd = null,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            db.OrganizationCredentials.Add(cred);
            await db.SaveChangesAsync();
        }

        var loginRequest = new OrganizationLoginRequest(
            OrganizationUsername: "fpt-workspace",
            Password: "WrongPassword!"
        );

        var response = await _client.PostAsJsonAsync("/api/auth/company-login", loginRequest);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        // Verify failure count incremented
        using var scope2 = _customFactory.Services.CreateScope();
        var db2 = scope2.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var credRecord = await db2.OrganizationCredentials.FirstAsync(c => c.Username == "fpt-workspace");
        credRecord.FailedLoginAttempts.Should().Be(1);
    }

    // ==========================================
    // FORGOT PASSWORD BUSINESS TESTS (BUS-REG-012 - BUS-REG-013)
    // ==========================================

    [Fact]
    public async Task BUS_REG_012_ForgotPassword_Business_Send_Otp()
    {
        // Seed Organization and Credentials
        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var org = new Organization
            {
                Id = Guid.CreateVersion7(),
                Name = "CÔNG TY TNHH PHẦN MỀM FPT",
                TaxCode = "0101243156",
                Email = "fpt@gmail.com",
                Username = "fpt-workspace",
                IsVerified = true,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            db.Organizations.Add(org);
            await db.SaveChangesAsync();
        }

        var request = new OrganizationForgotRequest(TaxCode: "0101243156");
        var response = await _client.PostAsJsonAsync("/api/auth/recovery/organization/forgot", request);
        
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        
        var forgotData = await response.Content.ReadFromJsonAsync<OrganizationForgotResponse>();
        forgotData.Should().NotBeNull();
        forgotData!.ChallengeId.Should().NotBe(Guid.Empty);
        forgotData.MaskedEmail.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task BUS_REG_013_ResetPassword_Business_Success()
    {
        await SeedDefaultRolesAsync();

        // Seed Organization, Credentials, User, and OrganizationAuthority
        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var org = new Organization
            {
                Id = Guid.CreateVersion7(),
                Name = "CÔNG TY TNHH PHẦN MỀM FPT",
                TaxCode = "0101243156",
                Email = "fpt@gmail.com",
                Username = "fpt-workspace",
                IsVerified = true,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            db.Organizations.Add(org);
            await db.SaveChangesAsync();

            var cred = new OrganizationCredential
            {
                OrganizationId = org.Id,
                Username = org.Username,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("SecurePassword123!"),
                FailedLoginAttempts = 0,
                LockoutEnd = null,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            db.OrganizationCredentials.Add(cred);
            await db.SaveChangesAsync();

            var userRole = await db.Roles.FirstAsync(r => r.Name == "USER");
            var user = new UserBuilder()
                .WithEmail("fpt@gmail.com")
                .WithPassword("SecurePassword123!")
                .WithStatus(UserStatus.ACTIVE)
                .WithRole(userRole)
                .Build();
            db.Users.Add(user);
            await db.SaveChangesAsync();

            var authority = new OrganizationAuthority
            {
                Id = Guid.CreateVersion7(),
                OrganizationId = org.Id,
                UserId = user.Id,
                Role = "organization_owner",
                JoinedAt = DateTimeOffset.UtcNow
            };
            db.OrganizationAuthorities.Add(authority);
            await db.SaveChangesAsync();
        }

        // 1. Request recovery code
        var forgotReq = new OrganizationForgotRequest(TaxCode: "0101243156");
        var forgotRes = await _client.PostAsJsonAsync("/api/auth/recovery/organization/forgot", forgotReq);
        forgotRes.StatusCode.Should().Be(HttpStatusCode.OK);

        var forgotData = await forgotRes.Content.ReadFromJsonAsync<OrganizationForgotResponse>();
        var challengeId = forgotData!.ChallengeId;

        // Retrieve OTP plain text from DB Outbox
        using var scope1 = _customFactory.Services.CreateScope();
        var db1 = scope1.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var outboxMessage = await db1.OutboxMessages.FirstAsync(m => m.Type == "OrganizationRecoveryOtp" && m.Payload.Contains("fpt@gmail.com"));
        var payloadDict = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(outboxMessage.Payload);
        var plainOtp = payloadDict!["Code"].ToString();

        // 2. Verify OTP
        var verifyOtpRequest = new VerifyOrganizationOtpRequest(
            TaxCode: "0101243156",
            ChallengeId: challengeId,
            Code: plainOtp!
        );

        var verifyRes = await _client.PostAsJsonAsync("/api/auth/recovery/organization/verify-otp", verifyOtpRequest);
        verifyRes.StatusCode.Should().Be(HttpStatusCode.OK);

        var verifyData = await verifyRes.Content.ReadFromJsonAsync<VerifyOrganizationOtpResponse>();
        var recoveryToken = verifyData!.VerificationToken;

        // 3. Reset Password
        var resetPasswordRequest = new ResetOrganizationPasswordRequest
        {
            Token = recoveryToken,
            NewPassword = "NewSecurePassword123!",
            ConfirmPassword = "NewSecurePassword123!"
        };

        var resetRes = await _client.PostAsJsonAsync("/api/auth/recovery/organization/reset-password", resetPasswordRequest);
        resetRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify DB updated (specifically administrator user password)
        using var scope2 = _customFactory.Services.CreateScope();
        var db2 = scope2.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var adminUser = await db2.Users.FirstAsync(u => u.Email == "fpt@gmail.com");
        BCrypt.Net.BCrypt.Verify("NewSecurePassword123!", adminUser.PasswordHash).Should().BeTrue();
    }

    // ==========================================
    // REQUEST ACCESS (RECLAIM) TESTS (BUS-REG-014 - BUS-REG-015)
    // ==========================================

    [Fact]
    public async Task BUS_REG_014_Submit_Claim_Reclaim_Success()
    {
        await SeedDefaultRolesAsync();

        // Seed target organization
        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var org = new Organization
            {
                Id = Guid.CreateVersion7(),
                Name = "CÔNG TY TNHH PHẦN MỀM FPT",
                TaxCode = "0101243156",
                Email = "fpt@gmail.com",
                Username = "fpt-workspace",
                IsVerified = true,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            db.Organizations.Add(org);
            await db.SaveChangesAsync();
        }

        // 1. Send OTP for Reclaim
        var reclaimEmail = "newowner@gmail.com";
        var sendOtpReq = new ReclaimSendOtpRequest(TaxCode: "0101243156", Email: reclaimEmail);
        var sendRes = await _client.PostAsJsonAsync("/api/auth/recovery/reclaim/send-otp", sendOtpReq);
        sendRes.StatusCode.Should().Be(HttpStatusCode.OK);

        var otpData = await sendRes.Content.ReadFromJsonAsync<SendOtpResponse>();
        var challengeId = otpData!.ChallengeId;

        // Retrieve OTP plain text from DB Outbox
        using var scope1 = _customFactory.Services.CreateScope();
        var db1 = scope1.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var outboxMessage = await db1.OutboxMessages.FirstAsync(m => m.Type == "EmailOtpVerification" && m.Payload.Contains(reclaimEmail));
        var payloadDict = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(outboxMessage.Payload);
        var plainOtp = payloadDict!["Otp"].ToString();

        // 2. Verify OTP
        var verifyOtpRequest = new VerifyOtpRequest(
            ChallengeId: challengeId,
            Email: reclaimEmail,
            Code: plainOtp!,
            Purpose: "Reclaim"
        );

        var verifyRes = await _client.PostAsJsonAsync("/api/auth/recovery/reclaim/verify-otp?taxCode=0101243156", verifyOtpRequest);
        verifyRes.StatusCode.Should().Be(HttpStatusCode.OK);

        var verifyData = await verifyRes.Content.ReadFromJsonAsync<VerifyOtpResponse>();
        var verificationToken = verifyData!.VerificationToken;

        // 3. Submit reclaim claim
        using var form = new MultipartFormDataContent();
        form.Add(new StringContent("Nguyen Van Reclaim"), "RepresentativeFullName");
        form.Add(new StringContent("Director"), "RepresentativePosition");
        form.Add(new StringContent("0987654321"), "PhoneNumber");
        form.Add(new StringContent(reclaimEmail), "RecoveryEmail");
        form.Add(new StringContent("0101243156"), "TaxCode");
        form.Add(new StringContent(verificationToken), "EmailVerificationToken");

        var fileBytes = Encoding.UTF8.GetBytes("Mock PDF company registration cert content");
        var fileContent = new ByteArrayContent(fileBytes);
        fileContent.Headers.ContentType = System.Net.Http.Headers.MediaTypeHeaderValue.Parse("application/pdf");
        form.Add(fileContent, "documents", "license.pdf");

        var submitRes = await _client.PostAsync("/api/auth/recovery/reclaim/submit-claim", form);
        submitRes.StatusCode.Should().Be(HttpStatusCode.OK);

        var claimData = await submitRes.Content.ReadFromJsonAsync<SubmitClaimResponse>();
        claimData.Should().NotBeNull();
        claimData!.Status.Should().Be("Pending");

        // Verify claim is persisted in DB (Documents is jsonb column, no .Include needed)
        using var scope2 = _customFactory.Services.CreateScope();
        var db2 = scope2.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var claim = await db2.OrganizationRecoveryClaims
            .FirstOrDefaultAsync(c => c.Id == claimData.ClaimId);
        
        claim.Should().NotBeNull();
        claim!.Status.Should().Be("Pending");
        claim.RecoveryEmail.Should().Be(reclaimEmail);
        claim.Documents.Should().ContainSingle();
        claim.Documents.First().FileName.Should().Be("license.pdf");
    }

    [Fact]
    public async Task BUS_REG_015_Validate_Email_Ownership_Duplicate_Fails()
    {
        // Seed Organization with old owner email
        using (var scope = _customFactory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var org = new Organization
            {
                Id = Guid.CreateVersion7(),
                Name = "CÔNG TY TNHH PHẦN MỀM FPT",
                TaxCode = "0101243156",
                Email = "fpt@gmail.com", // old owner email
                RepresentativeEmail = "fpt@gmail.com",
                Username = "fpt-workspace",
                IsVerified = true,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            db.Organizations.Add(org);
            await db.SaveChangesAsync();
        }

        // 1. Validate recovery email ownership
        var validateReq = new ValidateEmailOwnershipRequest(TaxCode: "0101243156", Email: "fpt@gmail.com");
        var valResponse = await _client.PostAsJsonAsync("/api/auth/recovery/reclaim/validate-email-ownership", validateReq);
        valResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var valData = await valResponse.Content.ReadFromJsonAsync<ValidateEmailOwnershipResponse>();
        valData.Should().NotBeNull();
        valData!.IsDuplicate.Should().BeTrue();

        // 2. Reclaim send-otp with duplicate email triggers 400 BadRequest
        var sendOtpReq = new ReclaimSendOtpRequest(TaxCode: "0101243156", Email: "fpt@gmail.com");
        var sendRes = await _client.PostAsJsonAsync("/api/auth/recovery/reclaim/send-otp", sendOtpReq);
        sendRes.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
