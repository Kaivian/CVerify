using System;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using CVerify.API.Application.DTOs;
using CVerify.API.Core.Entities;
using CVerify.API.Infrastructure.Persistence;
using CVerify.API.Infrastructure.Security;
using CVerify.API.IntegrationTests.Fixtures;
using CVerify.API.IntegrationTests.Helpers;
using Xunit;

namespace CVerify.API.IntegrationTests.Auth;

public class OnboardingAndAuthRegressionTests : BaseIntegrationTest
{
    public OnboardingAndAuthRegressionTests(SharedTestcontainerFixture containerFixture) : base(containerFixture)
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
    public async Task ExistingOrganizationDetection_ShouldReturn_OrganizationExistsResponse()
    {
        await SeedDefaultRolesAsync();

        // 1. Seed an existing organization
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var existingOrg = new Organization
            {
                Id = Guid.CreateVersion7(),
                Name = "CÔNG TY TNHH PHẦN MỀM FPT",
                TaxCode = "0101243156",
                Email = "fpt@cverify.ai",
                Username = "fpt-test-workspace",
                IsVerified = true,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            db.Organizations.Add(existingOrg);
            await db.SaveChangesAsync();
        }

        // 2. Submit onboarding verification for the same tax code
        var request = new VerifyCompanyOnboardingRequest(
            CompanyName: "CÔNG TY TNHH PHẦN MỀM FPT",
            TaxCode: "0101243156"
        );

        var response = await Client.PostAsJsonAsync("/api/auth/onboarding/verify-company", request);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var data = await response.Content.ReadFromJsonAsync<VerifyCompanyOnboardingResponse>();
        data.Should().NotBeNull();
        data!.OrganizationExists.Should().BeTrue();
        data.RecoveryRequired.Should().BeTrue();
        data.SignedToken.Should().BeNull();
        data.OrganizationDisplayName.Should().Be("CÔNG TY TNHH PHẦN MỀM FPT");
        data.OrganizationSlug.Should().Be("fpt-test-workspace");
    }

    [Fact]
    public async Task OnboardingComplete_TraditionalLogin_ClaimVerification()
    {
        await SeedDefaultRolesAsync();

        // Generate Step 2 Token
        var step2Token = OnboardingTokenHelper.GenerateStep2Token(
            "0401779383", 
            "VietQR Legal Corp", 
            "owner@cverify.ai", 
            false, 
            "super_secret_key_super_secret_key_super_secret_key_32_characters"
        );

        var request = new CompleteOnboardingRequest(
            Step2Token: step2Token,
            OrganizationUsername: "vietqr-workspace",
            Password: "SecurePassword123!",
            ConfirmPassword: "SecurePassword123!",
            CompanyDisplayName: "VietQR Legal Corp"
        );

        var response = await Client.PostAsJsonAsync("/api/auth/onboarding/complete", request);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var responseData = await response.Content.ReadFromJsonAsync<AuthResponse>();
        responseData.Should().NotBeNull();
        responseData!.Status.Should().Be("ACTIVE");
        responseData.NextStep.Should().Be("DASHBOARD");

        // Verify that standard email/password login now works immediately
        var loginRequest = new LoginRequest(
            Email: "owner@cverify.ai",
            Password: "SecurePassword123!"
        );

        var loginResponse = await Client.PostAsJsonAsync("/api/auth/login", loginRequest);
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var loginData = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>();
        loginData.Should().NotBeNull();
        loginData!.Email.Should().Be("owner@cverify.ai");

        // Verify that organization workspace login separates correctly
        var companyLoginRequest = new OrganizationLoginRequest(
            OrganizationUsername: "vietqr-workspace",
            Password: "SecurePassword123!"
        );

        var companyLoginResponse = await Client.PostAsJsonAsync("/api/auth/company-login", companyLoginRequest);
        companyLoginResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var companyLoginData = await companyLoginResponse.Content.ReadFromJsonAsync<AuthResponse>();
        companyLoginData.Should().NotBeNull();
    }
}
