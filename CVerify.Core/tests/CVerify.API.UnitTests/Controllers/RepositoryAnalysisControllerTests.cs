using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;
using FluentAssertions;
using CVerify.API.Modules.SourceCode.Controllers;
using CVerify.API.Modules.SourceCode.Services;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.SourceCode.Entities;
using CVerify.API.Modules.Auth.Entities;
using CVerify.API.Modules.SourceCode.DTOs;
using StackExchange.Redis;

namespace CVerify.API.UnitTests.Controllers;

public class RepositoryAnalysisControllerTests : IDisposable
{
    private readonly ApplicationDbContext _context;
    private readonly Mock<IRepositoryAnalysisService> _mockService;
    private readonly Mock<IConnectionMultiplexer> _mockRedis;
    private readonly Mock<ISubscriber> _mockRedisSub;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _repoId = Guid.NewGuid();
    private readonly ClaimsPrincipal _userPrincipal;

    public RepositoryAnalysisControllerTests()
    {
        var dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        _context = new ApplicationDbContext(dbOptions);

        _mockService = new Mock<IRepositoryAnalysisService>();
        _mockRedis = new Mock<IConnectionMultiplexer>();
        _mockRedisSub = new Mock<ISubscriber>();
        _mockRedis.Setup(r => r.GetSubscriber(It.IsAny<object>())).Returns(_mockRedisSub.Object);

        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, _userId.ToString())
        };
        var identity = new ClaimsIdentity(claims, "TestAuthType");
        _userPrincipal = new ClaimsPrincipal(identity);
    }

    private RepositoryAnalysisController CreateController()
    {
        return new RepositoryAnalysisController(_mockService.Object, _mockRedis.Object)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = _userPrincipal }
            }
        };
    }

    [Fact]
    public async Task GetActiveJobs_Should_Return_Only_ActiveJobs_Of_CurrentUser()
    {
        // Arrange
        var controller = CreateController();
        _context.AnalysisJobs.Add(new AnalysisJob
        {
            Id = Guid.NewGuid(),
            UserId = _userId,
            RepositoryId = _repoId,
            Status = "RunningAgents",
            Progress = 45.0,
            CurrentStep = "RepoStructure"
        });
        _context.AnalysisJobs.Add(new AnalysisJob
        {
            Id = Guid.NewGuid(),
            UserId = Guid.NewGuid(), // Other user
            RepositoryId = Guid.NewGuid(),
            Status = "RunningAgents"
        });
        await _context.SaveChangesAsync();

        // Act
        var result = await controller.GetActiveJobs(_context, CancellationToken.None);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var activeJobs = okResult.Value as System.Collections.IEnumerable;
        activeJobs.Should().NotBeNull();

        int count = 0;
        foreach (var job in activeJobs!) count++;
        count.Should().Be(1);
    }

    [Fact]
    public async Task TriggerAnalysis_Should_Return_Accepted_When_Successful()
    {
        // Arrange
        var controller = CreateController();
        var jobId = Guid.NewGuid();
        _mockService.Setup(s => s.EnqueueAnalysisJobAsync(_userId, _repoId))
            .ReturnsAsync(jobId);

        // Act
        var result = await controller.TriggerAnalysis(_repoId, CancellationToken.None);

        // Assert
        var acceptedResult = result.Should().BeOfType<AcceptedResult>().Subject;
        acceptedResult.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task TriggerAnalysis_Should_Return_NotFound_When_RepositoryDoesNotExist()
    {
        // Arrange
        var controller = CreateController();
        _mockService.Setup(s => s.EnqueueAnalysisJobAsync(_userId, _repoId))
            .ThrowsAsync(new KeyNotFoundException("Repository not found or access denied."));

        // Act
        var result = await controller.TriggerAnalysis(_repoId, CancellationToken.None);

        // Assert
        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task TriggerAnalysis_Should_Return_TooManyRequests_When_LimitExceeded()
    {
        // Arrange
        var controller = CreateController();
        _mockService.Setup(s => s.EnqueueAnalysisJobAsync(_userId, _repoId))
            .ThrowsAsync(new InvalidOperationException("User active analysis jobs limit exceeded."));

        // Act
        var result = await controller.TriggerAnalysis(_repoId, CancellationToken.None);

        // Assert
        var objectResult = result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(StatusCodes.Status429TooManyRequests);
    }

    [Fact]
    public async Task ResetRepositoryAnalysis_Should_Return_Ok_When_Successful()
    {
        // Arrange
        var controller = CreateController();
        _mockService.Setup(s => s.ResetRepositoryAnalysisAsync(_userId, _repoId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        // Act
        var result = await controller.ResetRepositoryAnalysis(_repoId, CancellationToken.None);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task ResetRepositoryAnalysis_Should_Return_BadRequest_When_ActiveJobExists()
    {
        // Arrange
        var controller = CreateController();
        _mockService.Setup(s => s.ResetRepositoryAnalysisAsync(_userId, _repoId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        // Act
        var result = await controller.ResetRepositoryAnalysis(_repoId, CancellationToken.None);

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task GetJobStatus_Should_Return_JobDto_When_Accessible()
    {
        // Arrange
        var controller = CreateController();
        var jobId = Guid.NewGuid();
        var jobDto = new AnalysisJobDto(
            jobId,
            _repoId,
            _userId,
            "RunningAgents",
            50.0,
            "RepoStructure",
            null,
            null,
            null,
            null,
            DateTimeOffset.UtcNow,
            DateTimeOffset.UtcNow,
            new List<AnalysisTaskDto>()
        );
        _mockService.Setup(s => s.GetJobStatusAsync(_userId, jobId))
            .ReturnsAsync(jobDto);

        // Act
        var result = await controller.GetJobStatus(jobId, CancellationToken.None);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.Value.Should().BeEquivalentTo(jobDto);
    }

    [Fact]
    public async Task GetJobStatus_Should_Return_NotFound_When_NotAccessible()
    {
        // Arrange
        var controller = CreateController();
        var jobId = Guid.NewGuid();
        _mockService.Setup(s => s.GetJobStatusAsync(_userId, jobId))
            .ReturnsAsync((AnalysisJobDto?)null);

        // Act
        var result = await controller.GetJobStatus(jobId, CancellationToken.None);

        // Assert
        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task GetJobSnapshot_Should_Return_SnapshotJson_When_Successful()
    {
        // Arrange
        var controller = CreateController();
        var jobId = Guid.NewGuid();
        var snapshotJson = "{\"stages\":[]}";
        _mockService.Setup(s => s.GetJobSnapshotAsync(_userId, jobId))
            .ReturnsAsync(snapshotJson);

        // Act
        var result = await controller.GetJobSnapshot(jobId, CancellationToken.None);

        // Assert
        var contentResult = result.Should().BeOfType<ContentResult>().Subject;
        contentResult.ContentType.Should().Be("application/json");
        contentResult.Content.Should().Contain(jobId.ToString());
    }

    [Fact]
    public async Task GetJobEvents_Should_Return_EventsList()
    {
        // Arrange
        var controller = CreateController();
        var jobId = Guid.NewGuid();
        var eventsList = new List<AnalysisJobEventDto>
        {
            new AnalysisJobEventDto(Guid.NewGuid(), jobId, "Queued", 0.0, "Job enqueued", DateTimeOffset.UtcNow)
        };
        _mockService.Setup(s => s.GetJobEventsAsync(_userId, jobId))
            .ReturnsAsync(eventsList);

        // Act
        var result = await controller.GetJobEvents(jobId, CancellationToken.None);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.Value.Should().BeEquivalentTo(eventsList);
    }

    [Fact]
    public async Task CancelJob_Should_Return_Ok_When_Successful()
    {
        // Arrange
        var controller = CreateController();
        var jobId = Guid.NewGuid();
        _mockService.Setup(s => s.CancelJobAsync(_userId, jobId))
            .ReturnsAsync(true);

        // Act
        var result = await controller.CancelJob(jobId, CancellationToken.None);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task CancelJob_Should_Return_BadRequest_When_NotSuccessful()
    {
        // Arrange
        var controller = CreateController();
        var jobId = Guid.NewGuid();
        _mockService.Setup(s => s.CancelJobAsync(_userId, jobId))
            .ReturnsAsync(false);

        // Act
        var result = await controller.CancelJob(jobId, CancellationToken.None);

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task GetLatestReport_Should_Return_NotFound_When_RepositoryDoesNotExist()
    {
        // Arrange
        var controller = CreateController();

        // Act
        var result = await controller.GetLatestReport(_repoId, _context, CancellationToken.None);

        // Assert
        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task GetLatestReport_Should_Return_NotFound_When_NoCompletedReportExists()
    {
        // Arrange
        var controller = CreateController();
        var authProvider = new AuthProvider { Id = Guid.NewGuid(), UserId = _userId, ProviderName = "GitHub", ProviderKey = "github-123" };
        var repo = new SourceCodeRepository
        {
            Id = _repoId,
            AuthProvider = authProvider,
            Name = "repo",
            ExternalRepositoryId = "repo-123",
            Owner = "test",
            OwnerLogin = "test",
            OwnerType = "User"
        };
        _context.AuthProviders.Add(authProvider);
        _context.SourceCodeRepositories.Add(repo);
        await _context.SaveChangesAsync();

        // Act
        var result = await controller.GetLatestReport(_repoId, _context, CancellationToken.None);

        // Assert
        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task GetLatestReport_Should_Return_ReportJson_When_Exists()
    {
        // Arrange
        var controller = CreateController();
        var authProvider = new AuthProvider { Id = Guid.NewGuid(), UserId = _userId, ProviderName = "GitHub", ProviderKey = "github-123" };
        var repo = new SourceCodeRepository
        {
            Id = _repoId,
            AuthProvider = authProvider,
            Name = "repo",
            ExternalRepositoryId = "repo-123",
            Owner = "test",
            OwnerLogin = "test",
            OwnerType = "User"
        };
        var report = new AnalysisReport { Id = Guid.NewGuid(), RepositoryId = _repoId, JobId = Guid.NewGuid(), ReportData = "{\"classification\":{}}" };
        _context.AuthProviders.Add(authProvider);
        _context.SourceCodeRepositories.Add(repo);
        _context.AnalysisReports.Add(report);
        await _context.SaveChangesAsync();

        // Act
        var result = await controller.GetLatestReport(_repoId, _context, CancellationToken.None);

        // Assert
        var contentResult = result.Should().BeOfType<ContentResult>().Subject;
        contentResult.ContentType.Should().Be("application/json");
        contentResult.Content.Should().Contain(report.JobId.ToString());
    }

    [Fact]
    public async Task RetryTask_Should_Return_Ok_When_Successful()
    {
        // Arrange
        var controller = CreateController();
        var jobId = Guid.NewGuid();
        var taskId = Guid.NewGuid();
        _mockService.Setup(s => s.RetryTaskAsync(_userId, jobId, taskId))
            .ReturnsAsync(true);

        // Act
        var result = await controller.RetryTask(jobId, taskId, CancellationToken.None);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task RetryTask_Should_Return_BadRequest_When_NotSuccessful()
    {
        // Arrange
        var controller = CreateController();
        var jobId = Guid.NewGuid();
        var taskId = Guid.NewGuid();
        _mockService.Setup(s => s.RetryTaskAsync(_userId, jobId, taskId))
            .ReturnsAsync(false);

        // Act
        var result = await controller.RetryTask(jobId, taskId, CancellationToken.None);

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task GetTaskEvents_Should_Return_TaskEvents()
    {
        // Arrange
        var controller = CreateController();
        var jobId = Guid.NewGuid();
        var taskId = Guid.NewGuid();
        var taskEvents = new List<AnalysisTaskEventDto>
        {
            new AnalysisTaskEventDto(Guid.NewGuid(), taskId, DateTimeOffset.UtcNow, "Information", "TaskProgress", "Task started", null)
        };
        _mockService.Setup(s => s.GetTaskEventsAsync(_userId, jobId, taskId))
            .ReturnsAsync(taskEvents);

        // Act
        var result = await controller.GetTaskEvents(jobId, taskId, CancellationToken.None);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.Value.Should().BeEquivalentTo(taskEvents);
    }

    [Fact]
    public async Task DevResetAndAnalyze_Should_Succeed()
    {
        // Arrange
        var controller = CreateController();
        var targetUserId = Guid.Parse("019ecc1b-44e6-7600-803f-11249088ae92");
        var jobId = Guid.NewGuid();

        _mockService.Setup(s => s.ResetRepositoryAnalysisAsync(targetUserId, _repoId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        _mockService.Setup(s => s.EnqueueAnalysisJobAsync(targetUserId, _repoId))
            .ReturnsAsync(jobId);

        // Act
        var result = await controller.DevResetAndAnalyze(_repoId, CancellationToken.None);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.Value.Should().NotBeNull();
    }

    public void Dispose()
    {
        _context.Dispose();
    }
}
