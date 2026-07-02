using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Time.Testing;
using Moq;
using Xunit;
using FluentAssertions;
using CVerify.API.Modules.SourceCode.BackgroundWorkers;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.SourceCode.Entities;

namespace CVerify.API.UnitTests.BackgroundWorkers;

public class AnalysisQueueRecoverySweeperTests : IDisposable
{
    private readonly ApplicationDbContext _context;
    private readonly Mock<IServiceProvider> _mockServiceProvider;
    private readonly Mock<ILogger<AnalysisQueueRecoverySweeper>> _mockLogger;
    private readonly FakeTimeProvider _timeProvider;

    public AnalysisQueueRecoverySweeperTests()
    {
        var dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        _context = new ApplicationDbContext(dbOptions);

        var serviceScope = new Mock<IServiceScope>();
        var serviceScopeFactory = new Mock<IServiceScopeFactory>();
        
        var serviceProvider = new Mock<IServiceProvider>();
        serviceProvider.Setup(x => x.GetService(typeof(ApplicationDbContext))).Returns(_context);
        
        serviceScope.Setup(x => x.ServiceProvider).Returns(serviceProvider.Object);
        serviceScopeFactory.Setup(x => x.CreateScope()).Returns(serviceScope.Object);

        _mockServiceProvider = new Mock<IServiceProvider>();
        _mockServiceProvider.Setup(x => x.GetService(typeof(IServiceScopeFactory))).Returns(serviceScopeFactory.Object);

        _mockLogger = new Mock<ILogger<AnalysisQueueRecoverySweeper>>();
        _timeProvider = new FakeTimeProvider(DateTimeOffset.UtcNow);
    }

    [Fact]
    public async Task Sweeper_Should_Recover_StuckJobs_And_Repositories_Successfully()
    {
        // Arrange
        var jobId = Guid.NewGuid();
        var repoId = Guid.NewGuid();

        var job = new AnalysisJob
        {
            Id = jobId,
            RepositoryId = repoId,
            Status = "RunningAgents",
            Progress = 35.0,
            CurrentStep = "RepoStructure",
            CreatedAtUtc = DateTimeOffset.UtcNow,
            LastUpdatedUtc = DateTimeOffset.UtcNow
        };

        var repo = new SourceCodeRepository
        {
            Id = repoId,
            ExternalRepositoryId = "repo-123",
            Name = "mock-repo",
            Owner = "test",
            OwnerLogin = "test",
            OwnerType = "User",
            LatestAnalysisStatus = "Pending",
            CreatedAtUtc = DateTimeOffset.UtcNow,
            LastUpdatedUtc = DateTimeOffset.UtcNow
        };

        _context.AnalysisJobs.Add(job);
        _context.SourceCodeRepositories.Add(repo);
        await _context.SaveChangesAsync();

        var sweeper = new TestAnalysisQueueRecoverySweeper(_mockServiceProvider.Object, _mockLogger.Object, _timeProvider);

        // Act
        await sweeper.TriggerExecuteAsync(CancellationToken.None);

        // Assert
        var updatedJob = await _context.AnalysisJobs.FirstOrDefaultAsync(j => j.Id == jobId);
        updatedJob!.Status.Should().Be("Failed");
        updatedJob.ErrorMessage.Should().Be("Job interrupted by server reboot or restart.");

        var updatedRepo = await _context.SourceCodeRepositories.FirstOrDefaultAsync(r => r.Id == repoId);
        updatedRepo!.LatestAnalysisStatus.Should().Be("Failed");

        var eventLog = await _context.AnalysisJobEvents.FirstOrDefaultAsync(e => e.JobId == jobId);
        eventLog.Should().NotBeNull();
        eventLog!.Step.Should().Be("Failed");
        eventLog.Message.Should().Be("Job interrupted by server reboot or restart.");
    }

    [Fact]
    public async Task Sweeper_Should_Clean_Orphaned_Pending_Repositories()
    {
        // Arrange
        var repoId = Guid.NewGuid();

        var repo = new SourceCodeRepository
        {
            Id = repoId,
            ExternalRepositoryId = "repo-456",
            Name = "orphaned-repo",
            Owner = "test",
            OwnerLogin = "test",
            OwnerType = "User",
            LatestAnalysisStatus = "Pending",
            CreatedAtUtc = DateTimeOffset.UtcNow,
            LastUpdatedUtc = DateTimeOffset.UtcNow
        };

        _context.SourceCodeRepositories.Add(repo);
        await _context.SaveChangesAsync();

        var sweeper = new TestAnalysisQueueRecoverySweeper(_mockServiceProvider.Object, _mockLogger.Object, _timeProvider);

        // Act
        await sweeper.TriggerExecuteAsync(CancellationToken.None);

        // Assert
        var updatedRepo = await _context.SourceCodeRepositories.FirstOrDefaultAsync(r => r.Id == repoId);
        updatedRepo!.LatestAnalysisStatus.Should().Be("Failed");
    }

    public void Dispose()
    {
        _context.Dispose();
    }
}

// Subclass to expose protected ExecuteAsync method for testing
public class TestAnalysisQueueRecoverySweeper : AnalysisQueueRecoverySweeper
{
    public TestAnalysisQueueRecoverySweeper(
        IServiceProvider serviceProvider,
        ILogger<AnalysisQueueRecoverySweeper> logger,
        TimeProvider timeProvider)
        : base(serviceProvider, logger, timeProvider)
    {
    }

    public Task TriggerExecuteAsync(CancellationToken stoppingToken)
    {
        return ExecuteAsync(stoppingToken);
    }
}
