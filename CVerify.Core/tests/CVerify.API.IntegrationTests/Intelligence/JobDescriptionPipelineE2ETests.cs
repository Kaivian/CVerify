using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using FluentAssertions;
using WireMock.Server;
using WireMock.RequestBuilders;
using WireMock.ResponseBuilders;
using CVerify.API.IntegrationTests.Fixtures;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.System.DTOs;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.IntegrationTests.Intelligence;

[Collection("Shared Containers Collection")]
public class JobDescriptionPipelineE2ETests : BaseIntegrationTest
{
    private static readonly WireMockServer _wireMockServer = WireMockServer.Start();

    public JobDescriptionPipelineE2ETests(SharedTestcontainerFixture containerFixture)
        : base(containerFixture, new Dictionary<string, string> { { "AI_SERVICE_URL", _wireMockServer.Url } })
    {
    }

    [Fact]
    public async Task E2E_JobDescriptionPipeline_Should_Stream_Parse_And_Sync_All_Artifacts()
    {
        // 1. Arrange - Seed database context
        using var scope = Factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var service = scope.ServiceProvider.GetRequiredService<IHiringRequirementService>();

        var orgId = Guid.NewGuid();
        var workspaceId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var requirementId = Guid.NewGuid();

        var user = new User { Id = userId, FullName = "E2E Orchestrator", Email = "orch@cverify.com", Username = $"orch_{Guid.NewGuid().ToString("N").Substring(0, 8)}" };
        var org = new Organization { Id = orgId, Name = "Orch Corp", TaxCode = "ORCH123", Email = "orch@corp.com", Username = "orch_corp", OrganizationSize = "50" };
        var ws = new Workspace { Id = workspaceId, OrganizationId = orgId, DisplayName = "Orch Team", Slug = "orch-team", OwnerId = userId };
        context.Users.Add(user);
        context.Organizations.Add(org);
        context.Workspaces.Add(ws);

        // Seed Hiring Requirement with some capabilities so the payload is fully formed
        var hiringReq = new HiringRequirement
        {
            Id = requirementId,
            OrganizationId = orgId,
            WorkspaceId = workspaceId,
            Title = "Senior QA Engineer",
            Department = "Engineering",
            Seniority = "Senior",
            WorkplaceType = "Remote",
            EmploymentType = "Full-Time",
            Headcount = 1,
            Status = "Draft",
            Version = 1,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        context.HiringRequirements.Add(hiringReq);

        var cap = new RequirementCapability
        {
            Id = Guid.NewGuid(),
            HiringRequirementId = requirementId,
            CapabilityId = "qa.automation",
            Name = "QA Automation",
            Category = "QA",
            Priority = RequirementPriority.MustHave,
            OwnershipLevel = OwnershipLevel.Owner,
            ExpectedProficiency = 4
        };
        context.RequirementCapabilities.Add(cap);

        // Seed a dummy job vacancy linked to the requirement
        var vacancy = new JobVacancy
        {
            Id = Guid.NewGuid(),
            OrganizationId = orgId,
            HiringRequirementId = requirementId,
            Title = "Senior QA Engineer",
            Department = "Engineering",
            WorkplaceType = "Remote",
            City = "San Jose",
            Type = "Full-Time",
            Experience = "Senior",
            Salary = "Negotiable",
            SalaryMinMax = "0 - 0",
            Gender = "No requirement",
            Degree = "Bachelor",
            Category = "Software Development",
            CoverUrl = "https://example.com/cover.png",
            Headcount = 1,
            IsActive = false,
            Status = "Draft",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        context.JobVacancies.Add(vacancy);
        await context.SaveChangesAsync();

        // 2. Setup WireMock for AI Service endpoints
        var sseProgressMock = new List<object>
        {
            new { status = "Running", step = "GenerateUnifiedRequirements", percentage = 10.0, message = "In progress..." },
            new {
                status = "Running",
                step = "RequirementArtifactsComposer",
                percentage = 40.0,
                message = "Yielding JobDescription...",
                artifactType = "JobDescription",
                jsonData = JsonSerializer.Serialize(new
                {
                    structuredContent = new
                    {
                        jobTitle = "Senior QA Engineer",
                        department = "Engineering",
                        summary = "Write nice tests.",
                        responsibilities = new List<string> { "Test code." },
                        skills = new List<string> { "qa.automation" }
                    },
                    markdownContent = "# Senior QA Engineer\n\n- Test code."
                })
            },
            new {
                status = "Running",
                step = "RequirementArtifactsComposer",
                percentage = 60.0,
                message = "Yielding EvaluationRubric...",
                artifactType = "EvaluationRubric",
                jsonData = JsonSerializer.Serialize(new
                {
                    scoringRules = new
                    {
                        minimumMaturityThreshold = "Practitioner",
                        selfDeclaredMatchCeiling = 0.40,
                        additionalRules = new List<string>()
                    },
                    evidenceRequirements = new List<object>()
                })
            },
            new {
                status = "Running",
                step = "RequirementArtifactsComposer",
                percentage = 80.0,
                message = "Yielding InterviewBlueprint...",
                artifactType = "InterviewBlueprint",
                jsonData = JsonSerializer.Serialize(new
                {
                    questions = new List<object>(),
                    dimensions = new List<string> { "QA Hygiene" }
                })
            },
            new {
                status = "Running",
                step = "RequirementArtifactsComposer",
                percentage = 90.0,
                message = "Yielding JobPostMetadata...",
                artifactType = "JobPostMetadata",
                jsonData = JsonSerializer.Serialize(new
                {
                    experienceRange = "5+ years",
                    degreeRequirement = "Bachelor's",
                    industryCategory = "QA Testing",
                    coverUrl = "http://image.url",
                    tags = new List<string> { "QA", "Automation" }
                })
            },
            new {
                status = "Running",
                step = "RequirementArtifactsComposer",
                percentage = 95.0,
                message = "Yielding CandidateDiscoveryProfile...",
                artifactType = "CandidateDiscoveryProfile",
                jsonData = JsonSerializer.Serialize(new
                {
                    keyKeywords = new List<string> { "Playwright" },
                    minimumYearsOfExperience = 5,
                    priorityWeights = new Dictionary<string, float> { { "qa.automation", 1.0f } },
                    trustRequirements = new Dictionary<string, object>()
                })
            },
            new { status = "Completed", step = "Completed", percentage = 100.0, message = "Done!" }
        };

        var sb = new StringBuilder();
        foreach (var p in sseProgressMock)
        {
            sb.Append($"data: {JsonSerializer.Serialize(p)}\n\n");
        }
        sb.Append("data: [DONE]\n\n");

        _wireMockServer
            .Given(Request.Create().WithPath("/api/v1/hiring-requirements/generate/stream").UsingPost())
            .RespondWith(Response.Create()
                .WithHeader("Content-Type", "text/event-stream; charset=utf-8")
                .WithBody(sb.ToString())
                .WithStatusCode(200));

        // 3. Act - Trigger Artifacts Generation
        await service.GenerateArtifactsAsync(requirementId, userId, CancellationToken.None);

        // 4. Assert
        // Verify artifacts saved in PostgreSQL
        var artifacts = await context.RequirementArtifacts
            .Where(a => a.HiringRequirementId == requirementId)
            .ToListAsync();
        artifacts.Should().NotBeEmpty();
        artifacts.Any(a => a.ArtifactType == "JobDescription").Should().BeTrue();
        artifacts.Any(a => a.ArtifactType == "JobPostMetadata").Should().BeTrue();
        artifacts.Any(a => a.ArtifactType == "CandidateDiscoveryProfile").Should().BeTrue();

        // Verify Rubrics and Blueprints persisted
        var rubrics = await context.EvaluationRubrics
            .Where(r => r.HiringRequirementId == requirementId)
            .ToListAsync();
        rubrics.Should().NotBeEmpty();

        var blueprints = await context.InterviewBlueprints
            .Where(b => b.HiringRequirementId == requirementId)
            .ToListAsync();
        blueprints.Should().NotBeEmpty();

        // Verify JobVacancy is updated/sync'ed with metadata
        var updatedVacancy = await context.JobVacancies
            .FirstOrDefaultAsync(v => v.HiringRequirementId == requirementId);
        updatedVacancy.Should().NotBeNull();
        updatedVacancy!.Experience.Should().Be("5+ years");
        updatedVacancy.Degree.Should().Be("Bachelor's");
        updatedVacancy.Category.Should().Be("QA Testing");
        updatedVacancy.DiscoveryProfileJson.Should().Contain("Playwright");
    }
}
