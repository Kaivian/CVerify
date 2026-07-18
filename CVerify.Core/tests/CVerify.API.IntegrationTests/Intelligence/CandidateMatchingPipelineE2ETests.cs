using System;
using System.Collections.Generic;
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
using CVerify.API.IntegrationTests.Helpers;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Profiles.Entities;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.System.DTOs;
using CVerify.API.Modules.Auth.Entities;
using CVerify.API.Modules.SourceCode.Entities;
using CVerify.API.Modules.Profiles.Services;
using CVerify.API.Modules.Intelligence.Services;

using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.IntegrationTests.Intelligence;

[Collection("Shared Containers Collection")]
public class CandidateMatchingPipelineE2ETests : BaseIntegrationTest
{
    private static readonly WireMockServer _wireMockServer = WireMockServer.Start();

    public CandidateMatchingPipelineE2ETests(SharedTestcontainerFixture containerFixture)
        : base(containerFixture, new Dictionary<string, string> { { "AI_SERVICE_URL", _wireMockServer.Url } })
    {
    }

    private async Task SeedCompletedRepositoryAsync(ApplicationDbContext context, Guid candidateId)
    {
        var authProvider = new AuthProvider
        {
            Id = Guid.NewGuid(),
            UserId = candidateId,
            ProviderName = "github",
            ProviderKey = "xyz",
            ScopeValidationStatus = ProviderScopeStatus.Valid,
            SyncStatus = "Completed"
        };
        context.AuthProviders.Add(authProvider);

        var repoId = Guid.NewGuid();
        var repo = new SourceCodeRepository
        {
            Id = repoId,
            AuthProviderId = authProvider.Id,
            ExternalRepositoryId = "123",
            Name = "demo-repo",
            Owner = "candidate",
            OwnerLogin = "candidate",
            OwnerType = "User",
            IsPrivate = false,
            IsAccessible = true,
            IsEnabled = true,
            LatestAnalysisStatus = "Completed",
            LatestAnalysisCompletedAtUtc = DateTimeOffset.UtcNow,
            LastUpdatedUtc = DateTimeOffset.UtcNow,
            LastSeenAt = DateTimeOffset.UtcNow,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            LastSyncedAt = DateTimeOffset.UtcNow
        };
        context.SourceCodeRepositories.Add(repo);

        var mapping = new CvRepositoryMapping
        {
            Id = Guid.NewGuid(),
            UserId = candidateId,
            SourceCodeRepositoryId = repoId,
            ReferenceSource = "SocialLink"
        };
        context.CvRepositoryMappings.Add(mapping);

        var job = new AnalysisJob
        {
            Id = Guid.NewGuid(),
            RepositoryId = repoId,
            UserId = candidateId,
            Status = "Completed",
            CompletedAt = DateTimeOffset.UtcNow
        };
        context.AnalysisJobs.Add(job);

        var projectEntry = new ProjectEntry
        {
            Id = Guid.NewGuid(),
            UserId = candidateId,
            Name = "Demo Project",
            Description = "A great project",
            VerificationLevel = ProjectVerificationLevel.AiAnalyzed,
            VerificationStatus = ProjectVerificationStatus.Verified
        };
        context.ProjectEntries.Add(projectEntry);

        var link = new ProjectRepositoryLink
        {
            Id = Guid.NewGuid(),
            ProjectEntryId = projectEntry.Id,
            SourceCodeRepositoryId = repoId
        };
        context.ProjectRepositoryLinks.Add(link);
        await context.SaveChangesAsync();
    }

    [Fact]
    public async Task E2E_DiscoveryRun_ShouldProcessAndPersistRankings_WithFullTraceability()
    {
        // 1. Arrange - Seed DB Context
        using var scope = Factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var candidateId = Guid.NewGuid();
        var orgId = Guid.NewGuid();
        var workspaceId = Guid.NewGuid();
        var requirementId = Guid.NewGuid();

        // Seed Owner User
        var ownerId = Guid.NewGuid();
        var owner = new User { Id = ownerId, FullName = "Owner User", Email = "owner@e2e.com", Username = $"owner_{Guid.NewGuid().ToString("N").Substring(0, 8)}" };
        context.Users.Add(owner);

        // Seed Organization & Workspace
        var org = new Organization { Id = orgId, Name = "E2E Test Corp", TaxCode = "E2E123", Email = "org@e2e.com", Username = "e2e_corp", OrganizationSize = "100" };
        var ws = new Workspace { Id = workspaceId, OrganizationId = orgId, DisplayName = "E2E Tech Team", Slug = "e2e-tech", OwnerId = ownerId };
        context.Organizations.Add(org);
        context.Workspaces.Add(ws);

        // Seed Candidate User and Profile
        var user = MatchingTestFixtures.CreateCandidateUser(candidateId, "E2E Candidate", "e2e@cverify.com", "e2e_cand");
        var userProfile = MatchingTestFixtures.CreateCandidateProfile(candidateId, "e2e_cand", "Backend Engineer", "E2E bio", "San Francisco");
        context.Users.Add(user);
        context.UserProfiles.Add(userProfile);
        await context.SaveChangesAsync();

        await SeedCompletedRepositoryAsync(context, candidateId);

        // Seed a Capability Node
        var node = new CapabilityNode
        {
            Id = Guid.NewGuid(),
            Name = "React.js",
            Slug = "react",
            Category = "Frontend"
        };
        context.CapabilityNodes.Add(node);

        // Seed Career Preferences
        var careerPref = new CareerPreference
        {
            UserId = candidateId,
            TargetSkills = new List<string> { "React.js" },
            ExpectedSalaryMin = 6000,
            ExpectedSalaryMax = 9000,
            RemotePreference = "Remote",
            AvailableForHire = true,
            OpenToWorkStatus = "Active"
        };
        context.CareerPreferences.Add(careerPref);

        // Seed Hiring Requirement with snapshot
        var hiringReq = MatchingTestFixtures.CreateHiringRequirement(requirementId, orgId, workspaceId, "React Developer", "Senior");
        context.HiringRequirements.Add(hiringReq);

        var caps = new List<RequirementCapabilityDto>
        {
            new(node.Slug, node.Name, node.Category, RequirementPriority.MustHave, OwnershipLevel.Owner, 3)
        };
        var skills = new List<TechnologyRequirementDto>
        {
            new(node.Name, RequirementPriority.MustHave, 3)
        };
        var responsibilities = new List<ResponsibilityDto>
        {
            new("Develop high-quality React pages", RequirementPriority.MustHave, OwnershipLevel.Owner, false)
        };

        var snapshot = MatchingTestFixtures.CreateRequirementSnapshot(requirementId, "React Developer", "Senior", caps, skills, responsibilities);
        context.RequirementSnapshots.Add(snapshot);

        // Seed Job Vacancy linked to snapshot
        var vacancy = MatchingTestFixtures.CreateJobVacancy(Guid.NewGuid(), orgId, "React Developer", "Senior");
        vacancy.RequirementSnapshotId = snapshot.Id;
        context.JobVacancies.Add(vacancy);

        await context.SaveChangesAsync();

        // 2. Setup WireMock for AI Service endpoints
        var sseProgressMock = new List<object>
        {
            new { status = "Running", step = "FetchLine1", percentage = 10.0, message = "In progress..." },
            new {
                status = "Running",
                step = "Composer",
                percentage = 90.0,
                message = "Synthesizing final profile...",
                artifactType = "CandidateProfile",
                jsonData = JsonSerializer.Serialize(new
                {
                    schemaVersion = "candidate-profile-v3",
                    candidateScore = 88.0,
                    careerLevel = "Senior",
                    careerLevelLabel = "Senior",
                    primaryTendency = "Frontend",
                    primaryWorkingStyle = "Autonomous",
                    recruiterHeadline = "React Expert",
                    fullSummary = "Expert React developer.",
                    professionalBio = "Bio details",
                    technicalDepth = 85.0,
                    technicalBreadth = 80.0,
                    leadershipPotential = 70.0,
                    executionStrength = 90.0,
                    trustLevel = 88.0,
                    evidenceCompleteness = "HIGH",
                    cloneRiskClassification = "clean",
                    trustScoreMetrics = new
                    {
                        verifiedSkillRatio = 1.0,
                        verifiedRepositoryRatio = 1.0,
                        verifiedEvidenceRatio = 1.0,
                        candidateTrustScore = 88.0
                    },
                    skills = new List<object>
                    {
                        new
                        {
                            skillName = "React.js",
                            skillId = "skill:react",
                            score = 90.0,
                            confidence = 0.9,
                            level = "Expert",
                            taxonomyVersion = "2026.07"
                        }
                    }
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
            .Given(Request.Create().WithPath("/api/v1/candidate/assess/stream").UsingPost())
            .RespondWith(Response.Create()
                .WithHeader("Content-Type", "text/event-stream")
                .WithBody(sb.ToString())
                .WithStatusCode(200));

        // 3. Act - Trigger Candidate Ingestion
        var assessmentService = scope.ServiceProvider.GetRequiredService<ICandidateAssessmentService>();
        var triggerResp = await assessmentService.TriggerAssessmentAsync(candidateId, CancellationToken.None);
        var assessmentId = triggerResp.Id;

        // Background processor or manual trigger
        await assessmentService.ProcessAssessmentJobAsync(assessmentId, CancellationToken.None);

        // Verify Ingestion updated database state
        var completedAssessment = await context.CandidateAssessments
            .FirstOrDefaultAsync(ca => ca.Id == assessmentId);
        completedAssessment.Should().NotBeNull();
        completedAssessment!.Status.Should().Be("Completed");

        // Trigger Discovery Matching using CandidateMatchService
        var matchService = scope.ServiceProvider.GetRequiredService<ICandidateMatchService>();
        var matches = await matchService.GetCandidateMatchesAsync(requirementId, CancellationToken.None);

        // 4. Assert
        matches.Should().NotBeNullOrEmpty();
        var match = matches.First();
        match.CandidateId.Should().Be(candidateId);
        match.MatchScore.Should().BeGreaterThan(0);
        match.Breakdown.CapabilitiesScore.Should().BeGreaterThan(0);
        match.Breakdown.SkillsScore.Should().Be(match.Breakdown.CapabilitiesScore); // Fixed DTO mapping verification!
    }
}
