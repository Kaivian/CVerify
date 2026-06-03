using System;
using System.Collections.Generic;
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
using CVerify.API.Modules.Recovery.DTOs;
using CVerify.API.Modules.Recovery.Services;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Exceptions.Catalogs;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Security;

namespace CVerify.API.IntegrationTests.Auth;

public class Level2RecoveryTests : BaseIntegrationTest
{
    public Level2RecoveryTests(SharedTestcontainerFixture containerFixture) : base(containerFixture)
    {
    }

    private async Task<(Organization org, User admin, User member)> SeedLevel2OrganizationAsync(string taxCode, string companyName)
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var org = new Organization
        {
            TaxCode = taxCode,
            Name = companyName,
            Email = $"info@{taxCode}.com",
            Username = $"org-{taxCode}",
            Status = "active",
            VerificationLevel = 2, // Level 2
            IsVerified = true,
            RepresentativeName = "Original Representative",
            RepresentativeEmail = "original@representative.com",
            RepresentativePhone = "+84900000001",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.Organizations.Add(org);

        var adminUser = new UserBuilder()
            .WithEmail($"admin@{taxCode}.com")
            .WithFullName("Org Admin One")
            .WithStatus(UserStatus.ACTIVE)
            .Build();
        db.Users.Add(adminUser);

        var memberUser = new UserBuilder()
            .WithEmail($"member@{taxCode}.com")
            .WithFullName("Org Workspace Member")
            .WithStatus(UserStatus.ACTIVE)
            .Build();
        db.Users.Add(memberUser);

        await db.SaveChangesAsync();

        var orgAuth = new OrganizationAuthority
        {
            OrganizationId = org.Id,
            UserId = adminUser.Id,
            Role = "organization_owner",
            JoinedAt = DateTimeOffset.UtcNow
        };
        db.OrganizationAuthorities.Add(orgAuth);

        var workspace = new Workspace
        {
            OrganizationId = org.Id,
            DisplayName = $"{companyName} Default Workspace",
            Slug = $"workspace-{taxCode}",
            Status = "active",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.Workspaces.Add(workspace);
        await db.SaveChangesAsync();

        var wsMember = new WorkspaceMember
        {
            WorkspaceId = workspace.Id,
            UserId = memberUser.Id,
            Role = "workspace_member",
            JoinedAt = DateTimeOffset.UtcNow
        };
        db.WorkspaceMembers.Add(wsMember);
        await db.SaveChangesAsync();

        return (org, adminUser, memberUser);
    }

    [Fact]
    public async Task CheckOrganization_Level2_Should_Return_True_For_Level2_Orgs()
    {
        var taxCode = "2222333344";
        await SeedLevel2OrganizationAsync(taxCode, "Level 2 Test Org");

        var response = await Client.GetAsync($"/api/auth/recovery/level2/check?taxCode={taxCode}");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var checkResult = await response.Content.ReadFromJsonAsync<Level2CheckResponse>();
        checkResult.Should().NotBeNull();
        checkResult!.IsLevel2.Should().BeTrue();
        checkResult.LegalBusinessName.Should().Be("Level 2 Test Org");
        checkResult.CurrentRepresentative.Should().Be("Original Representative");
    }

    [Fact]
    public async Task SubmitRotationRequest_For_Non_Level2_Should_Fail()
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var level1Org = new Organization
        {
            TaxCode = "1111222233",
            Name = "Level 1 Org",
            Email = "info@level1.com",
            Username = "level1-org",
            Status = "active",
            VerificationLevel = 1, // Level 1
            IsVerified = true,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.Organizations.Add(level1Org);
        await db.SaveChangesAsync();

        var requestDto = new RepresentativeRotationRequestDto(
            TaxCode: "1111222233",
            NewRepresentativeFullName: "New Nominee",
            NewRepresentativePosition: "CEO",
            NewRepresentativeEmail: "nominee@level1.com",
            NewRepresentativePhone: "+84912345678",
            ReasonForRepresentativeChange: "representative replaced",
            OptionalSupportingMessage: "Supporting message"
        );

        var response = await Client.PostAsJsonAsync("/api/auth/recovery/level2/request-rotation", requestDto);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var error = await response.Content.ReadAsStringAsync();
        error.Should().Contain("Level 2");
    }

    [Fact]
    public async Task SubmitRotationRequest_For_Level2_Should_Succeed_And_Enqueue_Emails()
    {
        var taxCode = "9999888877";
        var (org, admin, _) = await SeedLevel2OrganizationAsync(taxCode, "Governed Enterprise");

        var requestDto = new RepresentativeRotationRequestDto(
            TaxCode: taxCode,
            NewRepresentativeFullName: "Next Executive",
            NewRepresentativePosition: "Managing Director",
            NewRepresentativeEmail: "next@governed.com",
            NewRepresentativePhone: "+84909000111",
            ReasonForRepresentativeChange: "representative replaced",
            OptionalSupportingMessage: "Replacing predecessor due to restructuring."
        );

        var response = await Client.PostAsJsonAsync("/api/auth/recovery/level2/request-rotation", requestDto);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var result = await response.Content.ReadFromJsonAsync<RepresentativeRotationRequestResponse>();
        result.Should().NotBeNull();
        result!.RequestedRepresentative.Should().Be("Next Executive");
        result.FinalDecision.Should().Be("pending_review");

        // Verify vote token and outbound emails
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var outboxEmails = await db.OutboxMessages.ToListAsync();
        outboxEmails.Should().Contain(m => m.Type == "SystemNotificationEmail" && m.Payload.Contains("vote"));
    }

    [Fact]
    public async Task SupportAndAdmin_DualApproval_Should_RotateRepresentative_And_RevokeSessions()
    {
        var taxCode = "5555666677";
        var (org, admin, member) = await SeedLevel2OrganizationAsync(taxCode, "Cooperative Corp");

        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var config = scope.ServiceProvider.GetRequiredService<EnvConfiguration>();
        var level2Service = scope.ServiceProvider.GetRequiredService<ILevel2RecoveryService>();

        // Create rotation request
        var requestResponse = await level2Service.RequestRotationAsync(new RepresentativeRotationRequestDto(
            TaxCode: taxCode,
            NewRepresentativeFullName: "Governed Nominee",
            NewRepresentativePosition: "CEO",
            NewRepresentativeEmail: "nominee@coop.com",
            NewRepresentativePhone: "+84905111222",
            ReasonForRepresentativeChange: "representative replaced",
            OptionalSupportingMessage: "Dual approval test."
        ), "Mozilla", "127.0.0.1", default);

        var requestId = requestResponse.RequestId;

        // 1. Support Call Verification
        var callOk = await level2Service.RecordVerificationCallAsync(requestId, "Business verification call successfully completed.", "verified", "reviewer_admin", default);
        callOk.Should().BeTrue();

        // 2. Support Approval
        var supportOk = await level2Service.ReviewSupportApprovalAsync(requestId, "approve", "reviewer_admin", "Mozilla", "127.0.0.1", default);
        supportOk.Should().BeTrue();

        // Status should be awaiting admin approval
        var request = await db.RepresentativeRotationRequests.FindAsync(requestId);
        request!.SupportApprovalStatus.Should().Be("approved");
        request.FinalDecision.Should().Be("awaiting_admin_approval");

        // 3. Admin Vote Approval
        var token = RecoveryTokenHelper.GenerateLevel2VoteToken(requestId, admin.Id, "organization_owner", config.Jwt.Key);
        var adminOk = await level2Service.SubmitAdminVoteAsync(token, "approve", "127.0.0.1", "Mozilla", default);
        adminOk.Should().BeTrue();

        // Verify rotation executed successfully
        var finalRequest = await db.RepresentativeRotationRequests.AsNoTracking().FirstOrDefaultAsync(r => r.Id == requestId);
        finalRequest!.FinalDecision.Should().Be("approved");

        var updatedOrg = await db.Organizations.AsNoTracking().FirstOrDefaultAsync(o => o.Id == org.Id);
        updatedOrg!.RepresentativeName.Should().Be("Governed Nominee");
        updatedOrg.RepresentativeEmail.Should().Be("nominee@coop.com");

        // Verify previous sessions revoked
        var memberUser = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == member.Id);
        memberUser!.SessionVersion.Should().BeGreaterThan(1);
    }
}
