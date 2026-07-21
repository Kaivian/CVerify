using System;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using FluentAssertions;
using Xunit;
using CVerify.API.IntegrationTests.Fixtures;
using CVerify.API.Modules.Auth.DTOs;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Security;
using CVerify.API.Modules.Shared.System.DTOs;

namespace CVerify.API.IntegrationTests.Auth;

public class EnterpriseRegistrationContractTests : BaseIntegrationTest
{
    private const string JwtSecret = "super_secret_key_super_secret_key_super_secret_key_32_characters";

    public EnterpriseRegistrationContractTests(SharedTestcontainerFixture containerFixture) : base(containerFixture)
    {
    }

    private async Task SeedSystemRolesAsync()
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
    public async Task Step1_VerifyCompany_With_Canonical_OrganizationName_Should_Succeed()
    {
        await SeedSystemRolesAsync();

        var payload = new
        {
            organizationName = "CÔNG TY TNHH PHẦN MỀM FPT",
            taxCode = "0101243156"
        };

        var response = await Client.PostAsJsonAsync("/api/auth/onboarding/verify-company", payload);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(content);
        var root = doc.RootElement;

        root.TryGetProperty("signedToken", out var signedToken).Should().BeTrue();
        signedToken.GetString().Should().NotBeNullOrEmpty();
        root.TryGetProperty("officialOrganizationName", out var officialOrgName).Should().BeTrue();
        officialOrgName.GetString().Should().Be("CÔNG TY TNHH PHẦN MỀM FPT");
    }

    [Fact]
    public async Task Step1_VerifyCompany_With_Legacy_CompanyName_Should_Succeed()
    {
        await SeedSystemRolesAsync();

        var payload = new
        {
            companyName = "CÔNG TY TNHH PHẦN MỀM FPT",
            taxCode = "0101243156"
        };

        var response = await Client.PostAsJsonAsync("/api/auth/onboarding/verify-company", payload);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(content);
        var root = doc.RootElement;

        root.TryGetProperty("signedToken", out var signedToken).Should().BeTrue();
        signedToken.GetString().Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task Step1_VerifyCompany_With_13Digit_BranchTaxCode_Should_Succeed()
    {
        await SeedSystemRolesAsync();

        var payload = new
        {
            organizationName = "CÔNG TY TNHH PHẦN MỀM FPT",
            taxCode = "0101243156-001"
        };

        var response = await Client.PostAsJsonAsync("/api/auth/onboarding/verify-company", payload);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Step1_InvalidTaxCodeFormat_Should_Return_Structured_ApiErrorResponse()
    {
        await SeedSystemRolesAsync();

        var payload = new
        {
            organizationName = "Invalid Corp",
            taxCode = "ABC-INVALID"
        };

        var response = await Client.PostAsJsonAsync("/api/auth/onboarding/verify-company", payload);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var errorResponse = await response.Content.ReadFromJsonAsync<ApiErrorResponse>();
        errorResponse.Should().NotBeNull();
        errorResponse!.Status.Should().Be(400);
        errorResponse.Message.Should().NotBeNullOrEmpty();
        errorResponse.CorrelationId.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task Step3_CompleteOnboarding_With_Canonical_Payload_Should_Succeed()
    {
        await SeedSystemRolesAsync();

        var step2Token = OnboardingTokenHelper.GenerateStep2Token(
            "0401779383",
            "VietQR Legal Corp",
            "canonical-owner@cverify.ai",
            false,
            JwtSecret
        );

        var payload = new
        {
            step2Token,
            organizationUsername = "canonical-workspace",
            organizationDisplayName = "Canonical Business Corp",
            password = "EnterprisePassword123!"
        };

        var response = await Client.PostAsJsonAsync("/api/auth/onboarding/complete", payload);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var data = await response.Content.ReadFromJsonAsync<SetupWorkspaceResponse>();
        data.Should().NotBeNull();
        data!.Success.Should().BeTrue();
        data.OrganizationUsername.Should().Be("canonical-workspace");
    }

    [Fact]
    public async Task Step3_CompleteOnboarding_With_Legacy_CompanyDisplayName_Should_Succeed()
    {
        await SeedSystemRolesAsync();

        var step2Token = OnboardingTokenHelper.GenerateStep2Token(
            "0401779383",
            "VietQR Legal Corp",
            "legacy-owner@cverify.ai",
            false,
            JwtSecret
        );

        var payload = new
        {
            step2Token,
            organizationUsername = "legacy-workspace",
            companyDisplayName = "Legacy Business Corp",
            password = "EnterprisePassword123!"
        };

        var response = await Client.PostAsJsonAsync("/api/auth/onboarding/complete", payload);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var data = await response.Content.ReadFromJsonAsync<SetupWorkspaceResponse>();
        data.Should().NotBeNull();
        data!.Success.Should().BeTrue();
        data.OrganizationUsername.Should().Be("legacy-workspace");
    }

    [Fact]
    public async Task CompleteWorkflow_Verification_To_FirstLogin_Should_Succeed()
    {
        await SeedSystemRolesAsync();

        // Step 1: Verify Company
        var step1Payload = new
        {
            organizationName = "CÔNG TY TNHH PHẦN MỀM FPT",
            taxCode = "0101243156"
        };
        var step1Res = await Client.PostAsJsonAsync("/api/auth/onboarding/verify-company", step1Payload);
        step1Res.StatusCode.Should().Be(HttpStatusCode.OK);
        var step1Doc = JsonDocument.Parse(await step1Res.Content.ReadAsStringAsync());
        var step1Token = step1Doc.RootElement.GetProperty("signedToken").GetString()!;

        // Step 2: Generate Step 2 token directly simulating verified owner
        var step2Token = OnboardingTokenHelper.GenerateStep2Token(
            "0101243156",
            "CÔNG TY TNHH PHẦN MỀM FPT",
            "e2e-owner@cverify.ai",
            false,
            JwtSecret
        );

        // Step 3: Complete Onboarding Workspace Provisioning
        var completePayload = new
        {
            step2Token,
            organizationUsername = "e2e-fpt-workspace",
            organizationDisplayName = "FPT Software Enterprise",
            password = "EnterprisePassword123!"
        };
        var completeRes = await Client.PostAsJsonAsync("/api/auth/onboarding/complete", completePayload);
        completeRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // Step 4: First Login as Company Owner via Workspace Handle & Password
        var loginPayload = new
        {
            organizationUsername = "e2e-fpt-workspace",
            password = "EnterprisePassword123!"
        };
        var loginRes = await Client.PostAsJsonAsync("/api/auth/company-login", loginPayload);
        loginRes.StatusCode.Should().Be(HttpStatusCode.OK);

        var loginData = await loginRes.Content.ReadFromJsonAsync<AuthResponse>();
        loginData.Should().NotBeNull();
        loginData!.Username.Should().Be("e2e-fpt-workspace");
    }
}
