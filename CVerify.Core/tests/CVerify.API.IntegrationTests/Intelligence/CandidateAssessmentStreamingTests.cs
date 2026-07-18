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
using CVerify.API.Modules.Auth.Entities;
using CVerify.API.Modules.SourceCode.Entities;
using CVerify.API.Modules.Profiles.Services;

namespace CVerify.API.IntegrationTests.Intelligence;

[Collection("Shared Containers Collection")]
public class CandidateAssessmentStreamingTests : BaseIntegrationTest
{
    private static readonly WireMockServer _wireMockServer = WireMockServer.Start();

    public CandidateAssessmentStreamingTests(SharedTestcontainerFixture containerFixture)
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
    public async Task Streaming_ShouldSucceed_WhenValidSseEventsYielded()
    {
        using var scope = Factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var candidateId = Guid.NewGuid();

        var user = MatchingTestFixtures.CreateCandidateUser(candidateId, "Stream User", "stream@cverify.com", "stream_user");
        var userProfile = MatchingTestFixtures.CreateCandidateProfile(candidateId, "stream_user", "Developer", "Bio", "New York");
        context.Users.Add(user);
        context.UserProfiles.Add(userProfile);
        await context.SaveChangesAsync();

        await SeedCompletedRepositoryAsync(context, candidateId);

        var sseProgressMock = new List<object>
        {
            new { status = "Running", step = "FetchLine1", percentage = 15.0, message = "In progress..." },
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

        var assessmentService = scope.ServiceProvider.GetRequiredService<ICandidateAssessmentService>();
        var triggerResp = await assessmentService.TriggerAssessmentAsync(candidateId, CancellationToken.None);
        var assessmentId = triggerResp.Id;

        await assessmentService.ProcessAssessmentJobAsync(assessmentId, CancellationToken.None);

        var assessment = await context.CandidateAssessments.FindAsync(assessmentId);
        assessment.Should().NotBeNull();
        assessment!.Status.Should().Be("Completed");
        assessment.PipelineVersion.Should().Be("2.2.0");

        var cvProfile = await context.CandidateAssessmentArtifacts.FirstOrDefaultAsync(p => p.AssessmentId == assessmentId && p.ArtifactType == "CandidateProfile");
        cvProfile.Should().NotBeNull();
        cvProfile!.JsonData.Should().Contain("Senior");
        cvProfile.JsonData.Should().Contain("Frontend");
    }

    [Fact]
    public async Task Streaming_ShouldTransitionToFailed_WhenTaskEmitsFailedStatus()
    {
        using var scope = Factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var candidateId = Guid.NewGuid();
        var user = MatchingTestFixtures.CreateCandidateUser(candidateId, "Fail User", "fail@cverify.com", "fail_user");
        var userProfile = MatchingTestFixtures.CreateCandidateProfile(candidateId, "fail_user", "Developer", "Bio", "New York");
        context.Users.Add(user);
        context.UserProfiles.Add(userProfile);
        await context.SaveChangesAsync();

        await SeedCompletedRepositoryAsync(context, candidateId);

        var sb = new StringBuilder();
        sb.Append("data: {\"status\": \"Failed\", \"step\": \"SkillTaxonomyMapper\", \"message\": \"LLM API Rate Limit Exception\", \"percentage\": 20.0}\n\n");

        _wireMockServer
            .Given(Request.Create().WithPath("/api/v1/candidate/assess/stream").UsingPost())
            .RespondWith(Response.Create()
                .WithHeader("Content-Type", "text/event-stream")
                .WithBody(sb.ToString())
                .WithStatusCode(200));

        var assessmentService = scope.ServiceProvider.GetRequiredService<ICandidateAssessmentService>();
        var triggerResp = await assessmentService.TriggerAssessmentAsync(candidateId, CancellationToken.None);
        var assessmentId = triggerResp.Id;

        await assessmentService.ProcessAssessmentJobAsync(assessmentId, CancellationToken.None);

        var failedAssessment = await context.CandidateAssessments.FindAsync(assessmentId);
        failedAssessment.Should().NotBeNull();
        failedAssessment!.Status.Should().Be("Failed");
        failedAssessment.FailureReason.Should().Contain("Rate Limit Exception");
    }
}
