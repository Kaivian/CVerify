using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using FluentAssertions;
using CVerify.API.Modules.SourceCode.Controllers;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Pipelines.Shared.Storage;
using CVerify.API.Modules.SourceCode.Entities;
using CVerify.API.Pipelines.Shared.Artifacts.Entities;

namespace CVerify.API.UnitTests.Controllers;

public class AiJobsControllerTests : IDisposable
{
    private readonly ApplicationDbContext _context;
    private readonly Mock<IArtifactStorageProvider> _mockStorageProvider;
    private readonly Mock<ILogger<AiJobsController>> _mockLogger;
    private readonly Guid _jobId = Guid.NewGuid();
    private readonly AiJobsController _controller;

    public AiJobsControllerTests()
    {
        var dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        _context = new ApplicationDbContext(dbOptions);

        _mockStorageProvider = new Mock<IArtifactStorageProvider>();
        _mockLogger = new Mock<ILogger<AiJobsController>>();

        _controller = new AiJobsController(_context, _mockStorageProvider.Object, _mockLogger.Object);
    }

    [Fact]
    public async Task GetArtifact_Should_Return_ReportData_For_repo_intelligence_report()
    {
        // Arrange
        var report = new AnalysisReport
        {
            Id = Guid.NewGuid(),
            JobId = _jobId,
            RepositoryId = Guid.NewGuid(),
            ReportData = "{\"reportKey\": \"val\"}"
        };
        _context.AnalysisReports.Add(report);
        await _context.SaveChangesAsync();

        // Act
        var result = await _controller.GetArtifact(_jobId, "repo-intelligence-report", CancellationToken.None);

        // Assert
        var contentResult = result.Should().BeOfType<ContentResult>().Subject;
        contentResult.ContentType.Should().Be("application/json");
        contentResult.Content.Should().Be(report.ReportData);
    }

    [Fact]
    public async Task GetArtifact_Should_Return_Content_From_Storage_When_EntryExists()
    {
        // Arrange
        var entry = new ArtifactRegistryEntry
        {
            Id = Guid.NewGuid(),
            JobId = _jobId,
            ArtifactId = "L1-007",
            StoragePath = "jobs/test-path.json",
            Checksum = "checksum-1",
            MetadataJson = "{}",
            Name = "timeline",
            CreatedAtUtc = DateTimeOffset.UtcNow
        };
        _context.ArtifactRegistryEntries.Add(entry);
        await _context.SaveChangesAsync();

        var expectedContent = "{\"timeline\":[]}";
        _mockStorageProvider.Setup(s => s.ReadArtifactTextAsync("jobs/test-path.json", It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedContent);

        // Act
        var result = await _controller.GetArtifact(_jobId, "L1-007", CancellationToken.None);

        // Assert
        var contentResult = result.Should().BeOfType<ContentResult>().Subject;
        contentResult.ContentType.Should().Be("application/json");
        contentResult.Content.Should().Be(expectedContent);
    }

    [Fact]
    public async Task GetArtifact_Should_Fallback_To_Database_When_StorageFailsOrNotFound()
    {
        // Arrange
        var entry = new ArtifactRegistryEntry
        {
            Id = Guid.NewGuid(),
            JobId = _jobId,
            ArtifactId = "L1-011",
            StoragePath = "jobs/test-path.json",
            Checksum = "checksum-2",
            MetadataJson = "{}",
            Name = "codequality",
            CreatedAtUtc = DateTimeOffset.UtcNow
        };
        _context.ArtifactRegistryEntries.Add(entry);

        var task = new AnalysisTask
        {
            Id = Guid.NewGuid(),
            JobId = _jobId,
            TaskType = "CodeQuality",
            Status = "Completed"
        };
        _context.AnalysisTasks.Add(task);

        var taskResult = new AnalysisTaskResult
        {
            TaskId = task.Id,
            Task = task,
            ResultData = "{\"fallback\": true}"
        };
        _context.AnalysisTaskResults.Add(taskResult);
        await _context.SaveChangesAsync();

        // Storage provider fails
        _mockStorageProvider.Setup(s => s.ReadArtifactTextAsync("jobs/test-path.json", It.IsAny<CancellationToken>()))
            .ThrowsAsync(new FileNotFoundException());

        // Act
        var result = await _controller.GetArtifact(_jobId, "L1-011", CancellationToken.None);

        // Assert
        var contentResult = result.Should().BeOfType<ContentResult>().Subject;
        contentResult.ContentType.Should().Be("application/json");
        contentResult.Content.Should().Be(taskResult.ResultData);
    }

    [Fact]
    public async Task GetArtifact_Should_Map_ShortKey_To_TaskType_And_Fallback_To_Database_Successfully()
    {
        // Arrange
        var task = new AnalysisTask
        {
            Id = Guid.NewGuid(),
            JobId = _jobId,
            TaskType = "CloneDetection",
            Status = "Completed"
        };
        _context.AnalysisTasks.Add(task);

        var taskResult = new AnalysisTaskResult
        {
            TaskId = task.Id,
            Task = task,
            ResultData = "{\"clones\": []}"
        };
        _context.AnalysisTaskResults.Add(taskResult);
        await _context.SaveChangesAsync();

        // Act
        var result = await _controller.GetArtifact(_jobId, "L1-013", CancellationToken.None); // L1-013 maps to CloneDetection

        // Assert
        var contentResult = result.Should().BeOfType<ContentResult>().Subject;
        contentResult.ContentType.Should().Be("application/json");
        contentResult.Content.Should().Be(taskResult.ResultData);
    }

    [Fact]
    public async Task GetArtifact_Should_Return_NotFound_When_DoesNotExist()
    {
        // Act
        var result = await _controller.GetArtifact(_jobId, "L1-999", CancellationToken.None);

        // Assert
        result.Should().BeOfType<NotFoundObjectResult>();
    }

    public void Dispose()
    {
        _context.Dispose();
    }
}
