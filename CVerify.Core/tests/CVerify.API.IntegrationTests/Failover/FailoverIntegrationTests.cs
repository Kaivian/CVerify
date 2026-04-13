
using System;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using FluentAssertions;
using Moq;
using Moq.Protected;
using Polly;
using Xunit;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Email.DTOs;
using CVerify.API.Modules.Shared.Email.Services;

namespace CVerify.API.IntegrationTests.Failover;

/// <summary>
/// High-fidelity integration tests verifying that <see cref="FailoverEmailSender"/> handles
/// primary SMTP failures and automatically routes dispatches through the SendGrid gateway.
/// </summary>
public class FailoverIntegrationTests
{
    private readonly Mock<IEmailAuditLogger> _auditLoggerMock;
    private readonly Mock<ILogger<FailoverEmailSender>> _loggerMock;
    private readonly FailoverEmailSender _failoverSender;

    /// <summary>
    /// Initializes a new instance of the <see cref="FailoverIntegrationTests"/> class.
    /// </summary>
    public FailoverIntegrationTests()
    {
        _auditLoggerMock = new Mock<IEmailAuditLogger>();
        _loggerMock = new Mock<ILogger<FailoverEmailSender>>();

        var settings = new EmailSettings
        {
            SenderEmail = "sender@cverify.ai",
            SenderName = "Luc CVerify Sender",
            TimeoutSeconds = 1,
            Provider = EmailProvider.Failover,
            Smtp = new SmtpSettings
            {
                Host = "invalid-smtp-host-domain.xyz", // Triggers connection socket errors
                Port = 25,
                Username = "",
                Password = "",
                EnableSsl = false
            },
            SendGrid = new SendGridSettings
            {
                ApiKey = "SG.dummy_api_key"
            }
        };

        var options = Options.Create(settings);
        var pipeline = ResiliencePipeline.Empty;

        // Construct real MailKitSmtpSender (which will fail due to DNS/connection error)
        var smtpSender = new MailKitSmtpSender(options, _auditLoggerMock.Object, pipeline);

        // Construct SendGridHttpSender with mocked HttpClient handler
        var handlerMock = new Mock<HttpMessageHandler>(MockBehavior.Strict);
        handlerMock
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage
            {
                StatusCode = HttpStatusCode.Accepted,
                Content = new StringContent("{}")
            });

        var httpClient = new HttpClient(handlerMock.Object);
        var sendGridSender = new SendGridHttpSender(httpClient, options, _auditLoggerMock.Object, pipeline);

        _failoverSender = new FailoverEmailSender(smtpSender, sendGridSender, _loggerMock.Object);
    }

    [Fact]
    public async Task SendEmailAsync_ShouldFallbackToSendGrid_WhenSmtpFails()
    {
        // Arrange
        var message = new EmailMessage(
            ToEmail: "failover-user@example.com",
            ToName: "Luc Failover User",
            Subject: "Failover Alert",
            HtmlContent: "<p>body</p>",
            PlainTextContent: "body",
            CorrelationId: "corr_failover_123",
            Category: EmailCategory.Security,
            IdempotencyKey: null
        );

        // Act
        var action = async () => await _failoverSender.SendEmailAsync(message).ConfigureAwait(false);

        // Assert - The send call should complete successfully since the backup transport (SendGrid HTTP) works!
        await action.Should().NotThrowAsync().ConfigureAwait(false);

        // Verify that SMTP failure and SendGrid success were logged in audit trail
        _auditLoggerMock.Verify(a => a.LogFailed(message, "SMTP", It.IsAny<Exception>()), Times.Once);
        _auditLoggerMock.Verify(a => a.LogSent(message, "SendGrid"), Times.Once);
    }
}
