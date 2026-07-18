using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using FluentAssertions;
using CVerify.API.IntegrationTests.Fixtures;
using CVerify.API.IntegrationTests.Helpers;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Profiles.Entities;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Profiles.Services;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.IntegrationTests.Security;

[Collection("Shared Containers Collection")]
public class MultiTenantMatchingSecurityTests : BaseIntegrationTest
{
    public MultiTenantMatchingSecurityTests(SharedTestcontainerFixture containerFixture)
        : base(containerFixture)
    {
    }

    [Fact]
    public async Task DiscoveryTrigger_ShouldIsolateStreamingSession_ToCorrectWorkspace()
    {
        // Arrange
        using var scope = Factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var tenantAOrgId = Guid.NewGuid();
        var tenantAWorkspaceId = Guid.NewGuid();
        var tenantBOrgId = Guid.NewGuid();
        var tenantBWorkspaceId = Guid.NewGuid();

        var requirementIdA = Guid.NewGuid();

        // Seed Owner User
        var ownerId = Guid.NewGuid();
        var owner = new User { Id = ownerId, FullName = "Owner User", Email = "owner@tenant.com", Username = $"owner_{Guid.NewGuid().ToString("N").Substring(0, 8)}" };
        context.Users.Add(owner);

        // Seed Tenant A
        var orgA = new Organization { Id = tenantAOrgId, Name = "Tenant A Corp", TaxCode = "A123", Email = "a@corp.com", Username = "tenant_a" };
        var wsA = new Workspace { Id = tenantAWorkspaceId, OrganizationId = tenantAOrgId, DisplayName = "Workspace A", Slug = "ws-a", OwnerId = ownerId };
        context.Organizations.Add(orgA);
        context.Workspaces.Add(wsA);

        // Seed Tenant B
        var orgB = new Organization { Id = tenantBOrgId, Name = "Tenant B Corp", TaxCode = "B123", Email = "b@corp.com", Username = "tenant_b" };
        var wsB = new Workspace { Id = tenantBWorkspaceId, OrganizationId = tenantBOrgId, DisplayName = "Workspace B", Slug = "ws-b", OwnerId = ownerId };
        context.Organizations.Add(orgB);
        context.Workspaces.Add(wsB);

        // Seed Hiring Requirement for Tenant A
        var reqA = MatchingTestFixtures.CreateHiringRequirement(requirementIdA, tenantAOrgId, tenantAWorkspaceId, "A Developer", "Senior");
        context.HiringRequirements.Add(reqA);

        var candidateId = Guid.NewGuid();
        var user = MatchingTestFixtures.CreateCandidateUser(candidateId, "Tenant User", "tenant@cverify.com", "tenant_user");
        context.Users.Add(user);

        await context.SaveChangesAsync();

        var matchService = scope.ServiceProvider.GetRequiredService<ICandidateMatchService>();

        // Act
        var response = await matchService.TriggerDiscoveryAsync(requirementIdA, candidateId, CancellationToken.None);

        // Assert - verify streaming session matches Workspace A, not Workspace B
        var streamingSessionService = scope.ServiceProvider.GetRequiredService<IAiStreamingSessionService>();
        var sessions = await context.AiStreamingSessions
            .Where(s => s.WorkspaceId == tenantAWorkspaceId)
            .ToListAsync();

        sessions.Should().NotBeNullOrEmpty();
        sessions.Should().Contain(s => s.WorkspaceId == tenantAWorkspaceId);

        var leakSessions = await context.AiStreamingSessions
            .Where(s => s.WorkspaceId == tenantBWorkspaceId)
            .ToListAsync();
        leakSessions.Should().BeEmpty(); // No leak to Workspace B
    }
}
