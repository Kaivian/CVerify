using System;
using System.Collections.Concurrent;
using System.Linq;
using System.Threading.Tasks;
using FluentAssertions;
using CVerify.API.Application.DTOs;
using CVerify.API.Infrastructure.Configuration;
using CVerify.API.Infrastructure.Services;
using Xunit;

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
        }))).ConfigureAwait(false);

        // Assert
        var processedCount = 0;
        while (queue.TryDequeue(out _))
        {
            processedCount++;
        }

        processedCount.Should().Be(totalMessages);
    }
}
