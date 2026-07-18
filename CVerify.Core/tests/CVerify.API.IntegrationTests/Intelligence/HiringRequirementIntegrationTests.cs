using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using FluentAssertions;
using CVerify.API.IntegrationTests.Fixtures;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.System.DTOs;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.IntegrationTests.Intelligence;

[Collection("Shared Containers Collection")]
public class HiringRequirementIntegrationTests : BaseIntegrationTest
{
    public HiringRequirementIntegrationTests(SharedTestcontainerFixture containerFixture)
        : base(containerFixture)
    {
    }

    [Fact]
    public async Task HiringRequirement_Lifecycle_Should_Persist_And_Publish_Correctly()
    {
        // Arrange - Get services
        using var scope = Factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var service = scope.ServiceProvider.GetRequiredService<IHiringRequirementService>();

        var orgId = Guid.NewGuid();
        var workspaceId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        // Seed Organization & Workspace
        var user = new User { Id = userId, FullName = "Integrator", Email = "int@cverify.com", Username = $"int_{Guid.NewGuid().ToString("N").Substring(0, 8)}" };
        var org = new Organization { Id = orgId, Name = "Int Corp", TaxCode = "INT123", Email = "int@corp.com", Username = "int_corp", OrganizationSize = "10" };
        var ws = new Workspace { Id = workspaceId, OrganizationId = orgId, DisplayName = "Int Team", Slug = "int-team", OwnerId = userId };
        context.Users.Add(user);
        context.Organizations.Add(org);
        context.Workspaces.Add(ws);

        // Seed Capability Catalog Item
        var catalogItem = new CapabilityCatalogItem
        {
            CapabilityId = "ai.llm-agent",
            DisplayName = "LLM Orchestration & Agents",
            Category = "AI",
            Description = "LLM Orchestration & Agents description",
            Status = "Active",
            IsCustom = false
        };
        context.CapabilityCatalogItems.Add(catalogItem);
        await context.SaveChangesAsync();

        // 1. Create Draft
        var createRequest = new CreateHiringRequirementRequestDto(
            OrganizationSlug: "int_corp",
            Title: "Lead AI Engineer",
            Department: "AI Research",
            Seniority: "Principal",
            WorkplaceType: "Remote",
            City: "San Jose",
            EmploymentType: "Full-Time",
            Headcount: 1
        );

        var draft = await service.CreateDraftAsync(createRequest, userId, CancellationToken.None);
        draft.Should().NotBeNull();
        draft.Status.Should().Be("Draft");

        // 2. Update Draft with Outcomes, Responsibilities, capabilities
        var updateRequest = new UpdateHiringRequirementRequestDto(
            HiringReason: "Expansions",
            BusinessProblem: "Scaling LLMs",
            Outcomes: new List<string> { "Launch new AI agent flow" },
            Responsibilities: new List<ResponsibilityDto>
            {
                new("Design prompt workflow engines", RequirementPriority.MustHave, OwnershipLevel.Leader, true)
            },
            Capabilities: new List<RequirementCapabilityDto>
            {
                new("ai.llm-agent", "LLM Orchestration & Agents", "AI", RequirementPriority.MustHave, OwnershipLevel.Leader, 5)
            },
            Skills: new List<TechnologyRequirementDto>
            {
                new("Python", RequirementPriority.MustHave, 5)
            },
            SalaryMin: 150000,
            SalaryMax: 220000,
            Currency: "USD",
            TimezoneRange: "UTC-8",
            DegreeRequirement: "PhD or equivalent",
            Benefits: new List<string> { "Medical" },
            LanguageRequirements: new List<string> { "English" },
            StartDate: null,
            EndDate: null,
            AutoCloseRule: AutoCloseRule.CloseOnEndDate,
            CandidatesNeededCount: 2,
            Headcount: 1,
            SalaryPeriod: SalaryPeriod.Monthly,
            IsSalaryNegotiable: true,
            IsManuallyClosed: false
        );

        var updated = await service.UpdateDraftAsync(draft.Id, updateRequest, CancellationToken.None);
        updated.HiringReason.Should().Be("Expansions");

        // Check Persistence in database
        var dbRequirement = await context.HiringRequirements
            .Include(r => r.BusinessOutcomes)
            .Include(r => r.Responsibilities)
            .Include(r => r.Capabilities)
            .Include(r => r.TechnologyRequirements)
            .FirstOrDefaultAsync(r => r.Id == draft.Id);

        dbRequirement.Should().NotBeNull();
        dbRequirement!.BusinessOutcomes.Should().ContainSingle();
        dbRequirement.Responsibilities.Should().ContainSingle();
        dbRequirement.Capabilities.Should().ContainSingle();
        dbRequirement.TechnologyRequirements.Should().ContainSingle();

        // 3. Publish
        var snapshot = await service.PublishAsync(draft.Id, CancellationToken.None);
        snapshot.Should().NotBeNull();
        snapshot.Version.Should().Be(1);
        snapshot.HiringRequirementId.Should().Be(draft.Id);

        // Verify status changed to Published
        var publishedReq = await context.HiringRequirements.FindAsync(draft.Id);
        publishedReq!.Status.Should().Be("Published");

        // 4. Create New Version (clones published req to new draft version)
        var newVersionDraft = await service.CreateNewVersionAsync(draft.Id, CancellationToken.None);
        newVersionDraft.Should().NotBeNull();
        newVersionDraft.Status.Should().Be("Draft");
        newVersionDraft.Version.Should().Be(2);

        // Verify original published req remains published
        var originalReq = await context.HiringRequirements.FindAsync(draft.Id);
        originalReq!.Status.Should().Be("Published");
    }

    [Fact]
    public async Task UpdateDraftAsync_Should_Rollback_On_Transaction_Failure()
    {
        using var scope = Factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var service = scope.ServiceProvider.GetRequiredService<IHiringRequirementService>();

        var orgId = Guid.NewGuid();
        var workspaceId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        // Seed Organization & Workspace
        var user = new User { Id = userId, FullName = "Rollbacker", Email = "rb@cverify.com", Username = $"rb_{Guid.NewGuid().ToString("N").Substring(0, 8)}" };
        var org = new Organization { Id = orgId, Name = "RB Corp", TaxCode = "RB123", Email = "rb@corp.com", Username = "rb_corp", OrganizationSize = "10" };
        var ws = new Workspace { Id = workspaceId, OrganizationId = orgId, DisplayName = "RB Team", Slug = "rb-team", OwnerId = userId };
        context.Users.Add(user);
        context.Organizations.Add(org);
        context.Workspaces.Add(ws);
        await context.SaveChangesAsync();

        var createRequest = new CreateHiringRequirementRequestDto(
            OrganizationSlug: "rb_corp",
            Title: "Backend Developer",
            Department: "Engineering",
            Seniority: "Senior",
            WorkplaceType: "Remote",
            City: "San Francisco",
            EmploymentType: "Full-Time",
            Headcount: 1
        );

        var draft = await service.CreateDraftAsync(createRequest, userId, CancellationToken.None);

        // Intentionally cause failure by passing an invalid capability ID not found in database to force catalog validation failure
        var mockCatalog = scope.ServiceProvider.GetRequiredService<ICapabilityCatalogService>();
        // Wait, the service uses catalog service. Let's pass a capability that we didn't mock or catalog validation rejects
        // Wait! In integration tests, the catalog service is a real database-backed service.
        // So any capabilityId not present in the capability catalog table will cause a validation check to throw or return false!
        var updateRequest = new UpdateHiringRequirementRequestDto(
            HiringReason: "Fail",
            BusinessProblem: null, Outcomes: null, Responsibilities: null,
            Capabilities: new List<RequirementCapabilityDto>
            {
                new("fake.capability.id", "Fake Cap", "Unknown", RequirementPriority.MustHave, OwnershipLevel.Contributor, 3)
            },
            Skills: null, SalaryMin: null, SalaryMax: null, Currency: null, TimezoneRange: null, DegreeRequirement: null, Benefits: null, LanguageRequirements: null,
            StartDate: null, EndDate: null, AutoCloseRule: null, CandidatesNeededCount: null, Headcount: null, SalaryPeriod: null, IsSalaryNegotiable: null, IsManuallyClosed: null
        );

        // Act
        Func<Task> act = async () => await service.UpdateDraftAsync(draft.Id, updateRequest, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ArgumentException>();

        // Verify database rollback: hiring requirement title and fields should remain unchanged, no partial updates saved
        context.ChangeTracker.Clear();
        var dbReq = await context.HiringRequirements
            .Include(r => r.Capabilities)
            .FirstOrDefaultAsync(r => r.Id == draft.Id);

        dbReq!.HiringReason.Should().BeNull();
        dbReq.Capabilities.Should().BeEmpty();
    }
}
