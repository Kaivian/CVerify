
using System;
using System.Collections.Concurrent;
using System.Linq;
using System.Threading.Tasks;
using FluentAssertions;
using Xunit;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Email.DTOs;
using CVerify.API.Modules.Shared.Email.Services;

namespace CVerify.API.PerformanceTests.Stress;

/// <summary>
/// Concurrency and memory stability stress tests for high-throughput messaging channels.
/// Decorated with the Performance category trait to isolate from standard CI execution paths.
/// </summary>
[Trait("Category", "Performance")]
public class PerformanceStressTests
{
    [Fact]
    public async Task EnqueueStress_ShouldHandle1000ConcurrentTasksWithoutMessageLossOrDeadlocks()
    {
        // Arrange
        var queue = new BackgroundEmailQueue();
        var totalMessages = 1000;

        // Act - Trigger 1000 simultaneous parallel task dispatches
        await Task.WhenAll(Enumerable.Range(0, totalMessages).Select(index => Task.Run(() =>
        {
            var message = new EmailMessage(
                ToEmail: $"stress{index}@performance.com",
                ToName: $"Stress User {index}",
                Subject: "High Concurrency Audit",
                HtmlContent: "<p>body</p>",
                PlainTextContent: "body",
                CorrelationId: Guid.NewGuid().ToString("N"),
                Category: EmailCategory.Notification,
                IdempotencyKey: null
            );
            queue.QueueEmail(message);
        })));

        // Assert
        var processedCount = 0;
        while (queue.TryDequeue(out _))
        {
            processedCount++;
        }

        processedCount.Should().Be(totalMessages);
    }
}
