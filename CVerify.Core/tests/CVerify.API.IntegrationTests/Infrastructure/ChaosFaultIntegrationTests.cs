
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using FluentAssertions;
using Moq;
using Xunit;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Email.DTOs;
using CVerify.API.Modules.Shared.Email.Services;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.IntegrationTests.Infrastructure;

/// <summary>
/// Chaos and Fault-Injection tests verifying graceful degradation under backend infrastructure failures.
/// </summary>
public class ChaosFaultIntegrationTests
{
    private readonly Mock<IEmailSender> _senderMock;
    private readonly Mock<IEmailTemplateService> _templateMock;
    private readonly Mock<ICacheService> _cacheMock;
    private readonly Mock<ILogger<EmailService>> _loggerMock;
    private readonly Mock<IEmailRecipientResolver> _recipientResolverMock;
    private readonly EmailService _service;

    /// <summary>
    /// Initializes a new instance of the <see cref="ChaosFaultIntegrationTests"/> class.
    /// </summary>
    public ChaosFaultIntegrationTests()
    {
        _senderMock = new Mock<IEmailSender>();
        _templateMock = new Mock<IEmailTemplateService>();
        _cacheMock = new Mock<ICacheService>();
        _loggerMock = new Mock<ILogger<EmailService>>();
        _recipientResolverMock = new Mock<IEmailRecipientResolver>();

        _recipientResolverMock.Setup(r => r.ResolveByEmailAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((string email, CancellationToken ct) => new RecipientProfile(email, null, null));

        _service = new EmailService(
            _senderMock.Object,
            _templateMock.Object,
            _cacheMock.Object,
            _loggerMock.Object,
            _recipientResolverMock.Object
        );
    }

    [Fact]
    public async Task SendVerificationEmailAsync_ShouldSucceedAndDeliver_WhenRedisCacheIsOffline()
    {
        // Arrange
        var toEmail = "chaos-user@example.com";
        var fullName = "Luc Chaos User";
        var link = "https://cverify.ai/verify?token=chaos_test_token_999";

        // Simulate a complete Redis connection outage by throwing socket exceptions on cache calls
        _cacheMock.Setup(c => c.ExistsAsync(It.IsAny<string>()))
            .ThrowsAsync(new TimeoutException("Redis connection timed out. Cache instance unreachable."));

        _cacheMock.Setup(c => c.SetAsync(It.IsAny<string>(), It.IsAny<object>(), It.IsAny<TimeSpan?>()))
            .ThrowsAsync(new TimeoutException("Redis connection timed out. Cache instance unreachable."));

        _templateMock.Setup(t => t.RenderTemplateAsync(It.IsAny<string>(), It.IsAny<Dictionary<string, object>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("<h1>Chaos Test Passed</h1>");

        _senderMock.Setup(s => s.SendEmailAsync(It.IsAny<EmailMessage>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        // Act
        var action = async () => await _service.SendVerificationEmailAsync(toEmail, fullName, link).ConfigureAwait(false);

        // Assert
        // The business orchestrator must degrade gracefully, bypass cache checks, and successfully invoke SMTP transport!
        await action.Should().NotThrowAsync();
        _senderMock.Verify(s => s.SendEmailAsync(It.IsAny<EmailMessage>(), It.IsAny<CancellationToken>()), Times.Once);
    }
}
