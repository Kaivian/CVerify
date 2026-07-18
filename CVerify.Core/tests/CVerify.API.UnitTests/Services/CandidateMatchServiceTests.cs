using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using FluentAssertions;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Profiles.Entities;
using CVerify.API.Modules.Profiles.Services;
using CVerify.API.Modules.Intelligence.Services;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.System.DTOs;
using CVerify.API.Modules.Shared.System.Services;
using StackExchange.Redis;

namespace CVerify.API.UnitTests.Services;

public class CandidateMatchServiceTests : IDisposable
{
    private readonly ApplicationDbContext _context;
    private readonly Mock<ICapabilityCatalogService> _mockCatalogService;
    private readonly Mock<IHiringRequirementService> _mockHiringRequirementService;
    private readonly Mock<IConnectionMultiplexer> _mockRedis;
    private readonly Mock<IServiceScopeFactory> _mockScopeFactory;
    private readonly Mock<ICandidateEvaluationService> _mockEvaluationService;
    private readonly Mock<IUnifiedMatchingEngine> _mockMatchingEngine;
    private readonly Mock<IAiCancellationManager> _mockCancellationManager;
    private readonly Mock<IAiStreamingSessionService> _mockStreamingSessionService;
    private readonly Mock<ILogger<CandidateMatchService>> _mockLogger;

    private readonly Guid _organizationId = Guid.NewGuid();
    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Guid _candidateId = Guid.NewGuid();
    private readonly Guid _requirementId = Guid.NewGuid();

    public CandidateMatchServiceTests()
    {
        var dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        _context = new ApplicationDbContext(dbOptions);

        _mockCatalogService = new Mock<ICapabilityCatalogService>();
        _mockHiringRequirementService = new Mock<IHiringRequirementService>();
        _mockRedis = new Mock<IConnectionMultiplexer>();
        _mockScopeFactory = new Mock<IServiceScopeFactory>();
        _mockEvaluationService = new Mock<ICandidateEvaluationService>();
        _mockMatchingEngine = new Mock<IUnifiedMatchingEngine>();
        _mockCancellationManager = new Mock<IAiCancellationManager>();
        _mockStreamingSessionService = new Mock<IAiStreamingSessionService>();
        _mockLogger = new Mock<ILogger<CandidateMatchService>>();

        var mockDb = new Mock<IDatabase>();
        _mockRedis.Setup(r => r.GetDatabase(It.IsAny<int>(), It.IsAny<object>())).Returns(mockDb.Object);
        var mockSubscriber = new Mock<ISubscriber>();
        _mockRedis.Setup(r => r.GetSubscriber(It.IsAny<object>())).Returns(mockSubscriber.Object);
    }

    public void Dispose()
    {
        _context.Dispose();
    }

    [Fact]
    public async Task GetCandidateMatchesAsync_ShouldThrowKeyNotFoundException_WhenRequirementDoesNotExist()
    {
        // Arrange
        var service = new CandidateMatchService(
            _context,
            _mockCatalogService.Object,
            _mockHiringRequirementService.Object,
            _mockRedis.Object,
            _mockScopeFactory.Object,
            _mockEvaluationService.Object,
            _mockMatchingEngine.Object,
            _mockCancellationManager.Object,
            _mockStreamingSessionService.Object,
            _mockLogger.Object
        );

        // Act & Assert
        await Assert.ThrowsAsync<KeyNotFoundException>(() => service.GetCandidateMatchesAsync(Guid.NewGuid(), CancellationToken.None));
    }

    [Fact]
    public async Task TriggerDiscoveryAsync_ShouldInitializeDiscoveryAndReturnPendingStatus()
    {
        // Arrange
        var requirement = new HiringRequirement
        {
            Id = _requirementId,
            OrganizationId = _organizationId,
            WorkspaceId = _workspaceId,
            Title = "Backend Architect",
            Department = "Engineering",
            Seniority = "Senior",
            WorkplaceType = "Remote",
            EmploymentType = "Full-Time",
            SalaryMin = 8000,
            SalaryMax = 12000,
            Currency = "USD",
            Status = "Published"
        };
        _context.HiringRequirements.Add(requirement);

        var user = new User
        {
            Id = _candidateId,
            FullName = "Verify Candidate",
            Email = "candidate@cverify.com",
            Username = "cverify_cand"
        };
        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        var mockScope = new Mock<IServiceScope>();
        var mockServiceProvider = new Mock<IServiceProvider>();
        mockScope.Setup(s => s.ServiceProvider).Returns(mockServiceProvider.Object);
        _mockScopeFactory.Setup(sf => sf.CreateScope()).Returns(mockScope.Object);

        var service = new CandidateMatchService(
            _context,
            _mockCatalogService.Object,
            _mockHiringRequirementService.Object,
            _mockRedis.Object,
            _mockScopeFactory.Object,
            _mockEvaluationService.Object,
            _mockMatchingEngine.Object,
            _mockCancellationManager.Object,
            _mockStreamingSessionService.Object,
            _mockLogger.Object
        );

        mockServiceProvider.Setup(sp => sp.GetService(typeof(ICandidateMatchService)))
            .Returns(service);

        // Act
        var result = await service.TriggerDiscoveryAsync(_requirementId, _candidateId, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Status.Should().Be(DiscoveryStatus.Pending);

        var savedRun = await _context.CandidateDiscoveryRuns.FirstOrDefaultAsync(r => r.Id == result.RunId);
        savedRun.Should().NotBeNull();
        savedRun!.HiringRequirementId.Should().Be(_requirementId);
        savedRun.TriggeredById.Should().Be(_candidateId);
        savedRun.Status.Should().Be(DiscoveryStatus.Pending);

        _mockStreamingSessionService.Verify(s => s.CreateSessionAsync(
            _requirementId, "candidate-discovery", _candidateId, _workspaceId, "Claude 3.5 Sonnet", "Anthropic", "1.0.0", "[\"CandidateMatches\"]"
        ), Times.Once);
    }

    [Fact]
    public async Task CancelDiscoveryAsync_ShouldSetRedisKeyAndReturnTrue()
    {
        // Arrange
        var run = new CandidateDiscoveryRun
        {
            Id = Guid.NewGuid(),
            HiringRequirementId = _requirementId,
            Status = DiscoveryStatus.Searching,
            StartedAt = DateTimeOffset.UtcNow
        };
        _context.CandidateDiscoveryRuns.Add(run);
        await _context.SaveChangesAsync();

        var mockDb = new Mock<IDatabase>();
        _mockRedis.Setup(r => r.GetDatabase(It.IsAny<int>(), It.IsAny<object>())).Returns(mockDb.Object);
        mockDb.Setup(d => d.StringSetAsync(It.IsAny<RedisKey>(), It.IsAny<RedisValue>(), It.IsAny<TimeSpan?>(), It.IsAny<bool>(), It.IsAny<When>(), It.IsAny<CommandFlags>()))
            .ReturnsAsync(true);

        var service = new CandidateMatchService(
            _context,
            _mockCatalogService.Object,
            _mockHiringRequirementService.Object,
            _mockRedis.Object,
            _mockScopeFactory.Object,
            _mockEvaluationService.Object,
            _mockMatchingEngine.Object,
            _mockCancellationManager.Object,
            _mockStreamingSessionService.Object,
            _mockLogger.Object
        );

        // Act
        var result = await service.CancelDiscoveryAsync(_requirementId);

        // Assert
        result.Should().BeTrue();
        _mockCancellationManager.Verify(c => c.Cancel(_requirementId), Times.Once);
    }
}
