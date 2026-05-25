using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Time.Testing;
using Moq;
using CVerify.API.Application.DTOs;
using CVerify.API.Application.Interfaces;
using CVerify.API.Infrastructure.Configuration;
using CVerify.API.Infrastructure.Services;
using Xunit;

namespace CVerify.API.UnitTests.Services;

/// <summary>
/// Unit tests for the business orchestrator <see cref="EmailService"/>, validating categories, trace metadata, and Redis-backed idempotency locks.
/// </summary>
public class EmailServiceTests
{
    private readonly Mock<IEmailSender> _senderMock;
    private readonly Mock<IEmailTemplateService> _templateMock;
    private readonly Mock<ICacheService> _cacheMock;
    private readonly Mock<ILogger<EmailService>> _loggerMock;
    private readonly FakeTimeProvider _timeProvider;
    private readonly EmailService _service;

    /// <summary>
    /// Initializes a new instance of the <see cref="EmailServiceTests"/> class.
    /// </summary>
    public EmailServiceTests()
    {
        _senderMock = new Mock<IEmailSender>();
        _templateMock = new Mock<IEmailTemplateService>();
        _cacheMock = new Mock<ICacheService>();
        _loggerMock = new Mock<ILogger<EmailService>>();
        _timeProvider = new FakeTimeProvider();

        _service = new EmailService(
            _senderMock.Object,
            _templateMock.Object,
            _cacheMock.Object,
            _loggerMock.Object,
            _timeProvider
        );
    }

    [Fact]
    public async Task SendVerificationEmailAsync_ShouldCompileTemplateAndSendMimePayload()
    {
        // Arrange
        var toEmail = "user@example.com";
        var fullName = "John Doe";
        var link = "https://cverify.ai/verify?token=abc";
        var renderedHtml = "<h1>Verify Email</h1>";

        _cacheMock.Setup(c => c.ExistsAsync(It.IsAny<string>())).ReturnsAsync(false);
        
        _templateMock.Setup(t => t.RenderTemplateAsync(
                "VerificationEmail.html", 
                It.IsAny<Dictionary<string, object>>(), 
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(renderedHtml);

        EmailMessage? capturedMessage = null;
        _senderMock.Setup(s => s.SendEmailAsync(It.IsAny<EmailMessage>(), It.IsAny<CancellationToken>()))
            .Callback<EmailMessage, CancellationToken>((msg, ct) => capturedMessage = msg)
            .Returns(Task.CompletedTask);

        // Act
        await _service.SendVerificationEmailAsync(toEmail, fullName, link).ConfigureAwait(false);

        // Assert
        _senderMock.Verify(s => s.SendEmailAsync(It.IsAny<EmailMessage>(), It.IsAny<CancellationToken>()), Times.Once);
        
        capturedMessage.Should().NotBeNull();
        capturedMessage!.ToEmail.Should().Be(toEmail);
        capturedMessage.ToName.Should().Be(fullName);
        capturedMessage.HtmlContent.Should().Be(renderedHtml);
        capturedMessage.Category.Should().Be(EmailCategory.Security);
        capturedMessage.CorrelationId.Should().NotBeNullOrWhiteSpace();
        capturedMessage.IdempotencyKey.Should().NotBeNullOrWhiteSpace();

        // Assert that the 5-minute idempotency lock is registered in cache
        _cacheMock.Verify(c => c.SetAsync(capturedMessage.IdempotencyKey, "dispatched", TimeSpan.FromMinutes(5)), Times.Once);
    }

    [Fact]
    public async Task SendVerificationEmailAsync_ShouldBlockDuplicateIdempotentBurstSends()
    {
        // Arrange
        var toEmail = "user@example.com";
        var fullName = "John Doe";
        var link = "https://cverify.ai/verify?token=abc";

        // Simulate that the idempotency cache key already exists in Redis
        _cacheMock.Setup(c => c.ExistsAsync(It.IsAny<string>())).ReturnsAsync(true);

        // Act
        await _service.SendVerificationEmailAsync(toEmail, fullName, link).ConfigureAwait(false);

        // Assert
        // The transport send call and template rendering should be skipped entirely
        _senderMock.Verify(s => s.SendEmailAsync(It.IsAny<EmailMessage>(), It.IsAny<CancellationToken>()), Times.Never);
        _templateMock.Verify(t => t.RenderTemplateAsync(It.IsAny<string>(), It.IsAny<Dictionary<string, object>>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task SendResetPasswordEmailAsync_ShouldCompileTemplateAndSendMimePayload()
    {
        // Arrange
        var toEmail = "user@example.com";
        var fullName = "John Doe";
        var link = "https://cverify.ai/reset?token=abc";
        var renderedHtml = "<h1>Reset Password</h1>";

        _cacheMock.Setup(c => c.ExistsAsync(It.IsAny<string>())).ReturnsAsync(false);
        
        _templateMock.Setup(t => t.RenderTemplateAsync(
                "ResetPasswordEmail.html", 
                It.IsAny<Dictionary<string, object>>(), 
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(renderedHtml);

        EmailMessage? capturedMessage = null;
        _senderMock.Setup(s => s.SendEmailAsync(It.IsAny<EmailMessage>(), It.IsAny<CancellationToken>()))
            .Callback<EmailMessage, CancellationToken>((msg, ct) => capturedMessage = msg)
            .Returns(Task.CompletedTask);

        // Act
        await _service.SendResetPasswordEmailAsync(toEmail, fullName, link).ConfigureAwait(false);

        // Assert
        _senderMock.Verify(s => s.SendEmailAsync(It.IsAny<EmailMessage>(), It.IsAny<CancellationToken>()), Times.Once);
        
        capturedMessage.Should().NotBeNull();
        capturedMessage!.ToEmail.Should().Be(toEmail);
        capturedMessage.ToName.Should().Be(fullName);
        capturedMessage.HtmlContent.Should().Be(renderedHtml);
        capturedMessage.Category.Should().Be(EmailCategory.Security);
        capturedMessage.CorrelationId.Should().NotBeNullOrWhiteSpace();
        capturedMessage.IdempotencyKey.Should().NotBeNullOrWhiteSpace();

        _cacheMock.Verify(c => c.SetAsync(capturedMessage.IdempotencyKey, "dispatched", TimeSpan.FromMinutes(5)), Times.Once);
    }

    [Fact]
    public async Task SendWelcomeEmailAsync_ShouldDeliverDirectlyWithoutIdempotencyChecks()
    {
        // Arrange
        var toEmail = "user@example.com";
        var fullName = "John Doe";
        var renderedHtml = "<h1>Welcome to CVerify</h1>";

        _templateMock.Setup(t => t.RenderTemplateAsync(
                "WelcomeEmail.html", 
                It.IsAny<Dictionary<string, object>>(), 
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(renderedHtml);

        EmailMessage? capturedMessage = null;
        _senderMock.Setup(s => s.SendEmailAsync(It.IsAny<EmailMessage>(), It.IsAny<CancellationToken>()))
            .Callback<EmailMessage, CancellationToken>((msg, ct) => capturedMessage = msg)
            .Returns(Task.CompletedTask);

        // Act
        await _service.SendWelcomeEmailAsync(toEmail, fullName).ConfigureAwait(false);

        // Assert
        _senderMock.Verify(s => s.SendEmailAsync(It.IsAny<EmailMessage>(), It.IsAny<CancellationToken>()), Times.Once);
        
        capturedMessage.Should().NotBeNull();
        capturedMessage!.ToEmail.Should().Be(toEmail);
        capturedMessage.ToName.Should().Be(fullName);
        capturedMessage.HtmlContent.Should().Be(renderedHtml);
        capturedMessage.Category.Should().Be(EmailCategory.Notification);
        capturedMessage.CorrelationId.Should().NotBeNullOrWhiteSpace();
        
        // Welcome emails carry no idempotency key locks (non-security standard transactional mails)
        capturedMessage.IdempotencyKey.Should().BeNull();
        _cacheMock.Verify(c => c.ExistsAsync(It.IsAny<string>()), Times.Never);
        _cacheMock.Verify(c => c.SetAsync(It.IsAny<string>(), It.IsAny<object>(), It.IsAny<TimeSpan?>()), Times.Never);
    }

    [Fact]
    public async Task SendOtpEmailAsync_ShouldCompileTemplateAndSendMimePayload()
    {
        // Arrange
        var toEmail = "candidate@example.com";
        var fullName = "Candidate User";
        var otpCode = "582910";
        var renderedHtml = "<h1>Your OTP is 582910</h1>";

        _templateMock.Setup(t => t.RenderTemplateAsync(
                "OtpVerificationEmail.html", 
                It.IsAny<Dictionary<string, object>>(), 
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(renderedHtml);

        EmailMessage? capturedMessage = null;
        _senderMock.Setup(s => s.SendEmailAsync(It.IsAny<EmailMessage>(), It.IsAny<CancellationToken>()))
            .Callback<EmailMessage, CancellationToken>((msg, ct) => capturedMessage = msg)
            .Returns(Task.CompletedTask);

        // Act
        await _service.SendOtpEmailAsync(toEmail, fullName, otpCode).ConfigureAwait(false);

        // Assert
        _senderMock.Verify(s => s.SendEmailAsync(It.IsAny<EmailMessage>(), It.IsAny<CancellationToken>()), Times.Once);
        
        capturedMessage.Should().NotBeNull();
        capturedMessage!.ToEmail.Should().Be(toEmail);
        capturedMessage.ToName.Should().Be(fullName);
        capturedMessage.HtmlContent.Should().Be(renderedHtml);
        capturedMessage.Category.Should().Be(EmailCategory.Security);
        capturedMessage.CorrelationId.Should().NotBeNullOrWhiteSpace();
        capturedMessage.IdempotencyKey.Should().BeNull();
    }

    [Fact]
    public async Task SendCompanyVerificationEmailAsync_ShouldCompileTemplateAndSendMimePayload()
    {
        // Arrange
        var toEmail = "admin@company.com";
        var companyName = "DevCorp";
        var link = "https://cverify.ai/company/verify?token=xyz";
        var renderedHtml = "<h1>Verify Company</h1>";

        _cacheMock.Setup(c => c.ExistsAsync(It.IsAny<string>())).ReturnsAsync(false);

        _templateMock.Setup(t => t.RenderTemplateAsync(
                "CompanyVerificationEmail.html", 
                It.IsAny<Dictionary<string, object>>(), 
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(renderedHtml);

        EmailMessage? capturedMessage = null;
        _senderMock.Setup(s => s.SendEmailAsync(It.IsAny<EmailMessage>(), It.IsAny<CancellationToken>()))
            .Callback<EmailMessage, CancellationToken>((msg, ct) => capturedMessage = msg)
            .Returns(Task.CompletedTask);

        // Act
        await _service.SendCompanyVerificationEmailAsync(toEmail, companyName, link).ConfigureAwait(false);

        // Assert
        _senderMock.Verify(s => s.SendEmailAsync(It.IsAny<EmailMessage>(), It.IsAny<CancellationToken>()), Times.Once);
        
        capturedMessage.Should().NotBeNull();
        capturedMessage!.ToEmail.Should().Be(toEmail);
        capturedMessage.ToName.Should().Be("Workspace Administrator");
        capturedMessage.HtmlContent.Should().Be(renderedHtml);
        capturedMessage.Category.Should().Be(EmailCategory.Security);
        capturedMessage.CorrelationId.Should().NotBeNullOrWhiteSpace();
        capturedMessage.IdempotencyKey.Should().NotBeNullOrWhiteSpace();

        _cacheMock.Verify(c => c.SetAsync(capturedMessage.IdempotencyKey, "dispatched", TimeSpan.FromMinutes(5)), Times.Once);
    }
}
