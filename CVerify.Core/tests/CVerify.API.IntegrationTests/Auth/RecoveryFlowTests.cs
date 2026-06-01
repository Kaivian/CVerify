using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using FluentAssertions;
using Xunit;
using CVerify.API.IntegrationTests.Fixtures;
using CVerify.API.IntegrationTests.Helpers;
using CVerify.API.Modules.AiChat.Entities;
using CVerify.API.Modules.Recovery.DTOs;
using CVerify.API.Modules.Recovery.Entities;
using CVerify.API.Modules.Recovery.Services;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Security;

namespace CVerify.API.IntegrationTests.Auth;

public class RecoveryFlowTests : BaseIntegrationTest
{
    public RecoveryFlowTests(SharedTestcontainerFixture containerFixture) : base(containerFixture)
    {
    }

    private async Task<Organization> SeedOrganizationAsync(string taxCode, string companyName, string email, string username)
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var org = new Organization
        {
            TaxCode = taxCode,
            Name = companyName,
            Email = email,
            Username = username,
            Status = "active",
            VerificationLevel = 1,
            IsVerified = true,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        db.Organizations.Add(org);
        await db.SaveChangesAsync();
        return org;
    }

    [Fact]
    public async Task SubmitClaim_With_Cooldown_Enforcement_Should_Prevent_Second_Claim()
    {
        var taxCode = "1234567890";
        var companyName = "Test Cooldown Corp";
        var email = "owner@cooldowncorp.com";
        var username = "cooldown-corp";
        
        var org = await SeedOrganizationAsync(taxCode, companyName, email, username);

        // Generate valid OTP verification token
        using var scope = Factory.Services.CreateScope();
        var config = scope.ServiceProvider.GetRequiredService<EnvConfiguration>();
        var token = RecoveryTokenHelper.GenerateOtpVerifiedToken(taxCode, email, config.Jwt.Key);

        // First Claim
        var boundary = $"----Boundary{Guid.NewGuid():N}";
        using var content = new MultipartFormDataContent(boundary);
        content.Add(new StringContent(companyName), "CompanyName");
        content.Add(new StringContent(taxCode), "TaxCode");
        content.Add(new StringContent("John Doe"), "RepresentativeFullName");
        content.Add(new StringContent("CEO"), "RepresentativePosition");
        content.Add(new StringContent("+84901234567"), "PhoneNumber");
        content.Add(new StringContent(email), "RecoveryEmail");
        content.Add(new StringContent(token), "EmailVerificationToken");

        var fileContent = new ByteArrayContent(Encoding.UTF8.GetBytes("Mock License Content"));
        fileContent.Headers.ContentType = MediaTypeHeaderValue.Parse("application/pdf");
        content.Add(fileContent, "documents", "license.pdf");

        var response1 = await Client.PostAsync("/api/auth/recovery/reclaim/submit-claim", content);
        response1.StatusCode.Should().Be(HttpStatusCode.OK);

        // Second Claim immediately (trigger cooldown)
        using var content2 = new MultipartFormDataContent(boundary);
        content2.Add(new StringContent(companyName), "CompanyName");
        content2.Add(new StringContent(taxCode), "TaxCode");
        content2.Add(new StringContent("John Doe"), "RepresentativeFullName");
        content2.Add(new StringContent("CEO"), "RepresentativePosition");
        content2.Add(new StringContent("+84901234567"), "PhoneNumber");
        content2.Add(new StringContent(email), "RecoveryEmail");
        content2.Add(new StringContent(token), "EmailVerificationToken");
        
        var fileContent2 = new ByteArrayContent(Encoding.UTF8.GetBytes("Mock License Content"));
        fileContent2.Headers.ContentType = MediaTypeHeaderValue.Parse("application/pdf");
        content2.Add(fileContent2, "documents", "license2.pdf");

        var response2 = await Client.PostAsync("/api/auth/recovery/reclaim/submit-claim", content2);
        response2.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var errorMsg = await response2.Content.ReadAsStringAsync();
        errorMsg.Should().Contain("initiated");
    }

    [Fact]
    public async Task ReviewClaim_Under_Risk_Escalation_Limits_Should_Enforce_Escalation()
    {
        var taxCode = "0987654321";
        var companyName = "Test Escalation Corp";
        var email = "owner@escalationcorp.com";
        var username = "escalation-corp";
        
        var org = await SeedOrganizationAsync(taxCode, companyName, email, username);

        // Create a High risk claim directly in database for validation simplicity
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var claim = new OrganizationRecoveryClaim
        {
            OrganizationId = org.Id,
            RepresentativeFullName = "High Risk Claimant",
            RepresentativePosition = "Director",
            PhoneNumber = "+84901112223",
            RecoveryEmail = email,
            RiskScore = 80,
            RiskLevel = "High",
            SuggestedRecoveryStrategy = "OptionA",
            Status = "PendingReview",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.OrganizationRecoveryClaims.Add(claim);
        await db.SaveChangesAsync();

        // 1. Submit first admin review signature
        var client = Factory.CreateClient();
        // Mock authentication as an admin
        // Note: Integration tests helper usually has custom token generator or endpoints to authenticate.
        // Let's call the review service directly inside scope to verify logic correctness bypass token configs
        var reclaimService = scope.ServiceProvider.GetRequiredService<IOrganizationReclaimService>();
        
        // First approval
        var partialApproved = await reclaimService.ReviewClaimAsync(claim.Id, new ReviewClaimRequest("Approved", null), "admin1@cverify.ai");
        partialApproved.Should().BeTrue();

        // Verify status is not yet approved
        var claimAfterFirst = await db.OrganizationRecoveryClaims.AsNoTracking().FirstOrDefaultAsync(c => c.Id == claim.Id);
        claimAfterFirst!.Status.Should().Be("PendingReview");
        claimAfterFirst.ReviewedBy.Should().Be("admin1@cverify.ai");
        claimAfterFirst.SecondReviewerBy.Should().BeNull();

        // Attempt same admin signing off twice should fail
        Func<Task> action = async () => await reclaimService.ReviewClaimAsync(claim.Id, new ReviewClaimRequest("Approved", null), "admin1@cverify.ai");
        await action.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("The same administrator cannot sign off twice for a high-risk recovery claim.");

        // Second approval by different admin
        var fullyApproved = await reclaimService.ReviewClaimAsync(claim.Id, new ReviewClaimRequest("Approved", null), "admin2@cverify.ai");
        fullyApproved.Should().BeTrue();

        var claimAfterSecond = await db.OrganizationRecoveryClaims.AsNoTracking().FirstOrDefaultAsync(c => c.Id == claim.Id);
        claimAfterSecond!.Status.Should().Be("Approved");
        claimAfterSecond.SecondReviewerBy.Should().Be("admin2@cverify.ai");
    }

    [Fact]
    public async Task ValidateEmailOwnership_Should_Return_IsDuplicate_True_If_Email_Matches_RepresentativeEmail()
    {
        var taxCode = "5555555555";
        var companyName = "Test Duplicate Corp";
        var email = "owner@duplicatecorp.com";
        var username = "duplicate-corp";
        
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var org = new Organization
        {
            TaxCode = taxCode,
            Name = companyName,
            Email = "company@duplicatecorp.com",
            Username = username,
            Status = "active",
            VerificationLevel = 1,
            IsVerified = true,
            RepresentativeEmail = email, // matches the entered email
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.Organizations.Add(org);
        await db.SaveChangesAsync();

        var request = new ValidateEmailOwnershipRequest(taxCode, email);
        var response = await Client.PostAsJsonAsync("/api/auth/recovery/reclaim/validate-email-ownership", request);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var result = await response.Content.ReadFromJsonAsync<ValidateEmailOwnershipResponse>();
        result.Should().NotBeNull();
        result!.IsDuplicate.Should().BeTrue();
        result.Message.Should().Contain("cannot be used");
    }

    [Fact]
    public async Task ReclaimSendOtp_Should_Prevent_Send_If_Email_Matches_RepresentativeEmail()
    {
        var taxCode = "7777777777";
        var companyName = "Test Reclaim Block Corp";
        var email = "owner@reclaimblock.com";
        var username = "reclaimblock-corp";
        
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var org = new Organization
        {
            TaxCode = taxCode,
            Name = companyName,
            Email = "company@reclaimblock.com",
            Username = username,
            Status = "active",
            VerificationLevel = 1,
            IsVerified = true,
            RepresentativeEmail = email, // matches the entered email
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.Organizations.Add(org);
        await db.SaveChangesAsync();

        var request = new ReclaimSendOtpRequest(taxCode, email);
        var response = await Client.PostAsJsonAsync("/api/auth/recovery/reclaim/send-otp", request);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var errorMsg = await response.Content.ReadAsStringAsync();
        errorMsg.Should().Contain("cannot be used");
    }

    [Fact]
    public async Task SubmitClaim_With_Email_Normalization_Should_Succeed()
    {
        var taxCode = "1234512345";
        var companyName = "Test Normalization Corp";
        var expectedEmail = "owner.name+reclaim@gmail.com";
        var rawEmailInRequest = " OWNER.NAME+reclaim@gmail.com ";
        var username = "normalization-corp";
        
        var org = await SeedOrganizationAsync(taxCode, companyName, expectedEmail, username);

        // Generate valid OTP verification token using the normalized email format
        using var scope = Factory.Services.CreateScope();
        var config = scope.ServiceProvider.GetRequiredService<EnvConfiguration>();
        
        var token = RecoveryTokenHelper.GenerateOtpVerifiedToken(taxCode, expectedEmail, config.Jwt.Key);

        // Submit claim with non-normalized recovery email containing casing and whitespace differences
        var boundary = $"----Boundary{Guid.NewGuid():N}";
        using var content = new MultipartFormDataContent(boundary);
        content.Add(new StringContent(companyName), "CompanyName");
        content.Add(new StringContent(taxCode), "TaxCode");
        content.Add(new StringContent("John Doe"), "RepresentativeFullName");
        content.Add(new StringContent("CEO"), "RepresentativePosition");
        content.Add(new StringContent("+84901234567"), "PhoneNumber");
        content.Add(new StringContent(rawEmailInRequest), "RecoveryEmail");
        content.Add(new StringContent(token), "EmailVerificationToken");

        var fileContent = new ByteArrayContent(Encoding.UTF8.GetBytes("Mock License Content"));
        fileContent.Headers.ContentType = MediaTypeHeaderValue.Parse("application/pdf");
        content.Add(fileContent, "documents", "license.pdf");

        var response = await Client.PostAsync("/api/auth/recovery/reclaim/submit-claim", content);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var result = await response.Content.ReadFromJsonAsync<SubmitClaimResponse>();
        result.Should().NotBeNull();
        result!.Status.Should().Be("Pending");
    }
}
