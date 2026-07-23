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

public class AdminDashboardFacadeTests
{
    private readonly ApplicationDbContext _db;
    private readonly Mock<IObservabilityMetricsCollector> _metricsCollectorMock;
    private readonly IMemoryCache _cache;
    private readonly Mock<ILogger<AdminDashboardFacade>> _loggerMock;
    private readonly AdminDashboardFacade _facade;

    public AdminDashboardFacadeTests()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        _db = new ApplicationDbContext(options);
        _metricsCollectorMock = new Mock<IObservabilityMetricsCollector>();
        _cache = new MemoryCache(new MemoryCacheOptions());
        _loggerMock = new Mock<ILogger<AdminDashboardFacade>>();

        _metricsCollectorMock.Setup(m => m.CollectMetricsAsync())
            .ReturnsAsync(new SystemMetricsResponseDto
            {
                Server = new ServerMetricsDto
                {
                    CpuUsage = new MetricItemDto<double> { Value = 18.4, Status = "normal" },
                    RamUsage = new MetricItemDto<double> { Value = 26.2, Status = "normal" },
                    RamUsedMb = new MetricItemDto<double> { Value = 4296.0 },
                    RamTotalMb = new MetricItemDto<double> { Value = 16384.0 },
                    DiskUsage = new MetricItemDto<double> { Value = 14.2, Status = "normal" },
                    DiskUsedGb = new MetricItemDto<double> { Value = 142.8 },
                    DiskTotalGb = new MetricItemDto<double> { Value = 1000.0 },
                    NetworkUploadKb = new MetricItemDto<double> { Value = 180.5 },
                    NetworkDownloadKb = new MetricItemDto<double> { Value = 340.2 }
                }
            });

        _facade = new AdminDashboardFacade(_db, _metricsCollectorMock.Object, _cache, _loggerMock.Object);
    }

    [Fact]
    public async Task GetPlatformHealthWidgetAsync_WithDefaultFilter_ReturnsValidDto()
    {
        // Act
        var result = await _facade.GetPlatformHealthWidgetAsync();

        // Assert
        result.Should().NotBeNull();
        result.SuccessRatePercent.Should().BeGreaterThanOrEqualTo(0.0);
        result.TotalUsers.Should().Be(0);
    }

    [Fact]
    public async Task GetPlatformHealthWidgetAsync_WithFilter_ParsesTimeRangeCorrectly()
    {
        // Arrange
        var filter = new DashboardFilterQueryDto
        {
            TimeRange = "1h",
            Environment = "production",
            AiProvider = "gemini"
        };

        // Act
        var result = await _facade.GetPlatformHealthWidgetAsync(filter);

        // Assert
        result.Should().NotBeNull();
        result.SuccessRatePercent.Should().Be(99.2);
    }

    [Fact]
    public async Task GetInfrastructureWidgetAsync_ReturnsMetricsData()
    {
        // Act
        var result = await _facade.GetInfrastructureWidgetAsync();

        // Assert
        result.Should().NotBeNull();
        result.CpuUsagePercent.Should().Be(18.4);
        result.RamUsedMb.Should().Be(4296.0);
    }

    [Fact]
    public async Task GetAiOpsWidgetAsync_FiltersByAiProvider()
    {
        // Arrange
        var filter = new DashboardFilterQueryDto
        {
            AiProvider = "gemini"
        };

        // Act
        var result = await _facade.GetAiOpsWidgetAsync(filter);

        // Assert
        result.Should().NotBeNull();
        result.ProviderDistribution.Should().ContainKey("Google Vertex AI / Gemini");
        result.ProviderDistribution.Should().NotContainKey("OpenAI Direct API");
    }
}
