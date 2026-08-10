using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using FluentAssertions;
using StackExchange.Redis;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.System.DTOs;
using CVerify.API.Modules.Shared.System.Services;
using CVerify.API.Modules.Shared.System.Controllers;

namespace CVerify.API.UnitTests.Controllers;

public class HiringRequirementControllerTests
{
    private readonly Mock<IHiringRequirementService> _mockService;
    private readonly Mock<ICandidateMatchService> _mockMatchService;
    private readonly Mock<IConnectionMultiplexer> _mockRedis;
    private readonly Mock<ICapabilityCatalogService> _mockCatalog;
    private readonly Mock<IServiceScopeFactory> _mockScopeFactory;
    private readonly Mock<ILogger<HiringRequirementController>> _mockLogger;
    private readonly Mock<IAiStreamingSessionService> _mockStreamingService;
    private readonly HiringRequirementController _controller;
    private readonly Guid _userId = Guid.NewGuid();

    public HiringRequirementControllerTests()
    {
        _mockService = new Mock<IHiringRequirementService>();
        _mockMatchService = new Mock<ICandidateMatchService>();
        _mockRedis = new Mock<IConnectionMultiplexer>();
        _mockCatalog = new Mock<ICapabilityCatalogService>();
        _mockScopeFactory = new Mock<IServiceScopeFactory>();
        _mockLogger = new Mock<ILogger<HiringRequirementController>>();
        _mockStreamingService = new Mock<IAiStreamingSessionService>();

        _controller = new HiringRequirementController(
            _mockService.Object,
            _mockMatchService.Object,
            _mockRedis.Object,
            _mockCatalog.Object,
            _mockScopeFactory.Object,
            _mockLogger.Object,
            _mockStreamingService.Object
        );

        // Setup mock user HttpContext
        var claims = new List<Claim> { new Claim(ClaimTypes.NameIdentifier, _userId.ToString()) };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        var principal = new ClaimsPrincipal(identity);
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = principal }
        };
    }

    [Fact]
    public async Task CreateDraft_Should_Return_Created_Result()
    {
        // Arrange
        var request = new CreateHiringRequirementRequestDto("kaivian-corp", "Backend", "Eng", "Senior", "Remote", null, "Full-Time", 1);
        var req = new HiringRequirement
        {
            Id = Guid.NewGuid(),
            Status = "Draft",
            Version = 1,
            CreatedAt = DateTimeOffset.UtcNow
        };
        _mockService.Setup(s => s.CreateDraftAsync(request, _userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(req);

        // Act
        var result = await _controller.CreateDraft(request, CancellationToken.None);

        // Assert
        var createdResult = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        createdResult.ActionName.Should().Be(nameof(HiringRequirementController.GetById));
    }

    [Fact]
    public async Task UpdateDraft_Should_Return_Ok_With_Updated_Requirement()
    {
        // Arrange
        var id = Guid.NewGuid();
        var request = new UpdateHiringRequirementRequestDto(null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null);
        var req = new HiringRequirement { Id = id, Title = "Updated" };
        _mockService.Setup(s => s.UpdateDraftAsync(id, request, It.IsAny<CancellationToken>()))
            .ReturnsAsync(req);

        // Act
        var result = await _controller.UpdateDraft(id, request, CancellationToken.None);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.Value.Should().Be(req);
    }

    [Fact]
    public async Task GetById_Should_Return_NotFound_When_RequirementDoesNotExist()
    {
        // Arrange
        var id = Guid.NewGuid();
        _mockService.Setup(s => s.GetByIdAsync(id, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new KeyNotFoundException());

        // Act
        var result = await _controller.GetById(id, CancellationToken.None);

        // Assert
        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task GenerateArtifacts_Should_Return_Accepted_And_Spawn_Task()
    {
        // Arrange
        var id = Guid.NewGuid();
        var req = new HiringRequirement { Id = id, Status = "Draft", WorkspaceId = Guid.NewGuid() };
        _mockService.Setup(s => s.GetByIdAsync(id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(req);

        // Mock scoped provider resolution for background task run
        var mockScope = new Mock<IServiceScope>();
        var mockServiceProvider = new Mock<IServiceProvider>();
        mockScope.Setup(s => s.ServiceProvider).Returns(mockServiceProvider.Object);
        mockServiceProvider.Setup(s => s.GetService(typeof(IHiringRequirementService)))
            .Returns(_mockService.Object);
        _mockScopeFactory.Setup(f => f.CreateScope()).Returns(mockScope.Object);

        // Act
        var result = await _controller.GenerateArtifacts(id);

        // Assert
        var acceptedResult = result.Should().BeOfType<AcceptedResult>().Subject;
        acceptedResult.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task CancelArtifactGeneration_Should_Call_Service_Cancel_Successfully()
    {
        // Arrange
        var id = Guid.NewGuid();
        var req = new HiringRequirement { Id = id };
        _mockService.Setup(s => s.GetByIdAsync(id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(req);
        var request = new CancelArtifactRequestDto("JobDescription");

        // Act
        var result = await _controller.CancelArtifactGeneration(id, request);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        _mockService.Verify(s => s.CancelGenerationAsync(id, "JobDescription"), Times.Once);
    }

    [Fact]
    public async Task Publish_Should_Return_Ok_With_Snapshot_Details()
    {
        // Arrange
        var id = Guid.NewGuid();
        var snapshot = new RequirementSnapshot { Id = Guid.NewGuid(), Version = 2, SnapshottedAt = DateTimeOffset.UtcNow };
        _mockService.Setup(s => s.PublishAsync(id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(snapshot);

        // Act
        var result = await _controller.Publish(id, CancellationToken.None);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.Value.Should().NotBeNull();
    }
}
