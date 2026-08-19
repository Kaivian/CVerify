using System;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using CVerify.API.Modules.Admin.DTOs;
using CVerify.API.Modules.Admin.Services;
using CVerify.API.Modules.Shared.Persistence;

namespace CVerify.API.UnitTests.Services;

public class AdminDashboardChaosTests
{
    [Fact]
    public async Task GetPlatformHealthWidgetAsync_WhenMetricsCollectorThrows_ReturnsFallbackDtoWithoutCrashing()
    {
        // Arrange
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        var db = new ApplicationDbContext(options);

        var metricsMock = new Mock<IObservabilityMetricsCollector>();
        metricsMock.Setup(m => m.CollectMetricsAsync())
            .ThrowsAsync(new InvalidOperationException("Simulated Database Timeout / Failure Injection"));

        var cache = new MemoryCache(new MemoryCacheOptions());
        var loggerMock = new Mock<ILogger<AdminDashboardFacade>>();

        var facade = new AdminDashboardFacade(db, metricsMock.Object, cache, loggerMock.Object);

        // Act
        var result = await facade.GetInfrastructureWidgetAsync();

        // Assert: Ensure exception is swallowed defensively and fallback DTO is returned
        result.Should().NotBeNull();
        result.CpuUsagePercent.Should().Be(20.0);
        result.DbHealthy.Should().BeTrue();
    }

    [Fact]
    public async Task GetOverviewAsync_WhenSubWidgetFails_ReturnsPartialOverviewWithNonNullWidgets()
    {
        // Arrange
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        var db = new ApplicationDbContext(options);

        var metricsMock = new Mock<IObservabilityMetricsCollector>();
        metricsMock.Setup(m => m.CollectMetricsAsync())
            .ThrowsAsync(new TimeoutException("Simulated Network Timeout"));

        var cache = new MemoryCache(new MemoryCacheOptions());
        var loggerMock = new Mock<ILogger<AdminDashboardFacade>>();

        var facade = new AdminDashboardFacade(db, metricsMock.Object, cache, loggerMock.Object);

        // Act
        var overview = await facade.GetOverviewAsync();

        // Assert: Entire overview should complete without crashing
        overview.Should().NotBeNull();
        overview.Health.Should().NotBeNull();
        overview.Infrastructure.Should().NotBeNull();
        overview.AiOperations.Should().NotBeNull();
    }
}
