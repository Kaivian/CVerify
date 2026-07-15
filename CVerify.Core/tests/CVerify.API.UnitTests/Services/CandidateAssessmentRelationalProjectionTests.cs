using System;
using System.Collections.Generic;
using System.Net.Http;
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
using CVerify.API.Modules.SourceCode.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using System.Reflection;

namespace CVerify.API.UnitTests.Services;

public class CandidateAssessmentRelationalProjectionTests : IDisposable
{
    private readonly ApplicationDbContext _context;
    private readonly Mock<IHttpClientFactory> _httpClientFactoryMock;
    private readonly Mock<ILogger<CandidateAssessmentService>> _loggerMock;
    private readonly Mock<ICandidateAssessmentQueue> _queueMock;
    private readonly Mock<IHmacSignatureService> _hmacServiceMock;
    private readonly Mock<IConnectionMultiplexer> _mockRedis;
    private readonly Mock<ICandidateRepositoryProvider> _repositoryProviderMock;
    private readonly Mock<ICandidateEvaluationService> _evaluationServiceMock;
    private readonly Mock<ISkillTreeValidationService> _validationServiceMock;
    private readonly Mock<IAiStreamingSessionService> _streamingSessionServiceMock;
    private readonly Mock<IAiCancellationManager> _cancellationManagerMock;
    private readonly Mock<ICandidateRankingProjectionService> _rankingProjectionServiceMock;

    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _jobId = Guid.NewGuid();
    private readonly Guid _repoId = Guid.NewGuid();
    private readonly Guid _assessmentId = Guid.NewGuid();

    public CandidateAssessmentRelationalProjectionTests()
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
        _mockRedis = new Mock<IConnectionMultiplexer>();
        _repositoryProviderMock = new Mock<ICandidateRepositoryProvider>();
        _evaluationServiceMock = new Mock<ICandidateEvaluationService>();
        _validationServiceMock = new Mock<ISkillTreeValidationService>();
        _streamingSessionServiceMock = new Mock<IAiStreamingSessionService>();
        _cancellationManagerMock = new Mock<IAiCancellationManager>();
        _rankingProjectionServiceMock = new Mock<ICandidateRankingProjectionService>();
    }

    private CandidateAssessmentService CreateService()
    {
        return new CandidateAssessmentService(
            _context,
            _queueMock.Object,
            _httpClientFactoryMock.Object,
            _hmacServiceMock.Object,
            _mockRedis.Object,
            _repositoryProviderMock.Object,
            _loggerMock.Object,
            _evaluationServiceMock.Object,
            _validationServiceMock.Object,
            _streamingSessionServiceMock.Object,
            _cancellationManagerMock.Object,
            _rankingProjectionServiceMock.Object
        );
    }

    private async Task SetupRelationalTestDataAsync(
        string? skillResultJson,
        string? featureResultJson)
    {
        // 1. User and Profile
        var user = new User { Id = _userId, FullName = "Name", Email = "e@mail.com", Username = "user", Status = UserStatus.ACTIVE };
        var profile = new UserProfile { UserId = _userId, Username = "user", Headline = "Head", Bio = "Bio", LastProfileUpdateAt = DateTimeOffset.UtcNow };
        _context.Users.Add(user);
        _context.UserProfiles.Add(profile);

        // 2. Repository & Project Link
        var repo = new SourceCodeRepository { Id = _repoId, Name = "test-repo", IsEnabled = true, Owner = "own", OwnerLogin = "own", OwnerType = "User", ExternalRepositoryId = "123" };
        var project = new ProjectEntry { Id = Guid.NewGuid(), UserId = _userId, Name = "proj", Description = "proj description", VerificationLevel = ProjectVerificationLevel.AiAnalyzed };
        var link = new ProjectRepositoryLink { Id = Guid.NewGuid(), ProjectEntryId = project.Id, ProjectEntry = project, SourceCodeRepositoryId = _repoId, SourceCodeRepository = repo };
        _context.SourceCodeRepositories.Add(repo);
        _context.ProjectEntries.Add(project);
        _context.ProjectRepositoryLinks.Add(link);

        // 3. Analysis Job
        var job = new CVerify.API.Modules.SourceCode.Entities.AnalysisJob { Id = _jobId, RepositoryId = _repoId, UserId = _userId, Status = "Completed", CommitSha = "sha" };
        _context.AnalysisJobs.Add(job);

        // 4. Task Results
        if (skillResultJson != null)
        {
            var task = new AnalysisTask { Id = Guid.NewGuid(), JobId = _jobId, TaskType = "SkillExtraction", Status = "Completed" };
            var result = new AnalysisTaskResult { TaskId = task.Id, Task = task, ResultData = skillResultJson };
            _context.AnalysisTasks.Add(task);
            _context.AnalysisTaskResults.Add(result);
        }

        if (featureResultJson != null)
        {
            var task = new AnalysisTask { Id = Guid.NewGuid(), JobId = _jobId, TaskType = "FeatureExtraction", Status = "Completed" };
            var result = new AnalysisTaskResult { TaskId = task.Id, Task = task, ResultData = featureResultJson };
            _context.AnalysisTasks.Add(task);
            _context.AnalysisTaskResults.Add(result);
        }

        // 5. Candidate Assessment & Repository Assessment
        var candidateAssess = new CandidateAssessment { Id = _assessmentId, UserId = _userId, Status = "Completed", OverallScore = 80.0, TrustLevel = 90.0, CreatedAtUtc = DateTimeOffset.UtcNow };
        var repoAssess = new RepositoryAssessment
        {
            Id = _assessmentId,
            RepositoryId = _repoId,
            AnalysisJobId = _jobId,
            CommitSha = "sha",
            Status = "Completed",
            OverallScore = 85.0,
            PipelineVersion = "2.2.0",
            ModelVersion = "claude-haiku-4-5-20251001",
            PromptVersion = "v2.1.0-scoringV2-projectionV2",
            AssessmentSchemaVersion = "1.1.0"
        };
        _context.CandidateAssessments.Add(candidateAssess);
        _context.RepositoryAssessments.Add(repoAssess);

        await _context.SaveChangesAsync();
    }

    private async Task InvokeProjectRelationalDataAsync(CandidateAssessmentService service, double overallScore)
    {
        var method = typeof(CandidateAssessmentService).GetMethod("ProjectRelationalDataAsync", BindingFlags.NonPublic | BindingFlags.Instance);
        method.Should().NotBeNull();
        var task = (Task)method!.Invoke(service, new object[] { _assessmentId, _jobId, overallScore, CancellationToken.None })!;
        await task;
    }

    [Fact]
    public async Task ProjectRelationalData_Should_Map_SkillCategories_Successfully()
    {
        // Arrange
        var skillsJson = @"{
            ""data"": {
                ""skills"": [
                    { ""skill"": ""C#"", ""category"": ""backend"", ""confidence"": 90.0, ""evidence"": [""env1""] },
                    { ""skill"": ""React"", ""category"": ""frontend"", ""confidence"": 85.0, ""evidence"": [] },
                    { ""skill"": ""Docker"", ""category"": ""devops"", ""confidence"": 80.0, ""evidence"": [] }
                ]
            }
        }";

        await SetupRelationalTestDataAsync(skillsJson, null);
        var service = CreateService();

        // Act
        await InvokeProjectRelationalDataAsync(service, 85.0);

        // Assert
        var attributions = await _context.RepositorySkillAttributions.ToListAsync();
        attributions.Should().HaveCount(3);
        attributions.Should().Contain(a => a.SkillName == "C#");
        attributions.Should().Contain(a => a.SkillName == "React");
        attributions.Should().Contain(a => a.SkillName == "Docker");

        var domains = await _context.RepositoryDomains.ToListAsync();
        domains.Should().HaveCount(3);
        domains.Should().Contain(d => d.DomainName == "Backend Engineering");
        domains.Should().Contain(d => d.DomainName == "Frontend Engineering");
        domains.Should().Contain(d => d.DomainName == "DevOps & Platform Engineering");
    }

    [Fact]
    public async Task ProjectRelationalData_Should_Fallback_To_OtherEngineering_When_Category_Unknown()
    {
        // Arrange
        var skillsJson = @"{
            ""data"": {
                ""skills"": [
                    { ""skill"": ""C++"", ""category"": ""gaming"", ""confidence"": 90.0, ""evidence"": [] }
                ]
            }
        }";

        await SetupRelationalTestDataAsync(skillsJson, null);
        var service = CreateService();

        // Act
        await InvokeProjectRelationalDataAsync(service, 85.0);

        // Assert
        var domains = await _context.RepositoryDomains.ToListAsync();
        domains.Should().ContainSingle(d => d.DomainName == "Other Engineering");
    }

    [Fact]
    public async Task ProjectRelationalData_Should_Calculate_ContributionWeight_Correctly()
    {
        // Arrange
        var skillsJson = @"{
            ""data"": {
                ""skills"": [
                    { ""skill"": ""C#"", ""category"": ""backend"", ""confidence"": 90.0, ""evidence"": [] }
                ]
            }
        }";

        await SetupRelationalTestDataAsync(skillsJson, null);
        var service = CreateService();

        // Act
        await InvokeProjectRelationalDataAsync(service, 85.0);

        // Assert
        var attribution = await _context.RepositorySkillAttributions.FirstOrDefaultAsync(a => a.SkillName == "C#");
        attribution.Should().NotBeNull();
        // Formula: (overallScore / 100.0) * (confidence / 100.0)
        // overallScore passed is 85.0, confidence is 90.0
        // (85.0 / 100.0) * (90.0 / 100.0) = 0.85 * 0.9 = 0.765
        attribution!.ContributionWeight.Should().BeApproximately(0.765, 0.001);
        attribution.Confidence.Should().Be(0.90);
    }

    [Fact]
    public async Task ProjectRelationalData_Should_Map_Maturity_To_Basic_When_Complexity_Low()
    {
        // Arrange
        var featuresJson = @"{
            ""data"": {
                ""features"": [
                    { ""name"": ""Feature1"", ""category"": ""core"", ""complexity_score"": 2.5, ""description"": ""desc"", ""evidence"": [] }
                ]
            }
        }";

        await SetupRelationalTestDataAsync(null, featuresJson);
        var service = CreateService();

        // Act
        await InvokeProjectRelationalDataAsync(service, 85.0);

        // Assert
        var cap = await _context.RepositoryCapabilities.FirstOrDefaultAsync(c => c.Name == "Feature1");
        cap.Should().NotBeNull();
        cap!.Maturity.Should().Be("Basic");
    }

    [Fact]
    public async Task ProjectRelationalData_Should_Map_Maturity_To_Intermediate_When_Complexity_Medium()
    {
        // Arrange
        var featuresJson = @"{
            ""data"": {
                ""features"": [
                    { ""name"": ""Feature2"", ""category"": ""core"", ""complexity_score"": 5.5, ""description"": ""desc"", ""evidence"": [] }
                ]
            }
        }";

        await SetupRelationalTestDataAsync(null, featuresJson);
        var service = CreateService();

        // Act
        await InvokeProjectRelationalDataAsync(service, 85.0);

        // Assert
        var cap = await _context.RepositoryCapabilities.FirstOrDefaultAsync(c => c.Name == "Feature2");
        cap.Should().NotBeNull();
        cap!.Maturity.Should().Be("Intermediate");
    }

    [Fact]
    public async Task ProjectRelationalData_Should_Map_Maturity_To_Advanced_When_Complexity_High()
    {
        // Arrange
        var featuresJson = @"{
            ""data"": {
                ""features"": [
                    { ""name"": ""Feature3"", ""category"": ""core"", ""complexity_score"": 7.5, ""description"": ""desc"", ""evidence"": [] }
                ]
            }
        }";

        await SetupRelationalTestDataAsync(null, featuresJson);
        var service = CreateService();

        // Act
        await InvokeProjectRelationalDataAsync(service, 85.0);

        // Assert
        var cap = await _context.RepositoryCapabilities.FirstOrDefaultAsync(c => c.Name == "Feature3");
        cap.Should().NotBeNull();
        cap!.Maturity.Should().Be("Advanced");
    }

    [Fact]
    public async Task ProjectRelationalData_Should_Map_Maturity_To_Enterprise_When_Complexity_Max()
    {
        // Arrange
        var featuresJson = @"{
            ""data"": {
                ""features"": [
                    { ""name"": ""Feature4"", ""category"": ""core"", ""complexity_score"": 9.5, ""description"": ""desc"", ""evidence"": [] }
                ]
            }
        }";

        await SetupRelationalTestDataAsync(null, featuresJson);
        var service = CreateService();

        // Act
        await InvokeProjectRelationalDataAsync(service, 85.0);

        // Assert
        var cap = await _context.RepositoryCapabilities.FirstOrDefaultAsync(c => c.Name == "Feature4");
        cap.Should().NotBeNull();
        cap!.Maturity.Should().Be("Enterprise");
    }

    [Fact]
    public async Task ProjectRelationalData_Should_Calculate_ProficiencyScores_Correctly()
    {
        // Arrange
        var featuresJson = @"{
            ""data"": {
                ""features"": [
                    { ""name"": ""Feature1"", ""category"": ""core"", ""complexity_score"": 7.0, ""description"": ""desc"", ""evidence"": [] }
                ]
            }
        }";

        await SetupRelationalTestDataAsync(null, featuresJson);
        var service = CreateService();

        // Act
        await InvokeProjectRelationalDataAsync(service, 85.0);

        // Assert
        var cap = await _context.RepositoryCapabilities.FirstOrDefaultAsync(c => c.Name == "Feature1");
        cap.Should().NotBeNull();
        cap!.DifficultyScore.Should().Be(0.7);
        cap.Score.Should().Be(70.0);
    }

    public void Dispose()
    {
        _context.Dispose();
    }
}
