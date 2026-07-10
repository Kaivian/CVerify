using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Reflection;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using FluentAssertions;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Profiles.Entities;
using CVerify.API.Modules.Profiles.Services;
using CVerify.API.Modules.Intelligence.Services;
using StackExchange.Redis;
using CVerify.API.Modules.Shared.System.Services;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Profiles.DTOs;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.SourceCode.Entities;

namespace CVerify.API.UnitTests.Services;

public class CandidateAssessmentExtraLogicTests : IDisposable
{
    private readonly ApplicationDbContext _context;
    private readonly Mock<IHttpClientFactory> _httpClientFactoryMock;
    private readonly Mock<ILogger<CandidateAssessmentService>> _loggerMock;
    private readonly Mock<ICandidateAssessmentQueue> _queueMock;
    private readonly Mock<IHmacSignatureService> _hmacServiceMock;
    private readonly Mock<IConnectionMultiplexer> _redisMock;
    private readonly Mock<IDatabase> _redisDbMock;
    private readonly Mock<ICandidateRepositoryProvider> _repositoryProviderMock;
    private readonly Mock<ICandidateEvaluationService> _evaluationServiceMock;
    private readonly Mock<ISkillTreeValidationService> _validationServiceMock;
    private readonly Mock<IAiStreamingSessionService> _streamingSessionServiceMock;
    private readonly Mock<IAiCancellationManager> _cancellationManagerMock;
    private readonly Mock<ICandidateRankingProjectionService> _rankingProjectionServiceMock;

    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _assessmentId = Guid.NewGuid();
    private readonly Guid _jobId = Guid.NewGuid();
    private readonly Guid _repoId = Guid.NewGuid();

    public CandidateAssessmentExtraLogicTests()
    {
        var dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        _context = new ApplicationDbContext(dbOptions);

        _httpClientFactoryMock = new Mock<IHttpClientFactory>();
        _loggerMock = new Mock<ILogger<CandidateAssessmentService>>();
        _queueMock = new Mock<ICandidateAssessmentQueue>();
        _hmacServiceMock = new Mock<IHmacSignatureService>();
        _redisMock = new Mock<IConnectionMultiplexer>();
        _redisDbMock = new Mock<IDatabase>();
        _repositoryProviderMock = new Mock<ICandidateRepositoryProvider>();
        _evaluationServiceMock = new Mock<ICandidateEvaluationService>();
        _validationServiceMock = new Mock<ISkillTreeValidationService>();
        _streamingSessionServiceMock = new Mock<IAiStreamingSessionService>();
        _cancellationManagerMock = new Mock<IAiCancellationManager>();
        _rankingProjectionServiceMock = new Mock<ICandidateRankingProjectionService>();

        _hmacServiceMock.Setup(h => h.CreateSignatureHeaders(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
            .Returns(("mock-sig", "1234567890", "nonce-val"));
        
        var mockSubscriber = new Mock<ISubscriber>();
        _redisMock.Setup(r => r.GetDatabase(It.IsAny<int>(), It.IsAny<object>())).Returns(_redisDbMock.Object);
        _redisMock.Setup(r => r.GetSubscriber(It.IsAny<object>())).Returns(mockSubscriber.Object);
    }

    private CandidateAssessmentService CreateService()
    {
        return new CandidateAssessmentService(
            _context,
            _queueMock.Object,
            _httpClientFactoryMock.Object,
            _hmacServiceMock.Object,
            _redisMock.Object,
            _repositoryProviderMock.Object,
            _loggerMock.Object,
            _evaluationServiceMock.Object,
            _validationServiceMock.Object,
            _streamingSessionServiceMock.Object,
            _cancellationManagerMock.Object,
            _rankingProjectionServiceMock.Object
        );
    }

    private async Task SetupDefaultTestDataAsync()
    {
        var user = new User { Id = _userId, FullName = "Candidate Name", Email = "candidate@email.com", Username = "candidatetest", Status = UserStatus.ACTIVE };
        var profile = new UserProfile { UserId = _userId, Username = "candidatetest", ProfileVisibility = "public", Headline = "Dev", Bio = "Bio" };
        _context.Users.Add(user);
        _context.UserProfiles.Add(profile);

        var repo = new SourceCodeRepository { Id = _repoId, Name = "test-repo", IsEnabled = true, Owner = "own", OwnerLogin = "own", OwnerType = "User", ExternalRepositoryId = "123" };
        var project = new ProjectEntry { Id = Guid.NewGuid(), UserId = _userId, Name = "project", Description = "desc", VerificationLevel = ProjectVerificationLevel.AiAnalyzed };
        var link = new ProjectRepositoryLink { Id = Guid.NewGuid(), ProjectEntryId = project.Id, ProjectEntry = project, SourceCodeRepositoryId = _repoId, SourceCodeRepository = repo };
        _context.SourceCodeRepositories.Add(repo);
        _context.ProjectEntries.Add(project);
        _context.ProjectRepositoryLinks.Add(link);

        var job = new AnalysisJob { Id = _jobId, RepositoryId = _repoId, UserId = _userId, Status = "Completed", CommitSha = "sha" };
        _context.AnalysisJobs.Add(job);

        var assessment = new CandidateAssessment { Id = _assessmentId, UserId = _userId, Status = "Completed", OverallScore = 60.0, TrustLevel = 80.0, CreatedAtUtc = DateTimeOffset.UtcNow };
        var repoAssess = new RepositoryAssessment
        {
            Id = _assessmentId,
            RepositoryId = _repoId,
            AnalysisJobId = _jobId,
            CommitSha = "sha",
            Status = "Completed",
            OverallScore = 70.0,
            PipelineVersion = "2.2.0",
            ModelVersion = "claude-haiku-4-5-20251001",
            PromptVersion = "v2.1.0-scoringV2-projectionV2",
            AssessmentSchemaVersion = "1.1.0"
        };
        _context.CandidateAssessments.Add(assessment);
        _context.RepositoryAssessments.Add(repoAssess);

        await _context.SaveChangesAsync();
    }

    private async Task InvokeProjectRelationalDataAsync(CandidateAssessmentService service, double overallScore)
    {
        var method = typeof(CandidateAssessmentService).GetMethod("ProjectRelationalDataAsync", BindingFlags.NonPublic | BindingFlags.Instance);
        var task = (Task)method!.Invoke(service, new object[] { _assessmentId, _jobId, overallScore, CancellationToken.None })!;
        await task;
    }

    [Fact]
    public async Task ProjectRelationalData_IdempotencyCheck_CAD_MAP_010()
    {
        // Arrange
        await SetupDefaultTestDataAsync();
        
        // Seed an existing capability to trigger idempotency exit
        var cap = new RepositoryCapability
        {
            Id = Guid.NewGuid(),
            RepositoryAssessmentId = _assessmentId,
            Name = "ExistingCap",
            Category = "core",
            Maturity = "Basic"
        };
        _context.RepositoryCapabilities.Add(cap);
        await _context.SaveChangesAsync();

        var task = new AnalysisTask { Id = Guid.NewGuid(), JobId = _jobId, TaskType = "SkillExtraction", Status = "Completed" };
        var result = new AnalysisTaskResult { TaskId = task.Id, Task = task, ResultData = "{ \"data\": { \"skills\": [] } }" };
        _context.AnalysisTasks.Add(task);
        _context.AnalysisTaskResults.Add(result);
        await _context.SaveChangesAsync();

        var service = CreateService();

        // Act
        await InvokeProjectRelationalDataAsync(service, 80.0);

        // Assert - verify no skill attributions were added because it exited early
        var attributions = await _context.RepositorySkillAttributions.ToListAsync();
        attributions.Should().BeEmpty();
    }

    [Fact]
    public async Task ProjectRelationalData_CorruptSkillExtractionJson_CAD_MAP_011()
    {
        // Arrange
        await SetupDefaultTestDataAsync();
        
        var task = new AnalysisTask { Id = Guid.NewGuid(), JobId = _jobId, TaskType = "SkillExtraction", Status = "Completed" };
        var result = new AnalysisTaskResult { TaskId = task.Id, Task = task, ResultData = "{ invalid-json }" };
        _context.AnalysisTasks.Add(task);
        _context.AnalysisTaskResults.Add(result);
        await _context.SaveChangesAsync();

        var service = CreateService();

        // Act & Assert (Should not throw)
        Func<Task> act = async () => await InvokeProjectRelationalDataAsync(service, 80.0);
        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task ProjectRelationalData_EvidenceJsonSerialization_CAD_PROF_007()
    {
        // Arrange
        await SetupDefaultTestDataAsync();

        var featuresJson = @"{
            ""data"": {
                ""features"": [
                    { ""name"": ""FeatureWithEvidence"", ""category"": ""core"", ""complexity_score"": 5.0, ""description"": ""Detail description"", ""evidence"": [""line_1"", ""line_2""] }
                ]
            }
        }";

        var task = new AnalysisTask { Id = Guid.NewGuid(), JobId = _jobId, TaskType = "FeatureExtraction", Status = "Completed" };
        var result = new AnalysisTaskResult { TaskId = task.Id, Task = task, ResultData = featuresJson };
        _context.AnalysisTasks.Add(task);
        _context.AnalysisTaskResults.Add(result);
        await _context.SaveChangesAsync();

        var service = CreateService();

        // Act
        await InvokeProjectRelationalDataAsync(service, 80.0);

        // Assert
        var cap = await _context.RepositoryCapabilities.FirstOrDefaultAsync(c => c.Name == "FeatureWithEvidence");
        cap.Should().NotBeNull();
        cap!.EvidenceJson.Should().NotBeNullOrEmpty();
        cap.EvidenceJson.Should().Contain("Detail description");
        cap.EvidenceJson.Should().Contain("line_1");
        cap.EvidenceJson.Should().Contain("line_2");
    }

    [Fact]
    public async Task ProjectRelationalData_OwnershipSignalScale_CAD_PROF_008()
    {
        // Arrange
        await SetupDefaultTestDataAsync();

        var task = new AnalysisTask { Id = Guid.NewGuid(), JobId = _jobId, TaskType = "Ownership", Status = "Completed" };
        var result = new AnalysisTaskResult { TaskId = task.Id, Task = task, ResultData = "{ \"data\": { \"ownership_score\": 0.85 } }" };
        _context.AnalysisTasks.Add(task);
        _context.AnalysisTaskResults.Add(result);
        await _context.SaveChangesAsync();

        var service = CreateService();

        // Act
        await InvokeProjectRelationalDataAsync(service, 80.0);

        // Assert
        var signal = await _context.RepositoryIntelligenceSignals.FirstOrDefaultAsync(s => s.RepositoryAssessmentId == _assessmentId);
        signal.Should().NotBeNull();
        signal!.OwnershipSignal.Should().Be(85.0); // scaled by 100 since original was <= 1.0
    }

    [Fact]
    public async Task ProjectRelationalData_TrustScoreAndCommitSignals_CAD_PROF_009()
    {
        // Arrange
        await SetupDefaultTestDataAsync();

        var trustTask = new AnalysisTask { Id = Guid.NewGuid(), JobId = _jobId, TaskType = "TrustScore", Status = "Completed" };
        var trustResult = new AnalysisTaskResult { TaskId = trustTask.Id, Task = trustTask, ResultData = @"{
            ""data"": {
                ""dimensions"": {
                    ""code_quality"": 85.0,
                    ""complexity"": 75.0,
                    ""commit_integrity"": 90.0
                }
            }
        }" };
        
        var commitTask = new AnalysisTask { Id = Guid.NewGuid(), JobId = _jobId, TaskType = "CommitIntelligence", Status = "Completed" };
        var commitResult = new AnalysisTaskResult { TaskId = commitTask.Id, Task = commitTask, ResultData = @"{
            ""data"": {
                ""ownership"": {
                    ""user_commit_ratio"": 0.9,
                    ""is_primary_author"": true
                }
            }
        }" };

        _context.AnalysisTasks.AddRange(trustTask, commitTask);
        _context.AnalysisTaskResults.AddRange(trustResult, commitResult);
        await _context.SaveChangesAsync();

        var service = CreateService();

        // Act
        await InvokeProjectRelationalDataAsync(service, 80.0);

        // Assert
        var signal = await _context.RepositoryIntelligenceSignals.FirstOrDefaultAsync(s => s.RepositoryAssessmentId == _assessmentId);
        signal.Should().NotBeNull();
        signal!.ScopeSignal.Should().Be(85.0);
        signal.ComplexitySignal.Should().Be(75.0);
        signal.ConsistencySignal.Should().Be(90.0);
        signal.LeadershipSignal.Should().Be(90.0); // 0.9 * 100.0 since is_primary_author is true
    }

    [Fact]
    public async Task ProjectRelationalData_CorruptFeatureExtractionJson_CAD_PROF_010()
    {
        // Arrange
        await SetupDefaultTestDataAsync();
        
        var task = new AnalysisTask { Id = Guid.NewGuid(), JobId = _jobId, TaskType = "FeatureExtraction", Status = "Completed" };
        var result = new AnalysisTaskResult { TaskId = task.Id, Task = task, ResultData = "{ invalid-json }" };
        _context.AnalysisTasks.Add(task);
        _context.AnalysisTaskResults.Add(result);
        await _context.SaveChangesAsync();

        var service = CreateService();

        // Act & Assert (Should not throw)
        Func<Task> act = async () => await InvokeProjectRelationalDataAsync(service, 80.0);
        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task ReprocessAssessmentAsync_PopulatesRelationalTablesAndTriggersSideEffects_CAD_CAL_005_To_009_CAD_CAL_010_011()
    {
        // Arrange
        await SetupDefaultTestDataAsync();

        var serviceResponseJson = @"{
            ""schemaVersion"": ""candidate-profile-v2"",
            ""candidateScore"": 85.0,
            ""careerLevel"": ""L3"",
            ""careerLevelLabel"": ""Senior"",
            ""primaryTendency"": ""Backend"",
            ""primaryWorkingStyle"": ""System Designer"",
            ""recruiterHeadline"": ""Senior Dev"",
            ""fullSummary"": ""Summary"",
            ""professionalBio"": ""Bio"",
            ""technicalDepth"": 80.0,
            ""technicalBreadth"": 70.0,
            ""leadershipPotential"": 75.0,
            ""executionStrength"": 90.0,
            ""trustLevel"": 95.0,
            ""trustScoreMetrics"": {
                ""verifiedSkillRatio"": 0.9,
                ""verifiedRepositoryRatio"": 1.0,
                ""verifiedEvidenceRatio"": 0.85,
                ""candidateTrustScore"": 95.0
            },
            ""skills"": [
                { ""skillName"": ""C#"", ""score"": 90.0, ""confidence"": 0.95, ""level"": ""Expert"", ""evidenceSources"": ""repos"" }
            ],
            ""domainProfiles"": [
                { ""domainName"": ""Backend Engineering"", ""score"": 85.0, ""confidence"": 0.9, ""seniority"": ""Senior"", ""supportingEvidence"": ""all"" }
            ],
            ""capabilityVector"": {
                ""dimensions"": {
                    ""ownership"": 80.0
                }
            },
            ""engineeringMaturityScore"": 75.0,
            ""problemSolvingScore"": 85.0,
            ""bestFitRoles"": [
                { ""roleTitle"": ""Software Architect"", ""matchScore"": 95.0, ""confidence"": 0.95, ""rank"": 1, ""matchingEngineVersion"": ""V2"", ""evidence"": ""none"" }
            ],
            ""strengthsWeaknesses"": [
                { ""findingType"": ""Strength"", ""topic"": ""Clean Code"", ""description"": ""Follows SOLID"", ""evidence"": ""prs"" }
            ]
        }";

        SetupMockHttpClient(serviceResponseJson, HttpStatusCode.OK);
        var service = CreateService();

        // Act
        await service.ReprocessAssessmentAsync(_assessmentId, CancellationToken.None);

        // Assert relational tables populated
        var skills = await _context.CandidateSkills.Where(s => s.CandidateAssessmentId == _assessmentId).ToListAsync();
        skills.Should().ContainSingle(s => s.SkillName == "C#");

        var domains = await _context.CandidateDomainProfiles.Where(d => d.CandidateAssessmentId == _assessmentId).ToListAsync();
        domains.Should().ContainSingle(d => d.DomainName == "Backend Engineering");

        var signals = await _context.CandidateIntelligenceSignals.Where(s => s.CandidateAssessmentId == _assessmentId).ToListAsync();
        signals.Should().ContainSingle();
        signals.First().OwnershipSignal.Should().Be(80.0);
        signals.First().EngineeringMaturitySignal.Should().Be(75.0);
        signals.First().ProblemSolvingSignal.Should().Be(85.0);

        var roles = await _context.CandidateBestFitRoles.Where(r => r.CandidateAssessmentId == _assessmentId).ToListAsync();
        roles.Should().ContainSingle(r => r.RoleTitle == "Software Architect");

        var sw = await _context.CandidateStrengthsWeaknesses.Where(x => x.CandidateAssessmentId == _assessmentId).ToListAsync();
        sw.Should().ContainSingle(x => x.Topic == "Clean Code");

        // Assert side-effects triggered
        _rankingProjectionServiceMock.Verify(r => r.RebuildRankingProjectionsAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SaveCandidateRelationalProfile_IdempotencyClearOldRecords_CAD_SC_003()
    {
        // Arrange
        await SetupDefaultTestDataAsync();

        // Seed old relational records for this assessment
        _context.CandidateSkills.Add(new CandidateSkill { Id = Guid.NewGuid(), CandidateAssessmentId = _assessmentId, SkillName = "OldSkill", Level = "Working" });
        _context.CandidateDomainProfiles.Add(new CandidateDomainProfile { Id = Guid.NewGuid(), CandidateAssessmentId = _assessmentId, DomainName = "OldDomain", Seniority = "Middle" });
        await _context.SaveChangesAsync();

        var rootJson = @"{
            ""schemaVersion"": ""candidate-profile-v2"",
            ""skills"": [
                { ""skillName"": ""NewSkill"", ""score"": 90.0, ""confidence"": 0.95, ""level"": ""Expert"" }
            ],
            ""trustScoreMetrics"": {
                ""verifiedSkillRatio"": 0.9,
                ""verifiedRepositoryRatio"": 1.0,
                ""verifiedEvidenceRatio"": 0.85,
                ""candidateTrustScore"": 95.0
            }
        }";

        using var doc = JsonDocument.Parse(rootJson);
        var service = CreateService();

        // Act
        var method = typeof(CandidateAssessmentService).GetMethod("SaveCandidateRelationalProfileAsync", BindingFlags.NonPublic | BindingFlags.Instance);
        var task = (Task)method!.Invoke(service, new object[] { _assessmentId, doc.RootElement, CancellationToken.None })!;
        await task;

        // Assert old records cleared, new records saved
        var skills = await _context.CandidateSkills.Where(s => s.CandidateAssessmentId == _assessmentId).ToListAsync();
        skills.Should().HaveCount(1);
        skills.First().SkillName.Should().Be("NewSkill");

        var domains = await _context.CandidateDomainProfiles.Where(d => d.CandidateAssessmentId == _assessmentId).ToListAsync();
        domains.Should().BeEmpty();
    }

    [Fact]
    public async Task GetPublicAssessment_FiltersOutPrivateProfiles_CAD_SC_007()
    {
        // Arrange
        await SetupDefaultTestDataAsync();

        // Set visibility to private
        var profile = await _context.UserProfiles.FirstOrDefaultAsync(u => u.UserId == _userId);
        profile!.ProfileVisibility = "private";
        await _context.SaveChangesAsync();

        var service = CreateService();

        // Act
        var result = await service.GetLatestPublicAssessmentAsync("candidatetest", CancellationToken.None);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task GetPublicAssessment_FiltersOutNonPublicArtifactTypes_CAD_SC_008()
    {
        // Arrange
        await SetupDefaultTestDataAsync();

        _context.CandidateAssessmentArtifacts.AddRange(
            new CandidateAssessmentArtifact { Id = Guid.NewGuid(), AssessmentId = _assessmentId, ArtifactType = "CandidateProfile", JsonData = "{}" },
            new CandidateAssessmentArtifact { Id = Guid.NewGuid(), AssessmentId = _assessmentId, ArtifactType = "SkillTree", JsonData = "{}" }, // Non-public type
            new CandidateAssessmentArtifact { Id = Guid.NewGuid(), AssessmentId = _assessmentId, ArtifactType = "ImprovementPlan", JsonData = "{}" } // Non-public type
        );
        await _context.SaveChangesAsync();

        var service = CreateService();

        // Act
        var result = await service.GetLatestPublicAssessmentAsync("candidatetest", CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result!.Artifacts.Should().ContainSingle();
        result.Artifacts.First().ArtifactType.Should().Be("CandidateProfile");
    }

    [Fact]
    public async Task BuildSkillTreeFromDb_BuildsHierarchicalTree_CAD_SC_009_010()
    {
        // Arrange
        await SetupDefaultTestDataAsync();

        var rootNodeId = Guid.NewGuid();
        var childNodeId = Guid.NewGuid();

        _context.CandidateSkillTreeNodes.AddRange(
            new CandidateSkillTreeNode
            {
                Id = rootNodeId,
                CandidateAssessmentId = _assessmentId,
                ParentId = null,
                DisplayName = "Programming Languages",
                Category = "backend",
                ProficiencyLevel = "Working"
            },
            new CandidateSkillTreeNode
            {
                Id = childNodeId,
                CandidateAssessmentId = _assessmentId,
                ParentId = rootNodeId,
                DisplayName = "C#",
                Category = "backend",
                ProficiencyLevel = "Working"
            }
        );
        await _context.SaveChangesAsync();

        var service = CreateService();

        // Act
        var result = await service.GetSkillTreeAsync(_userId, _assessmentId, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result!.Should().ContainSingle();
        result.First().Id.Should().Be(rootNodeId);
        result.First().Children.Should().ContainSingle();
        result.First().Children.First().Id.Should().Be(childNodeId);
    }

    private void SetupMockHttpClient(string responseContent, HttpStatusCode statusCode)
    {
        var handler = new MockHttpMessageHandler(responseContent, statusCode);
        var client = new HttpClient(handler)
        {
            BaseAddress = new Uri("http://localhost:8000")
        };
        _httpClientFactoryMock.Setup(f => f.CreateClient(It.IsAny<string>())).Returns(client);
    }

    private class MockHttpMessageHandler : HttpMessageHandler
    {
        private readonly string _response;
        private readonly HttpStatusCode _statusCode;

        public MockHttpMessageHandler(string response, HttpStatusCode statusCode)
        {
            _response = response;
            _statusCode = statusCode;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            return Task.FromResult(new HttpResponseMessage
            {
                StatusCode = _statusCode,
                Content = new StringContent(_response, System.Text.Encoding.UTF8, "application/json")
            });
        }
    }

    public void Dispose()
    {
        _context.Dispose();
    }
}
