using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;
using FluentAssertions;
using StackExchange.Redis;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.UnitTests.Services;

public class AiStreamingSessionServiceTests : IDisposable
{
    private readonly ApplicationDbContext _context;
    private readonly Mock<IConnectionMultiplexer> _mockRedis;
    private readonly Mock<IDatabase> _mockDb;
    private readonly Mock<ISubscriber> _mockSubscriber;

    public AiStreamingSessionServiceTests()
    {
        var dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        _context = new ApplicationDbContext(dbOptions);

        _mockRedis = new Mock<IConnectionMultiplexer>();
        _mockDb = new Mock<IDatabase>();
        _mockSubscriber = new Mock<ISubscriber>();

        _mockRedis.Setup(r => r.GetDatabase(It.IsAny<int>(), It.IsAny<object>())).Returns(_mockDb.Object);
        _mockRedis.Setup(r => r.GetSubscriber(It.IsAny<object>())).Returns(_mockSubscriber.Object);
    }

    public void Dispose()
    {
        _context.Dispose();
    }

    [Fact]
    public async Task GetFormattedHistoryAsync_ShouldSortChronologicallyAndAssignMonotonicallyIncreasingSequenceNumbers()
    {
        // Arrange
        var sessionId = Guid.NewGuid();
        var session = new AiStreamingSession
        {
            Id = sessionId,
            PipelineId = "candidate-assessment",
            UserId = Guid.NewGuid(),
            Status = "Running",
            Progress = 45.0,
            ModelName = "Claude 3.5 Sonnet",
            Provider = "Anthropic",
            PipelineVersion = "1.0.0",
            CreatedAtUtc = DateTimeOffset.UtcNow.AddMinutes(-5),
            LastUpdatedUtc = DateTimeOffset.UtcNow
        };
        _context.AiStreamingSessions.Add(session);

        // Stages and logs with out-of-order timestamps
        var stage1 = new AiStreamingStage
        {
            Id = Guid.NewGuid(),
            SessionId = sessionId,
            StageId = "Stage1",
            StageName = "Stage 1",
            Status = "Completed",
            Progress = 100.0,
            StartedAt = DateTimeOffset.UtcNow.AddMinutes(-4),
            CompletedAt = DateTimeOffset.UtcNow.AddMinutes(-3),
            Description = "Stage 1 done"
        };
        var stage2 = new AiStreamingStage
        {
            Id = Guid.NewGuid(),
            SessionId = sessionId,
            StageId = "Stage2",
            StageName = "Stage 2",
            Status = "Running",
            Progress = 30.0,
            StartedAt = DateTimeOffset.UtcNow.AddMinutes(-1),
            Description = "Stage 2 in progress"
        };
        var log1 = new AiStreamingLog
        {
            Id = Guid.NewGuid(),
            SessionId = sessionId,
            StageId = "Stage1",
            LogLevel = "Info",
            Component = "Orchestrator",
            Message = "Log 1 message",
            Timestamp = DateTimeOffset.UtcNow.AddMinutes(-3.5)
        };

        _context.AiStreamingStages.AddRange(stage1, stage2);
        _context.AiStreamingLogs.Add(log1);
        await _context.SaveChangesAsync();

        var service = new AiStreamingSessionService(_context, _mockRedis.Object);

        // Act
        var (events, latestTimestamp, sessionStatus) = await service.GetFormattedHistoryAsync(sessionId);

        // Assert
        sessionStatus.Should().Be("Running");
        events.Should().HaveCount(3);

        var parsedEvents = events.Select(e => JsonDocument.Parse(e)).ToList();

        parsedEvents[0].RootElement.GetProperty("sequenceNumber").GetInt64().Should().Be(1);
        parsedEvents[1].RootElement.GetProperty("sequenceNumber").GetInt64().Should().Be(2);
        parsedEvents[2].RootElement.GetProperty("sequenceNumber").GetInt64().Should().Be(3);

        parsedEvents[0].RootElement.GetProperty("eventType").GetString().Should().Be("LOG_EVENT");
        parsedEvents[1].RootElement.GetProperty("eventType").GetString().Should().Be("STAGE_COMPLETED");
        parsedEvents[2].RootElement.GetProperty("eventType").GetString().Should().Be("STAGE_STARTED");

        foreach (var ev in parsedEvents)
        {
            ev.RootElement.GetProperty("eventId").GetString().Should().NotBeNullOrEmpty();
            ev.RootElement.GetProperty("correlationId").GetString().Should().Be(sessionId.ToString());
            ev.RootElement.GetProperty("schemaVersion").GetString().Should().Be("1.0.0");
            ev.RootElement.GetProperty("producer").GetString().Should().Be("AiStreamingSessionService");
            ev.RootElement.GetProperty("status").GetString().Should().Be("Running");
            ev.RootElement.GetProperty("progress").GetDouble().Should().Be(45.0);
        }
    }

    [Fact]
    public async Task PublishEventAsync_ShouldAtomicallyIncrementSequenceAndUseCanonicalContract()
    {
        // Arrange
        var sessionId = Guid.NewGuid();
        var session = new AiStreamingSession
        {
            Id = sessionId,
            PipelineId = "jd-generation",
            UserId = Guid.NewGuid(),
            Status = "Running",
            Progress = 60.0,
            ModelName = "Claude 3.5 Sonnet",
            Provider = "Anthropic",
            PipelineVersion = "1.0.0",
            CreatedAtUtc = DateTimeOffset.UtcNow,
            LastUpdatedUtc = DateTimeOffset.UtcNow
        };
        _context.AiStreamingSessions.Add(session);
        await _context.SaveChangesAsync();

        _mockDb.Setup(d => d.StringIncrementAsync(It.IsAny<RedisKey>(), It.IsAny<long>(), It.IsAny<CommandFlags>()))
            .ReturnsAsync(42);

        string publishedChannel = null;
        string publishedMessage = null;
        _mockSubscriber.Setup(s => s.PublishAsync(It.IsAny<RedisChannel>(), It.IsAny<RedisValue>(), It.IsAny<CommandFlags>()))
            .Callback<RedisChannel, RedisValue, CommandFlags>((channel, value, flags) =>
            {
                if (channel.ToString() == $"ai:streaming:progress:{sessionId}")
                {
                    publishedChannel = channel.ToString();
                    publishedMessage = value.ToString();
                }
            })
            .ReturnsAsync(1);

        var service = new AiStreamingSessionService(_context, _mockRedis.Object);

        // Act
        await service.UpsertStageAsync(sessionId, "Stage1", "Stage 1", "Completed", 100.0, "Done", detailsJson: "{\"output\":\"ok\"}");

        // Assert
        publishedChannel.Should().Be($"ai:streaming:progress:{sessionId}");
        publishedMessage.Should().NotBeNull();

        var doc = JsonDocument.Parse(publishedMessage);
        doc.RootElement.GetProperty("eventId").GetString().Should().NotBeNullOrEmpty();
        doc.RootElement.GetProperty("sequenceNumber").GetInt64().Should().Be(42);
        doc.RootElement.GetProperty("correlationId").GetString().Should().Be(sessionId.ToString());
        doc.RootElement.GetProperty("eventType").GetString().Should().Be("STAGE_COMPLETED");
        doc.RootElement.GetProperty("status").GetString().Should().Be("Running");
        doc.RootElement.GetProperty("progress").GetDouble().Should().Be(60.0);
        doc.RootElement.GetProperty("stageStatus").GetString().Should().Be("Completed");
        doc.RootElement.GetProperty("stageProgress").GetDouble().Should().Be(100.0);
        doc.RootElement.GetProperty("jsonData").GetString().Should().Be("{\"output\":\"ok\"}");
    }
}
