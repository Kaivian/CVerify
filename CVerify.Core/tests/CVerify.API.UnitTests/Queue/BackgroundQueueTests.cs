
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using FluentAssertions;
using Moq;
using Xunit;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Email.DTOs;
using CVerify.API.Modules.Shared.Email.Services;

namespace CVerify.API.UnitTests.Queue;

/// <summary>
/// Unit tests for the background channel queue and worker hosted process lifecycle.
/// </summary>
public class BackgroundQueueTests
{
    private readonly BackgroundEmailQueue _queue;
    private readonly Mock<IServiceProvider> _serviceProviderMock;
    private readonly Mock<IServiceScopeFactory> _scopeFactoryMock;
    private readonly Mock<IServiceScope> _scopeMock;
    private readonly Mock<IEmailSender> _rawSenderMock;
    private readonly Mock<ILogger<BackgroundEmailQueueProcessor>> _loggerMock;
    private readonly BackgroundEmailQueueProcessor _processor;

    /// <summary>
    /// Initializes a new instance of the <see cref="BackgroundQueueTests"/> class.
    /// </summary>
    public BackgroundQueueTests()
    {
        _queue = new BackgroundEmailQueue();
        _serviceProviderMock = new Mock<IServiceProvider>();
        _scopeFactoryMock = new Mock<IServiceScopeFactory>();
        _scopeMock = new Mock<IServiceScope>();
        _rawSenderMock = new Mock<IEmailSender>();
        _loggerMock = new Mock<ILogger<BackgroundEmailQueueProcessor>>();

        // Cast service provider mock to mock keyed provider and setup "raw" IEmailSender resolution BEFORE accessing .Object
        var keyedProvider = _serviceProviderMock.As<IKeyedServiceProvider>();
        keyedProvider.Setup(k => k.GetKeyedService(typeof(IEmailSender), "raw")).Returns(_rawSenderMock.Object);
        keyedProvider.Setup(k => k.GetRequiredKeyedService(typeof(IEmailSender), "raw")).Returns(_rawSenderMock.Object);

        // Setup DI scope structures
        _scopeMock.Setup(s => s.ServiceProvider).Returns(_serviceProviderMock.Object);
        _scopeFactoryMock.Setup(f => f.CreateScope()).Returns(_scopeMock.Object);
        _serviceProviderMock.Setup(s => s.GetService(typeof(IServiceScopeFactory))).Returns(_scopeFactoryMock.Object);

        _processor = new BackgroundEmailQueueProcessor(_queue, _serviceProviderMock.Object, _loggerMock.Object);
    }

    [Fact]
    public void QueueEmail_ShouldSuccessfullyEnqueueMessage()
    {
        // Arrange
        var msg = CreateTestMessage("user@example.com");

        // Act
        _queue.QueueEmail(msg);

        // Assert
        _queue.TryDequeue(out var dequeued).Should().BeTrue();
        dequeued.Should().BeEquivalentTo(msg);
    }

    [Fact]
    public async Task Processor_ShouldProcessEnqueuedEmailsInFIFOOrder()
    {
        // Arrange
        var msg1 = CreateTestMessage("user1@example.com");
        var msg2 = CreateTestMessage("user2@example.com");

        _queue.QueueEmail(msg1);
        _queue.QueueEmail(msg2);

        var processed = new List<EmailMessage>();
        _rawSenderMock.Setup(s => s.SendEmailAsync(It.IsAny<EmailMessage>(), It.IsAny<CancellationToken>()))
            .Callback<EmailMessage, CancellationToken>((msg, ct) => processed.Add(msg))
            .Returns(Task.CompletedTask);

        var cts = new CancellationTokenSource();

        // Act - Start background worker task
        var startTask = _processor.StartAsync(cts.Token);

        // Yield execution to allow processor loops to query the channel
        await Task.Delay(200).ConfigureAwait(false);

        // Stop the worker gracefully (drains remaining items)
        await _processor.StopAsync(CancellationToken.None).ConfigureAwait(false);
        await startTask.ConfigureAwait(false);

        // Assert
        processed.Should().HaveCount(2);
        processed[0].ToEmail.Should().Be("user1@example.com");
        processed[1].ToEmail.Should().Be("user2@example.com");
    }

    [Fact]
    public async Task QueueEmail_ShouldSupportHighThroughputConcurrentEnqueue()
    {
        var messages = Enumerable.Range(0, 500)
            .Select(i => CreateTestMessage($"user{i}@example.com"))
            .ToList();

        // Act - Parallel enqueues
        await Task.WhenAll(messages.Select(msg => Task.Run(() => _queue.QueueEmail(msg)))).ConfigureAwait(false);

        // Assert
        var dequeuedCount = 0;
        while (_queue.TryDequeue(out _))
        {
            dequeuedCount++;
        }

        dequeuedCount.Should().Be(500);
    }

    private static EmailMessage CreateTestMessage(string toEmail)
    {
        return new EmailMessage(
            ToEmail: toEmail,
            ToName: "Test User",
            Subject: "Subject",
            HtmlContent: "<p>body</p>",
            PlainTextContent: "body",
            CorrelationId: Guid.NewGuid().ToString("N"),
            Category: EmailCategory.Notification,
            IdempotencyKey: null
        );
    }
}
