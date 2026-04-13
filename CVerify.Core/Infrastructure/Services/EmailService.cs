using System;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using CVerify.API.Application.DTOs;
using CVerify.API.Application.Interfaces;
using CVerify.API.Infrastructure.Configuration;

namespace CVerify.API.Infrastructure.Services;

/// <summary>
/// High-level orchestrator that renders HTML layouts, validates idempotency locks in Redis cache, and invokes the transport.
/// </summary>
public class EmailService : IEmailService
{
    private readonly IEmailSender _emailSender;
    private readonly IEmailTemplateService _templateService;
    private readonly ICacheService _cacheService;
    private readonly ILogger<EmailService> _logger;
    private readonly TimeProvider _timeProvider;

    /// <summary>
    /// Initializes a new instance of the <see cref="EmailService"/> class.
    /// </summary>
    public EmailService(
        IEmailSender emailSender,
        IEmailTemplateService templateService,
        ICacheService cacheService,
        ILogger<EmailService> logger,
        TimeProvider timeProvider = null)
    {
        _emailSender = emailSender;
        _templateService = templateService;
        _cacheService = cacheService;
        _logger = logger;
        _timeProvider = timeProvider ?? TimeProvider.System;
    }

    /// <inheritdoc />
    public async Task SendVerificationEmailAsync(
        string toEmail,
        string fullName,
        string verificationLink,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(toEmail);
        ArgumentException.ThrowIfNullOrWhiteSpace(fullName);
        ArgumentException.ThrowIfNullOrWhiteSpace(verificationLink);

        var correlationId = Guid.NewGuid().ToString("N");
        
        // Security Idempotency check: hash the link so duplicate dispatches are blocked instantly
        var tokenHash = ComputeSha256(verificationLink);
        var idempotencyKey = $"email:idempotency:{toEmail}:{tokenHash}";

        var duplicateExists = false;
        try
        {
            duplicateExists = await _cacheService.ExistsAsync(idempotencyKey).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[CorrelationID: {CorrelationId}] Redis cache unavailable. Bypassing idempotency Exists check for {ToEmail}.", correlationId, toEmail);
        }

        if (duplicateExists)
        {
            _logger.LogWarning("[CorrelationID: {CorrelationId}] Duplicate verification email dispatch blocked for {ToEmail}.", correlationId, toEmail);
            return;
        }

        // Render high-fidelity HTML Scriban card
        var model = new Dictionary<string, object>
        {
            { "full_name", fullName },
            { "verification_link", verificationLink }
        };

        var htmlBody = await _templateService.RenderTemplateAsync("VerificationEmail.html", model, cancellationToken).ConfigureAwait(false);

        var message = new EmailMessage(
            ToEmail: toEmail,
            ToName: fullName,
            Subject: "Verify Your Email Address - CVerify",
            HtmlContent: htmlBody,
            PlainTextContent: $"Hi {fullName}, please confirm your CVerify account by visiting this link: {verificationLink}",
            CorrelationId: correlationId,
            Category: EmailCategory.Security,
            IdempotencyKey: idempotencyKey
        );

        try
        {
            // Lock send request in cache for 5 minutes
            await _cacheService.SetAsync(idempotencyKey, "dispatched", TimeSpan.FromMinutes(5)).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[CorrelationID: {CorrelationId}] Redis cache unavailable. Bypassing idempotency Set lock for {ToEmail}.", correlationId, toEmail);
        }

        await _emailSender.SendEmailAsync(message, cancellationToken).ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task SendResetPasswordEmailAsync(
        string toEmail,
        string fullName,
        string resetLink,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(toEmail);
        ArgumentException.ThrowIfNullOrWhiteSpace(fullName);
        ArgumentException.ThrowIfNullOrWhiteSpace(resetLink);

        var correlationId = Guid.NewGuid().ToString("N");
        
        // Security Idempotency check
        var tokenHash = ComputeSha256(resetLink);
        var idempotencyKey = $"email:idempotency:{toEmail}:{tokenHash}";

        var duplicateExists = false;
        try
        {
            duplicateExists = await _cacheService.ExistsAsync(idempotencyKey).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[CorrelationID: {CorrelationId}] Redis cache unavailable. Bypassing idempotency Exists check for {ToEmail}.", correlationId, toEmail);
        }

        if (duplicateExists)
        {
            _logger.LogWarning("[CorrelationID: {CorrelationId}] Duplicate password reset email dispatch blocked for {ToEmail}.", correlationId, toEmail);
            return;
        }

        var model = new Dictionary<string, object>
        {
            { "full_name", fullName },
            { "reset_link", resetLink }
        };

        var htmlBody = await _templateService.RenderTemplateAsync("ResetPasswordEmail.html", model, cancellationToken).ConfigureAwait(false);

        var message = new EmailMessage(
            ToEmail: toEmail,
            ToName: fullName,
            Subject: "Reset Your Password - CVerify",
            HtmlContent: htmlBody,
            PlainTextContent: $"Hi {fullName}, please reset your password by visiting this link: {resetLink}",
            CorrelationId: correlationId,
            Category: EmailCategory.Security,
            IdempotencyKey: idempotencyKey
        );

        try
        {
            await _cacheService.SetAsync(idempotencyKey, "dispatched", TimeSpan.FromMinutes(5)).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[CorrelationID: {CorrelationId}] Redis cache unavailable. Bypassing idempotency Set lock for {ToEmail}.", correlationId, toEmail);
        }

        await _emailSender.SendEmailAsync(message, cancellationToken).ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task SendWelcomeEmailAsync(
        string toEmail,
        string fullName,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(toEmail);
        ArgumentException.ThrowIfNullOrWhiteSpace(fullName);

        var correlationId = Guid.NewGuid().ToString("N");

        var model = new Dictionary<string, object>
        {
            { "full_name", fullName }
        };

        var htmlBody = await _templateService.RenderTemplateAsync("WelcomeEmail.html", model, cancellationToken).ConfigureAwait(false);

        var message = new EmailMessage(
            ToEmail: toEmail,
            ToName: fullName,
            Subject: "Welcome to CVerify",
            HtmlContent: htmlBody,
            PlainTextContent: $"Welcome to CVerify, {fullName}! Your identity account is fully active and ready to link with workspaces.",
            CorrelationId: correlationId,
            Category: EmailCategory.Notification
        );

        await _emailSender.SendEmailAsync(message, cancellationToken).ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task SendOtpEmailAsync(
        string toEmail,
        string fullName,
        string otpCode,
        string? templateName = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(toEmail);
        ArgumentException.ThrowIfNullOrWhiteSpace(fullName);
        ArgumentException.ThrowIfNullOrWhiteSpace(otpCode);

        var correlationId = Guid.NewGuid().ToString("N");

        var model = new Dictionary<string, object>
        {
            { "full_name", fullName },
            { "otp_code", otpCode }
        };

        var resolvedTemplate = string.IsNullOrWhiteSpace(templateName) ? "OtpVerificationEmail.html" : templateName;
        var htmlBody = await _templateService.RenderTemplateAsync(resolvedTemplate, model, cancellationToken).ConfigureAwait(false);

        var subject = resolvedTemplate switch
        {
            "BusinessVerificationEmail.html" => "Confirm Company Domain Registration - CVerify",
            "EmailChangeVerificationEmail.html" => "Confirm Email Change - CVerify",
            "PasswordResetEmail.html" => "Your Password Reset Code - CVerify",
            "Login2FaEmail.html" => "Your 2FA Login Code - CVerify",
            "CompanyOwnerVerificationEmail.html" => "Verify Your Business Ownership - CVerify",
            "SecurityActionEmail.html" => "Verify Security Action - CVerify",
            "PasswordRecoveryEmail.html" => "Password Recovery Verification - CVerify",
            _ => "Your Verification Code - CVerify"
        };

        var message = new EmailMessage(
            ToEmail: toEmail,
            ToName: fullName,
            Subject: subject,
            HtmlContent: htmlBody,
            PlainTextContent: $"Hi {fullName}, your CVerify verification code is: {otpCode}",
            CorrelationId: correlationId,
            Category: EmailCategory.Security
        );

        await _emailSender.SendEmailAsync(message, cancellationToken).ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task SendCompanyVerificationEmailAsync(
        string toEmail,
        string companyName,
        string verificationLink,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(toEmail);
        ArgumentException.ThrowIfNullOrWhiteSpace(companyName);
        ArgumentException.ThrowIfNullOrWhiteSpace(verificationLink);

        var correlationId = Guid.NewGuid().ToString("N");
        
        // Security Idempotency check for link
        var tokenHash = ComputeSha256(verificationLink);
        var idempotencyKey = $"email:idempotency:{toEmail}:{tokenHash}";

        var duplicateExists = false;
        try
        {
            duplicateExists = await _cacheService.ExistsAsync(idempotencyKey).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[CorrelationID: {CorrelationId}] Redis cache unavailable. Bypassing idempotency Exists check for {ToEmail}.", correlationId, toEmail);
        }

        if (duplicateExists)
        {
            _logger.LogWarning("[CorrelationID: {CorrelationId}] Duplicate company verification email dispatch blocked for {ToEmail}.", correlationId, toEmail);
            return;
        }

        var model = new Dictionary<string, object>
        {
            { "full_name", "Workspace Administrator" },
            { "company_name", companyName },
            { "verification_link", verificationLink }
        };

        var htmlBody = await _templateService.RenderTemplateAsync("CompanyVerificationEmail.html", model, cancellationToken).ConfigureAwait(false);

        var message = new EmailMessage(
            ToEmail: toEmail,
            ToName: "Workspace Administrator",
            Subject: "Confirm Company Domain Registration - CVerify",
            HtmlContent: htmlBody,
            PlainTextContent: $"Confirm domain registration for {companyName} on CVerify by visiting this link: {verificationLink}",
            CorrelationId: correlationId,
            Category: EmailCategory.Security,
            IdempotencyKey: idempotencyKey
        );

        try
        {
            await _cacheService.SetAsync(idempotencyKey, "dispatched", TimeSpan.FromMinutes(5)).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[CorrelationID: {CorrelationId}] Redis cache unavailable. Bypassing idempotency Set lock for {ToEmail}.", correlationId, toEmail);
        }

        await _emailSender.SendEmailAsync(message, cancellationToken).ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task SendSecurityAlertEmailAsync(
        string toEmail,
        string alertSubject,
        string alertBody,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(toEmail);
        ArgumentException.ThrowIfNullOrWhiteSpace(alertSubject);
        ArgumentException.ThrowIfNullOrWhiteSpace(alertBody);

        var correlationId = Guid.NewGuid().ToString("N");

        var htmlBody = $@"
            <div style='font-family: sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 10px;'>
                <h2 style='color: #dc3545;'>{alertSubject}</h2>
                <p style='font-size: 14px; line-height: 1.6; color: #333;'>{alertBody}</p>
                <hr style='border: none; border-top: 1px solid #eee; margin: 20px 0;' />
                <p style='font-size: 11px; color: #888;'>This is an automated security notification from CVerify. If you did not request this, please secure your account immediately.</p>
            </div>";

        var message = new EmailMessage(
            ToEmail: toEmail,
            ToName: "CVerify User",
            Subject: alertSubject + " - CVerify",
            HtmlContent: htmlBody,
            PlainTextContent: alertBody,
            CorrelationId: correlationId,
            Category: EmailCategory.Security
        );

        await _emailSender.SendEmailAsync(message, cancellationToken).ConfigureAwait(false);
    }

    private static string ComputeSha256(string rawData)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(rawData));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
