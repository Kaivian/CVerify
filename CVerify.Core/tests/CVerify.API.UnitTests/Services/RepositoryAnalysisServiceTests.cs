using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Modules.Auth.Entities;
using CVerify.API.Modules.Profiles.Services;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Security;
using CVerify.API.Modules.Shared.System.Services;
using CVerify.API.Modules.SourceCode.Entities;
using CVerify.API.Modules.SourceCode.Services;
using CVerify.API.Pipelines.Shared.Storage;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Time.Testing;
using Moq;
using Moq.Protected;
using StackExchange.Redis;
using Xunit;

namespace CVerify.API.UnitTests.Services;

public class RepositoryAnalysisServiceTests : IDisposable
{
    private readonly ApplicationDbContext _context;
    private readonly Mock<IRepositoryAnalysisQueue> _mockQueue;
    private readonly Mock<IConnectionMultiplexer> _mockRedis;
    private readonly Mock<IDatabase> _mockRedisDb;
    private readonly Mock<ISubscriber> _mockRedisSub;
    private readonly Mock<IHttpClientFactory> _mockHttpClientFactory;
    private readonly Mock<IHmacSignatureService> _mockHmacService;
    private readonly Mock<IArtifactStorageProvider> _mockStorageProvider;
    private readonly Mock<ICandidateAssessmentService> _mockCandidateAssessmentService;
    private readonly Mock<IAiStreamingSessionService> _mockStreamingSessionService;
    private readonly Mock<IAiCancellationManager> _mockCancellationManager;
    private readonly Mock<IOutboxPublisher> _mockOutboxPublisher;
    private readonly Mock<ITechnologyNormalizationService> _mockNormalizationService;
    private readonly FakeTimeProvider _timeProvider;
    private readonly EnvConfiguration _envConfig;
    private readonly RepositoryAnalysisService _service;
    private readonly Mock<HttpMessageHandler> _mockHttpMessageHandler;

    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _repoId = Guid.NewGuid();
    private readonly string _tokenKey = "h7X8k2P9q4W1v5Z0y3N6s9B2m5C8x1R4";

    public RepositoryAnalysisServiceTests()
    {
        var dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        _context = new ApplicationDbContext(dbOptions);

        _mockQueue = new Mock<IRepositoryAnalysisQueue>();
        _mockRedis = new Mock<IConnectionMultiplexer>();
        _mockRedisDb = new Mock<IDatabase>();
        _mockRedisSub = new Mock<ISubscriber>();
        _mockRedis.Setup(r => r.GetDatabase(It.IsAny<int>(), It.IsAny<object>())).Returns(_mockRedisDb.Object);
        _mockRedis.Setup(r => r.GetSubscriber(It.IsAny<object>())).Returns(_mockRedisSub.Object);

        _mockHmacService = new Mock<IHmacSignatureService>();
        _mockHmacService
            .Setup(h => h.CreateSignatureHeaders(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
            .Returns(("mock-signature", "123456789", "mock-nonce"));

        _mockStorageProvider = new Mock<IArtifactStorageProvider>();
        _mockCandidateAssessmentService = new Mock<ICandidateAssessmentService>();
        _mockStreamingSessionService = new Mock<IAiStreamingSessionService>();
        _mockCancellationManager = new Mock<IAiCancellationManager>();
        _mockOutboxPublisher = new Mock<IOutboxPublisher>();
        _mockNormalizationService = new Mock<ITechnologyNormalizationService>();

        _timeProvider = new FakeTimeProvider(DateTimeOffset.UtcNow);

        _envConfig = new EnvConfiguration();
        _envConfig.Security.TokenEncryptionKey = _tokenKey;

        // Setup mock HttpClient
        _mockHttpMessageHandler = new Mock<HttpMessageHandler>(MockBehavior.Strict);
        var httpClient = new HttpClient(_mockHttpMessageHandler.Object)
        {
            BaseAddress = new Uri("http://localhost:8000")
        };
        _mockHttpClientFactory = new Mock<IHttpClientFactory>();
        _mockHttpClientFactory.Setup(f => f.CreateClient("AiServiceClient")).Returns(httpClient);

        var mockLogger = new Mock<ILogger<RepositoryAnalysisService>>();
        var mockScopeFactory = new Mock<IServiceScopeFactory>();

        _mockNormalizationService.Setup(n => n.NormalizeAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((string rawName, CancellationToken ct) => new NormalizedSkillResult(
                $"skill:{rawName.ToLowerInvariant()}", rawName, "Software Development", "15-1252.00", true));

        _service = new RepositoryAnalysisService(
            _context,
            _mockQueue.Object,
            _mockRedis.Object,
            _mockHttpClientFactory.Object,
            _mockHmacService.Object,
            _envConfig,
            mockLogger.Object,
            _timeProvider,
            _mockStorageProvider.Object,
            _mockCandidateAssessmentService.Object,
            mockScopeFactory.Object,
            _mockStreamingSessionService.Object,
            _mockCancellationManager.Object,
            _mockOutboxPublisher.Object,
            _mockNormalizationService.Object
        );

        SeedDatabase();
    }

    private void SeedDatabase()
    {
        var authProvider = new AuthProvider
        {
            Id = Guid.NewGuid(),
            UserId = _userId,
            ProviderName = "GitHub",
            ProviderKey = "github-123",
            EncryptedAccessToken = EncryptionHelper.Encrypt("github-access-token", _tokenKey),
            CreatedAt = DateTimeOffset.UtcNow
        };

        var repository = new SourceCodeRepository
        {
            Id = _repoId,
            AuthProviderId = authProvider.Id,
            AuthProvider = authProvider,
            ExternalRepositoryId = "github-repo-123",
            Name = "mock-repo",
            Owner = "test-user",
            OwnerLogin = "test-user",
            OwnerType = "User",
            IsPrivate = false,
            DefaultBranch = "main",
            IsAccessible = true,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            LastUpdatedUtc = DateTimeOffset.UtcNow
        };

        _context.AuthProviders.Add(authProvider);
        _context.SourceCodeRepositories.Add(repository);
        _context.SaveChanges();
    }

    [Fact]
    public async Task EnqueueAnalysisJobAsync_Should_Create_Job_And_Tasks_Successfully()
    {
        // Act
        var jobId = await _service.EnqueueAnalysisJobAsync(_userId, _repoId);

        // Assert
        jobId.Should().NotBeEmpty();

        var job = await _context.AnalysisJobs.FirstOrDefaultAsync(j => j.Id == jobId);
        job.Should().NotBeNull();
        job!.Status.Should().Be("Queued");
        job.UserId.Should().Be(_userId);
        job.RepositoryId.Should().Be(_repoId);

        var tasks = await _context.AnalysisTasks.Where(t => t.JobId == jobId).ToListAsync();
        tasks.Should().NotBeEmpty();
        tasks.Count.Should().Be(22); // Loaded from pipeline_config.json containing 22 stages

        _mockQueue.Verify(q => q.EnqueueJobAsync(jobId), Times.Once);
        _mockStreamingSessionService.Verify(s => s.CreateSessionAsync(
            jobId, "repository-analysis", _userId, null, "claude-haiku-4-5-20251001", "Claude", "1.0.0", It.IsAny<string>()
        ), Times.Once);
    }

    [Fact]
    public async Task EnqueueAnalysisJobAsync_Should_Throw_When_ActiveUserJobsLimitExceeded()
    {
        // Arrange
        // Create 2 already active jobs for this user on DIFFERENT repositories
        var authProviderId = _context.SourceCodeRepositories.First().AuthProviderId;
        for (int i = 0; i < 2; i++)
        {
            var otherRepoId = Guid.NewGuid();
            var otherRepo = new SourceCodeRepository
            {
                Id = otherRepoId,
                AuthProviderId = authProviderId,
                ExternalRepositoryId = $"github-repo-other-{i}",
                Name = $"mock-repo-other-{i}",
                Owner = "test-user",
                OwnerLogin = "test-user",
                OwnerType = "User",
                IsPrivate = false,
                DefaultBranch = "main",
                IsAccessible = true,
                CreatedAtUtc = DateTimeOffset.UtcNow,
                LastUpdatedUtc = DateTimeOffset.UtcNow
            };
            _context.SourceCodeRepositories.Add(otherRepo);

            _context.AnalysisJobs.Add(new AnalysisJob
            {
                Id = Guid.NewGuid(),
                UserId = _userId,
                RepositoryId = otherRepoId,
                Status = "RunningAgents",
                CreatedAtUtc = DateTimeOffset.UtcNow,
                LastUpdatedUtc = DateTimeOffset.UtcNow
            });
        }
        await _context.SaveChangesAsync();

        // Act & Assert
        Func<Task> act = async () => await _service.EnqueueAnalysisJobAsync(_userId, _repoId);
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("User active analysis jobs limit exceeded.");
    }

    [Fact]
    public async Task CancelJobAsync_Should_Set_Status_To_Cancelled_And_Trigger_Cancellation()
    {
        // Arrange
        var jobId = Guid.NewGuid();
        var job = new AnalysisJob
        {
            Id = jobId,
            UserId = _userId,
            RepositoryId = _repoId,
            Status = "RunningAgents",
            CreatedAtUtc = DateTimeOffset.UtcNow,
            LastUpdatedUtc = DateTimeOffset.UtcNow
        };
        _context.AnalysisJobs.Add(job);
        await _context.SaveChangesAsync();

        // Act
        var result = await _service.CancelJobAsync(_userId, jobId);

        // Assert
        result.Should().BeTrue();

        var updatedJob = await _context.AnalysisJobs.FirstOrDefaultAsync(j => j.Id == jobId);
        updatedJob!.Status.Should().Be("Cancelled");

        // Inspect recorded invocations directly to bypass Moq optional parameter quirks on Redis structs/enums
        var hasStringSetCall = _mockRedisDb.Invocations.Any(inv =>
            inv.Method.Name == "StringSetAsync" &&
            inv.Arguments[0].ToString().Contains($"ai:cancel:{jobId}") &&
            inv.Arguments[1].ToString() == "true"
        );

        hasStringSetCall.Should().BeTrue("StringSetAsync should have been called to set cancellation flag in Redis.");

        _mockCancellationManager.Verify(c => c.Cancel(jobId), Times.Once);
        _mockStreamingSessionService.Verify(s => s.UpdateSessionStatusAsync(jobId, "Cancelled", null, null), Times.Once);
    }

    [Fact]
    public async Task RetryTaskAsync_Should_Reset_All_Tasks_When_RepoStructure_Retried()
    {
        // Arrange
        var jobId = Guid.NewGuid();
        var job = new AnalysisJob
        {
            Id = jobId,
            UserId = _userId,
            RepositoryId = _repoId,
            Status = "Failed",
            CreatedAtUtc = DateTimeOffset.UtcNow,
            LastUpdatedUtc = DateTimeOffset.UtcNow
        };
        _context.AnalysisJobs.Add(job);

        var taskTypes = new[] { "RepoStructure", "CodeQuality", "RepositorySummary", "CvSynthesis" };
        var tasksList = new List<AnalysisTask>();
        foreach (var tt in taskTypes)
        {
            var task = new AnalysisTask
            {
                Id = Guid.NewGuid(),
                JobId = jobId,
                TaskType = tt,
                Status = "Completed",
                Progress = 100.0,
                CreatedAtUtc = DateTimeOffset.UtcNow,
                LastUpdatedUtc = DateTimeOffset.UtcNow
            };
            tasksList.Add(task);
            _context.AnalysisTasks.Add(task);
        }
        await _context.SaveChangesAsync();

        var repoStructureTask = tasksList.First(t => t.TaskType == "RepoStructure");

        // Act
        var result = await _service.RetryTaskAsync(_userId, jobId, repoStructureTask.Id);

        // Assert
        result.Should().BeTrue();

        var updatedTasks = await _context.AnalysisTasks.Where(t => t.JobId == jobId).ToListAsync();
        foreach (var task in updatedTasks)
        {
            task.Status.Should().Be("Queued");
            task.Progress.Should().Be(0.0);
        }

        var updatedJob = await _context.AnalysisJobs.FirstOrDefaultAsync(j => j.Id == jobId);
        updatedJob!.Status.Should().Be("Queued");
        _mockQueue.Verify(q => q.EnqueueJobAsync(jobId), Times.Once);
    }

    [Fact]
    public async Task RetryTaskAsync_Should_Reset_Selected_Dependencies_When_CodeQuality_Retried()
    {
        // Arrange
        var jobId = Guid.NewGuid();
        var job = new AnalysisJob
        {
            Id = jobId,
            UserId = _userId,
            RepositoryId = _repoId,
            Status = "Failed",
            CreatedAtUtc = DateTimeOffset.UtcNow,
            LastUpdatedUtc = DateTimeOffset.UtcNow
        };
        _context.AnalysisJobs.Add(job);

        var taskTypes = new[] { "RepoStructure", "CodeQuality", "RepositorySummary", "CvSynthesis" };
        var tasksList = new List<AnalysisTask>();
        foreach (var tt in taskTypes)
        {
            var task = new AnalysisTask
            {
                Id = Guid.NewGuid(),
                JobId = jobId,
                TaskType = tt,
                Status = "Completed",
                Progress = 100.0,
                CreatedAtUtc = DateTimeOffset.UtcNow,
                LastUpdatedUtc = DateTimeOffset.UtcNow
            };
            tasksList.Add(task);
            _context.AnalysisTasks.Add(task);
        }
        await _context.SaveChangesAsync();

        var codeQualityTask = tasksList.First(t => t.TaskType == "CodeQuality");

        // Act
        var result = await _service.RetryTaskAsync(_userId, jobId, codeQualityTask.Id);

        // Assert
        result.Should().BeTrue();

        var updatedTasks = await _context.AnalysisTasks.Where(t => t.JobId == jobId).ToListAsync();

        // RepoStructure is NOT reset
        updatedTasks.First(t => t.TaskType == "RepoStructure").Status.Should().Be("Completed");

        // CodeQuality, RepositorySummary, and CvSynthesis are reset
        updatedTasks.First(t => t.TaskType == "CodeQuality").Status.Should().Be("Queued");
        updatedTasks.First(t => t.TaskType == "RepositorySummary").Status.Should().Be("Queued");
        updatedTasks.First(t => t.TaskType == "CvSynthesis").Status.Should().Be("Queued");
    }

    [Fact]
    public async Task GetJobSnapshotAsync_Should_Return_DefaultReport_When_RepoStructure_Not_Completed()
    {
        // Arrange
        var jobId = Guid.NewGuid();
        var job = new AnalysisJob
        {
            Id = jobId,
            UserId = _userId,
            RepositoryId = _repoId,
            Status = "RunningAgents",
            CreatedAtUtc = DateTimeOffset.UtcNow,
            LastUpdatedUtc = DateTimeOffset.UtcNow
        };
        _context.AnalysisJobs.Add(job);
        await _context.SaveChangesAsync();

        // Act
        var snapshot = await _service.GetJobSnapshotAsync(_userId, jobId);

        // Assert
        snapshot.Should().NotBeNull();
        snapshot.Should().Contain("Analysis is in progress...");
        snapshot.Should().Contain("evidence-intelligence-v2");
    }

    [Fact]
    public async Task ExecuteAnalysisJobAsync_Should_Succeed_When_PipelineSucceeds()
    {
        // Arrange
        var jobId = Guid.NewGuid();
        var job = new AnalysisJob
        {
            Id = jobId,
            UserId = _userId,
            RepositoryId = _repoId,
            Status = "Queued",
            CreatedAtUtc = DateTimeOffset.UtcNow,
            LastUpdatedUtc = DateTimeOffset.UtcNow
        };
        _context.AnalysisJobs.Add(job);

        var task = new AnalysisTask
        {
            Id = Guid.NewGuid(),
            JobId = jobId,
            TaskType = "RepoStructure",
            Status = "Queued",
            CreatedAtUtc = DateTimeOffset.UtcNow,
            LastUpdatedUtc = DateTimeOffset.UtcNow
        };
        _context.AnalysisTasks.Add(task);
        await _context.SaveChangesAsync();

        // Setup AI service response mock for execute task
        var executeResponse = new
        {
            status = "Completed",
            schemaVersion = "2.0.0",
            resultData = "{\"structure\": []}",
            telemetry = new
            {
                promptTokens = 100,
                completionTokens = 50,
                totalTokens = 150,
                cacheReadTokens = 0,
                cacheWriteTokens = 0,
                estimatedCostUsd = 0.005,
                modelName = "claude-haiku-4-5-20251001",
                provider = "Claude"
            }
        };

        _mockHttpMessageHandler
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.Is<HttpRequestMessage>(req => req.RequestUri!.PathAndQuery.Contains("/execute")),
                ItExpr.IsAny<CancellationToken>()
            )
            .ReturnsAsync(new HttpResponseMessage
            {
                StatusCode = HttpStatusCode.OK,
                Content = new StringContent(JsonSerializer.Serialize(executeResponse))
            });

        // Setup AI service response mock for aggregate report
        var aggregateResponse = new
        {
            reportData = "{\"schemaVersion\": \"v2\", \"classification\": {\"isVerified\": true, \"trustScore\": 0.85, \"primaryDomain\": \"Web Dev\"}, \"risk\": {\"score\": 12.0, \"level\": \"low\", \"reasons\": []}}"
        };

        _mockHttpMessageHandler
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.Is<HttpRequestMessage>(req => req.RequestUri!.PathAndQuery.Contains("/aggregate")),
                ItExpr.IsAny<CancellationToken>()
            )
            .ReturnsAsync(new HttpResponseMessage
            {
                StatusCode = HttpStatusCode.OK,
                Content = new StringContent(JsonSerializer.Serialize(aggregateResponse))
            });

        // Act
        await _service.ExecuteAnalysisJobAsync(jobId, CancellationToken.None);

        // Assert
        var updatedJob = await _context.AnalysisJobs.FirstOrDefaultAsync(j => j.Id == jobId);
        updatedJob!.Status.Should().Be("Completed");
        updatedJob.Progress.Should().Be(100.0);

        var updatedTask = await _context.AnalysisTasks.FirstOrDefaultAsync(t => t.Id == task.Id);
        updatedTask!.Status.Should().Be("Completed");
        updatedTask.PromptTokens.Should().Be(100);

        var report = await _context.AnalysisReports.FirstOrDefaultAsync(r => r.JobId == jobId);
        report.Should().NotBeNull();

        var repo = await _context.SourceCodeRepositories.FirstOrDefaultAsync(r => r.Id == _repoId);
        repo!.LatestAnalysisStatus.Should().Be("Completed");
        repo.IsVerified.Should().BeTrue();
        repo.TrustScore.Should().Be(0.85);
        repo.Classification.Should().Be("Web Dev");
    }

    [Fact]
    public async Task EnqueueAnalysisJobAsync_Should_Return_ExistingJobId_When_JobIsAlreadyActive()
    {
        // Arrange
        var jobId = Guid.NewGuid();
        var activeJob = new AnalysisJob
        {
            Id = jobId,
            UserId = _userId,
            RepositoryId = _repoId,
            Status = "RunningAgents",
            CreatedAtUtc = DateTimeOffset.UtcNow,
            LastUpdatedUtc = DateTimeOffset.UtcNow
        };
        _context.AnalysisJobs.Add(activeJob);
        await _context.SaveChangesAsync();

        // Act
        var returnedJobId = await _service.EnqueueAnalysisJobAsync(_userId, _repoId);

        // Assert
        returnedJobId.Should().Be(jobId);
    }

    [Fact]
    public async Task EnqueueAnalysisJobAsync_Should_Throw_KeyNotFoundException_When_RepoNotOwnedByUser()
    {
        // Act & Assert
        Func<Task> act = async () => await _service.EnqueueAnalysisJobAsync(Guid.NewGuid(), _repoId);
        await act.Should().ThrowAsync<KeyNotFoundException>()
            .WithMessage("Repository not found or access denied.");
    }

    [Fact]
    public async Task GetLatestReportAsync_Should_Return_ReportData_When_ReportExists()
    {
        // Arrange
        var jobId = Guid.NewGuid();
        var report = new AnalysisReport
        {
            Id = Guid.NewGuid(),
            RepositoryId = _repoId,
            JobId = jobId,
            ReportData = "{\"score\": 100}"
        };
        _context.AnalysisReports.Add(report);
        await _context.SaveChangesAsync();

        // Act
        var reportData = await _service.GetLatestReportAsync(_userId, _repoId);

        // Assert
        reportData.Should().Be("{\"score\": 100}");
    }

    [Fact]
    public async Task GetLatestReportAsync_Should_Return_Null_When_NoReportExists()
    {
        // Act
        var reportData = await _service.GetLatestReportAsync(_userId, _repoId);

        // Assert
        reportData.Should().BeNull();
    }

    [Fact]
    public async Task GetLatestReportAsync_Should_Throw_KeyNotFoundException_When_RepoNotOwnedByUser()
    {
        // Act & Assert
        Func<Task> act = async () => await _service.GetLatestReportAsync(Guid.NewGuid(), _repoId);
        await act.Should().ThrowAsync<KeyNotFoundException>()
            .WithMessage("Repository not found or access denied.");
    }

    [Fact]
    public async Task ResetRepositoryAnalysisAsync_Should_Throw_KeyNotFoundException_When_RepoNotOwnedByUser()
    {
        // Arrange
        _mockRedisDb.Setup(db => db.LockTakeAsync(It.IsAny<RedisKey>(), It.IsAny<RedisValue>(), It.IsAny<TimeSpan>(), It.IsAny<CommandFlags>()))
            .ReturnsAsync(true);

        // Act & Assert
        Func<Task> act = async () => await _service.ResetRepositoryAnalysisAsync(Guid.NewGuid(), _repoId, CancellationToken.None);
        await act.Should().ThrowAsync<KeyNotFoundException>()
            .WithMessage("Repository not found or access denied.");
    }

    [Fact]
    public async Task ResetRepositoryAnalysisAsync_Should_Throw_InvalidOperationException_When_ActiveJobExists()
    {
        // Arrange
        var jobId = Guid.NewGuid();
        var activeJob = new AnalysisJob
        {
            Id = jobId,
            UserId = _userId,
            RepositoryId = _repoId,
            Status = "RunningAgents",
            CreatedAtUtc = DateTimeOffset.UtcNow,
            LastUpdatedUtc = DateTimeOffset.UtcNow
        };
        _context.AnalysisJobs.Add(activeJob);
        await _context.SaveChangesAsync();

        _mockRedisDb.Setup(db => db.LockTakeAsync(It.IsAny<RedisKey>(), It.IsAny<RedisValue>(), It.IsAny<TimeSpan>(), It.IsAny<CommandFlags>()))
            .ReturnsAsync(true);

        // Act & Assert
        Func<Task> act = async () => await _service.ResetRepositoryAnalysisAsync(_userId, _repoId, CancellationToken.None);
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("Cannot reset repository analysis while an analysis job is active.");
    }

    [Fact]
    public async Task ResetRepositoryAnalysisAsync_Should_Succeed_And_Clean_Data_When_Valid()
    {
        // Arrange
        var jobId = Guid.NewGuid();
        var job = new AnalysisJob
        {
            Id = jobId,
            UserId = _userId,
            RepositoryId = _repoId,
            Status = "Completed",
            CreatedAtUtc = DateTimeOffset.UtcNow,
            LastUpdatedUtc = DateTimeOffset.UtcNow
        };
        var report = new AnalysisReport
        {
            Id = Guid.NewGuid(),
            RepositoryId = _repoId,
            JobId = jobId,
            ReportData = "{\"data\":{}}"
        };
        _context.AnalysisJobs.Add(job);
        _context.AnalysisReports.Add(report);
        await _context.SaveChangesAsync();

        _mockRedisDb.Setup(db => db.LockTakeAsync(It.IsAny<RedisKey>(), It.IsAny<RedisValue>(), It.IsAny<TimeSpan>(), It.IsAny<CommandFlags>()))
            .ReturnsAsync(true);
        _mockRedisDb.Setup(db => db.LockReleaseAsync(It.IsAny<RedisKey>(), It.IsAny<RedisValue>(), It.IsAny<CommandFlags>()))
            .ReturnsAsync(true);

        // Act
        var result = await _service.ResetRepositoryAnalysisAsync(_userId, _repoId, CancellationToken.None);

        // Assert
        result.Should().BeTrue();

        var deletedJob = await _context.AnalysisJobs.FirstOrDefaultAsync(j => j.Id == jobId);
        deletedJob.Should().BeNull();

        var deletedReport = await _context.AnalysisReports.FirstOrDefaultAsync(r => r.JobId == jobId);
        deletedReport.Should().BeNull();

        var repo = await _context.SourceCodeRepositories.FirstOrDefaultAsync(r => r.Id == _repoId);
        repo!.LatestAnalysisStatus.Should().Be("NeverAnalyzed");
    }

    public void Dispose()
    {
        _context.Dispose();
    }
}
