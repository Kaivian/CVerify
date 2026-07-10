using System;
using System.Collections.Generic;
using System.Linq;
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
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Persistence;

namespace CVerify.API.IntegrationTests.Auth;

public class OrganizationInvitationLifecycleTests : BaseIntegrationTest
{
    public OrganizationInvitationLifecycleTests(SharedTestcontainerFixture containerFixture) : base(containerFixture)
    {
    }

    private async Task SeedDefaultRolesAsync(ApplicationDbContext db)
    {
        var userRole = await db.Roles.FirstOrDefaultAsync(r => r.Name == "USER");
        if (userRole == null)
        {
            db.Roles.Add(new Role
            {
                Id = Guid.Parse("018fc35b-1c5d-7b8a-9a2d-3e4f5a6b7c8d"),
                Name = "USER",
                DisplayName = "General User",
                Description = "Basic application access",
                IsSystem = true,
                IsActive = true
            });
            await db.SaveChangesAsync();
        }
    }

    private async Task<(Guid UserId, string CookieHeader)> RegisterAndLoginUserAsync(string email, string password, string name = "Invitation Test User")
    {
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await SeedDefaultRolesAsync(db);
        }

        var registerRequest = new RegisterRequest(
            Email: email,
            Password: password,
            ConfirmPassword: password,
            FullName: name
        );
        var regResponse = await Client.PostAsJsonAsync("/api/auth/register", registerRequest);
        regResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        Guid userId;
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email);
            user.Should().NotBeNull();
            user!.Status = UserStatus.ACTIVE;
            user.EmailVerifiedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync();
            userId = user.Id;
        }

        var loginRequest = new LoginRequest(Email: email, Password: password);
        var loginResponse = await Client.PostAsJsonAsync("/api/auth/login", loginRequest);
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var setCookie = loginResponse.Headers.GetValues("Set-Cookie").First(c => c.StartsWith("access_token"));
        var cookieHeader = setCookie.Split(';')[0];
        return (userId, cookieHeader);
    }

    private async Task<Organization> SeedOrganizationAsync(string slug, string name, string representativeEmail)
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var org = new Organization
        {
            Id = Guid.CreateVersion7(),
            TaxCode = "TAX" + Guid.NewGuid().ToString("N").Substring(0, 10),
            Name = name,
            Email = representativeEmail,
            Username = slug,
            Status = "active",
            VerificationLevel = 2,
            IsVerified = true,
            RepresentativeName = "Rep Name",
            RepresentativeEmail = representativeEmail,
            RepresentativePhone = "+84900000002",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        db.Organizations.Add(org);
        await db.SaveChangesAsync();

        await DbInitializer.InitializeAsync(db);

        return org;
    }

    [Fact]
    public async Task Invitation_FullLifecycle_ShouldSucceed()
    {
        // 1. Arrange organization and admin user
        var org = await SeedOrganizationAsync("inv-org", "Invitation Org", "admin@invorg.com");
        var (adminUserId, adminCookie) = await RegisterAndLoginUserAsync("admin@invorg.com", "SecurePassword123!", "Admin User");

        Guid tenantRoleId;
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var role = await db.Roles.FirstAsync(r => r.TenantId == org.Id && r.Domain == "TENANT" && r.IsActive);
            tenantRoleId = role.Id;
        }

        // Clear email sender before we start sending invites
        EmailSender.Clear();

        // 2. Invite a member
        var inviteeEmail = "invitee@test.com";
        var inviteDto = new CreateInvitationsDto(new()
        {
            new InviteMemberDto(inviteeEmail, new() { new PreAssignedRoleDto(tenantRoleId, "ORGANIZATION", org.Id) })
        });

        var adminClient = Factory.CreateClient();
        adminClient.DefaultRequestHeaders.Add("Cookie", adminCookie);

        var inviteResponse = await adminClient.PostAsJsonAsync($"/api/organizations/{org.Username}/invitations", inviteDto);
        inviteResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify invitation details
        Guid invitationId;
        string? tokenHash1;
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var invite = await db.OrganizationInvitations.Include(oi => oi.PreAssignedRoles).FirstOrDefaultAsync(oi => oi.InviteeEmail == inviteeEmail && oi.OrganizationId == org.Id);
            invite.Should().NotBeNull();
            invite!.Status.Should().Be("Pending");
            invite.PreAssignedRoles.Should().ContainSingle(r => r.RoleId == tenantRoleId);
            invitationId = invite.Id;
            tokenHash1 = invite.TokenHash;
        }

        // 3. Re-invite to verify Deduplication
        var inviteResponse2 = await adminClient.PostAsJsonAsync($"/api/organizations/{org.Username}/invitations", inviteDto);
        inviteResponse2.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify deduplication has reused the row but refreshed token
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var invites = await db.OrganizationInvitations.Where(oi => oi.InviteeEmail == inviteeEmail && oi.OrganizationId == org.Id).ToListAsync();
            invites.Should().ContainSingle(); // Deduplicated!

            var invite = invites.First();
            invite.Id.Should().Be(invitationId);
            invite.TokenHash.Should().NotBe(tokenHash1); // New token hash generated
            invite.Status.Should().Be("Pending");
            invite.DiscoveryNotifiedAt.Should().BeNull();
        }

        // Get the latest raw token from the sent email
        EmailSender.SentMessages.Should().NotBeEmpty();
        var sentEmail = EmailSender.SentMessages.Last();
        var tokenPrefix = "accept?token=";
        var tokenStartIdx = sentEmail.HtmlContent.IndexOf(tokenPrefix) + tokenPrefix.Length;
        var endIdx = sentEmail.HtmlContent.IndexOf('\n', tokenStartIdx);
        if (endIdx == -1) endIdx = sentEmail.HtmlContent.Length;
        var plainToken = sentEmail.HtmlContent.Substring(tokenStartIdx, endIdx - tokenStartIdx).Trim();
        plainToken.Should().NotBeNullOrEmpty();

        // 4. Accept Invitation Email Ownership Check
        // Try to accept with an attacker user who doesn't own the verified email
        var (attackerUserId, attackerCookie) = await RegisterAndLoginUserAsync("attacker@test.com", "SecurePassword123!", "Attacker User");
        var attackerClient = Factory.CreateClient();
        attackerClient.DefaultRequestHeaders.Add("Cookie", attackerCookie);

        var acceptAttackerResponse = await attackerClient.PostAsJsonAsync("/api/invitations/accept", new AcceptInvitationDto(plainToken));
        acceptAttackerResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // Accept with the correct user
        var (inviteeUserId, inviteeCookie) = await RegisterAndLoginUserAsync(inviteeEmail, "SecurePassword123!", "Correct Invitee");
        var inviteeClient = Factory.CreateClient();
        inviteeClient.DefaultRequestHeaders.Add("Cookie", inviteeCookie);

        var acceptSuccessResponse = await inviteeClient.PostAsJsonAsync("/api/invitations/accept", new AcceptInvitationDto(plainToken));
        acceptSuccessResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify membership and role assignments
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var isMember = await db.OrganizationMemberships.AnyAsync(om => om.OrganizationId == org.Id && om.UserId == inviteeUserId && om.Status == "active");
            isMember.Should().BeTrue();

            var hasRole = await db.RoleAssignments.AnyAsync(ra => ra.UserId == inviteeUserId && ra.RoleId == tenantRoleId && ra.ScopeType == "ORGANIZATION" && ra.ScopeId == org.Id);
            hasRole.Should().BeTrue();

            var invite = await db.OrganizationInvitations.FindAsync(invitationId);
            invite!.Status.Should().Be("Accepted");
            invite.AcceptedAt.Should().NotBeNull();
            invite.ConsumedByUserId.Should().Be(inviteeUserId);
        }

        // 5. Idempotent Accept Retry
        // Call accept again as the same user - should succeed idempotently
        var acceptRetryResponse = await inviteeClient.PostAsJsonAsync("/api/invitations/accept", new AcceptInvitationDto(plainToken));
        acceptRetryResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // 6. Try to decline accepted invitation - should fail
        var declineAcceptedResponse = await inviteeClient.PostAsJsonAsync("/api/invitations/decline", new DeclineInvitationDto(plainToken));
        declineAcceptedResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task DeclineInvitation_Lifecycle_ShouldSucceed()
    {
        // 1. Arrange organization and admin user
        var org = await SeedOrganizationAsync("dec-org", "Decline Org", "admin@decorg.com");
        var (adminUserId, adminCookie) = await RegisterAndLoginUserAsync("admin@decorg.com", "SecurePassword123!", "Admin User");

        Guid tenantRoleId;
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var role = await db.Roles.FirstAsync(r => r.TenantId == org.Id && r.Domain == "TENANT" && r.IsActive);
            tenantRoleId = role.Id;
        }

        EmailSender.Clear();

        // 2. Invite a member
        var inviteeEmail = "decliner@test.com";
        var inviteDto = new CreateInvitationsDto(new()
        {
            new InviteMemberDto(inviteeEmail, new() { new PreAssignedRoleDto(tenantRoleId, "ORGANIZATION", org.Id) })
        });

        var adminClient = Factory.CreateClient();
        adminClient.DefaultRequestHeaders.Add("Cookie", adminCookie);

        var inviteResponse = await adminClient.PostAsJsonAsync($"/api/organizations/{org.Username}/invitations", inviteDto);
        inviteResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Get token from email
        EmailSender.SentMessages.Should().NotBeEmpty();
        var sentEmail = EmailSender.SentMessages.Last();
        var tokenPrefix = "accept?token=";
        var tokenStartIdx = sentEmail.HtmlContent.IndexOf(tokenPrefix) + tokenPrefix.Length;
        var endIdx = sentEmail.HtmlContent.IndexOf('\n', tokenStartIdx);
        if (endIdx == -1) endIdx = sentEmail.HtmlContent.Length;
        var plainToken = sentEmail.HtmlContent.Substring(tokenStartIdx, endIdx - tokenStartIdx).Trim();

        // 3. Decline with attacker - should fail
        var (attackerUserId, attackerCookie) = await RegisterAndLoginUserAsync("attacker-dec@test.com", "SecurePassword123!", "Attacker User");
        var attackerClient = Factory.CreateClient();
        attackerClient.DefaultRequestHeaders.Add("Cookie", attackerCookie);

        var declineAttackerResponse = await attackerClient.PostAsJsonAsync("/api/invitations/decline", new DeclineInvitationDto(plainToken));
        declineAttackerResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // Decline with correct invitee - should succeed
        var (inviteeUserId, inviteeCookie) = await RegisterAndLoginUserAsync(inviteeEmail, "SecurePassword123!", "Correct Decliner");
        var inviteeClient = Factory.CreateClient();
        inviteeClient.DefaultRequestHeaders.Add("Cookie", inviteeCookie);

        var declineSuccessResponse = await inviteeClient.PostAsJsonAsync("/api/invitations/decline", new DeclineInvitationDto(plainToken));
        declineSuccessResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify status is Declined in database
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var invite = await db.OrganizationInvitations.FirstOrDefaultAsync(oi => oi.InviteeEmail == inviteeEmail && oi.OrganizationId == org.Id);
            invite!.Status.Should().Be("Declined");
            invite.DeclinedAt.Should().NotBeNull();

            // Check that no membership was created
            var isMember = await db.OrganizationMemberships.AnyAsync(om => om.OrganizationId == org.Id && om.UserId == inviteeUserId);
            isMember.Should().BeFalse();
        }

        // 4. Idempotent Decline Retry
        var declineRetryResponse = await inviteeClient.PostAsJsonAsync("/api/invitations/decline", new DeclineInvitationDto(plainToken));
        declineRetryResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // 5. Try to accept a declined invitation - should fail
        var acceptDeclinedResponse = await inviteeClient.PostAsJsonAsync("/api/invitations/accept", new AcceptInvitationDto(plainToken));
        acceptDeclinedResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
