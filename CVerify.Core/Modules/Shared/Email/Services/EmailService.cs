using System;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Email.DTOs;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.Modules.Shared.Email.Services;

/// <summary>
/// High-level orchestrator that renders HTML layouts, validates idempotency locks in Redis cache, and invokes the transport.
/// </summary>
public class EmailService : IEmailService
{
    private readonly IEmailSender _emailSender;
    private readonly IEmailTemplateService _templateService;
    private readonly ICacheService _cacheService;
    private readonly ILogger<EmailService> _logger;
    private readonly IEmailRecipientResolver _recipientResolver;
    private readonly TimeProvider _timeProvider;

    /// <summary>
    /// Initializes a new instance of the <see cref="EmailService"/> class.
    /// </summary>
    public EmailService(
        IEmailSender emailSender,
        IEmailTemplateService templateService,
        ICacheService cacheService,
        ILogger<EmailService> logger,
        IEmailRecipientResolver recipientResolver,
        TimeProvider? timeProvider = null)
    {
        _emailSender = emailSender;
        _templateService = templateService;
        _cacheService = cacheService;
        _logger = logger;
        _recipientResolver = recipientResolver ?? new FallbackRecipientResolver();
        _timeProvider = timeProvider ?? TimeProvider.System;
    }

    /// <summary>
    /// Constructor overload for backwards compatibility in test suites.
    /// </summary>
    public EmailService(
        IEmailSender emailSender,
        IEmailTemplateService templateService,
        ICacheService cacheService,
        ILogger<EmailService> logger,
        TimeProvider timeProvider)
        : this(emailSender, templateService, cacheService, logger, null!, timeProvider)
    {
    }

    /// <summary>
    /// Constructor overload for backwards compatibility in test suites.
    /// </summary>
    public EmailService(
        IEmailSender emailSender,
        IEmailTemplateService templateService,
        ICacheService cacheService,
        ILogger<EmailService> logger)
        : this(emailSender, templateService, cacheService, logger, null!, null)
    {
    }

    private class FallbackRecipientResolver : IEmailRecipientResolver
    {
        public Task<RecipientProfile> ResolveByEmailAsync(string email, CancellationToken cancellationToken = default)
        {
            return Task.FromResult(new RecipientProfile(email, null, null));
        }

        public Task<RecipientProfile> ResolveByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
        {
            return Task.FromResult(new RecipientProfile(string.Empty, null, null));
        }
    }

    private static string BuildGreetingText(RecipientProfile profile, string? fallbackName)
    {
        var name = !string.IsNullOrEmpty(profile.DisplayName) ? profile.DisplayName 
                 : (!string.IsNullOrEmpty(profile.Username) ? profile.Username 
                 : GetSanitizedFallbackName(fallbackName));

        if (!string.IsNullOrEmpty(name))
        {
            return $"Hi {name.Trim()},";
        }
        return "Hello,";
    }

    private static string? GetSanitizedFallbackName(string? name)
    {
        if (string.IsNullOrWhiteSpace(name)) return null;
        var trimmed = name.Trim();
        var invalid = new[] { "Candidate User", "User", "John Doe", "Example User", "Test User", "CVerify User", "Workspace Administrator" };
        foreach (var placeholder in invalid)
        {
            if (string.Equals(trimmed, placeholder, StringComparison.OrdinalIgnoreCase))
            {
                return null;
            }
        }
        return trimmed;
    }

    /// <inheritdoc />
    public async Task SendVerificationEmailAsync(
        string toEmail,
        string fullName,
        string verificationLink,
        string? correlationId = null,
        string? outboxId = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(toEmail);
        ArgumentException.ThrowIfNullOrWhiteSpace(fullName);
        ArgumentException.ThrowIfNullOrWhiteSpace(verificationLink);

        correlationId ??= Guid.NewGuid().ToString("N");
        
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

        var profile = await _recipientResolver.ResolveByEmailAsync(toEmail, cancellationToken).ConfigureAwait(false);
        var greeting = BuildGreetingText(profile, fullName);

        // Render high-fidelity HTML Scriban card
        var model = new Dictionary<string, object>
        {
            { "full_name", profile.DisplayName ?? fullName },
            { "display_name", profile.DisplayName ?? string.Empty },
            { "username", profile.Username ?? string.Empty },
            { "greeting_text", greeting },
            { "verification_link", verificationLink }
        };

        var htmlBody = await _templateService.RenderTemplateAsync("VerificationEmail.html", model, cancellationToken).ConfigureAwait(false);

        StructuredEmailAuditLogger.LogDeliveryStage("EmailService", outboxId ?? string.Empty, "EmailVerification", toEmail, correlationId);

        var message = new EmailMessage(
            ToEmail: toEmail,
            ToName: profile.DisplayName ?? fullName,
            Subject: "Verify Your Email Address - CVerify",
            HtmlContent: htmlBody,
            PlainTextContent: $"{greeting} please confirm your CVerify account by visiting this link: {verificationLink}",
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
        string? correlationId = null,
        string? outboxId = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(toEmail);
        ArgumentException.ThrowIfNullOrWhiteSpace(fullName);
        ArgumentException.ThrowIfNullOrWhiteSpace(resetLink);

        correlationId ??= Guid.NewGuid().ToString("N");
        
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

        var profile = await _recipientResolver.ResolveByEmailAsync(toEmail, cancellationToken).ConfigureAwait(false);
        var greeting = BuildGreetingText(profile, fullName);

        var model = new Dictionary<string, object>
        {
            { "full_name", profile.DisplayName ?? fullName },
            { "display_name", profile.DisplayName ?? string.Empty },
            { "username", profile.Username ?? string.Empty },
            { "greeting_text", greeting },
            { "reset_link", resetLink }
        };

        var htmlBody = await _templateService.RenderTemplateAsync("ResetPasswordEmail.html", model, cancellationToken).ConfigureAwait(false);

        StructuredEmailAuditLogger.LogDeliveryStage("EmailService", outboxId ?? string.Empty, "PasswordReset", toEmail, correlationId);

        var message = new EmailMessage(
            ToEmail: toEmail,
            ToName: profile.DisplayName ?? fullName,
            Subject: "Reset Your Password - CVerify",
            HtmlContent: htmlBody,
            PlainTextContent: $"{greeting} please reset your password by visiting this link: {resetLink}",
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
        string? correlationId = null,
        string? outboxId = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(toEmail);
        ArgumentException.ThrowIfNullOrWhiteSpace(fullName);

        correlationId ??= Guid.NewGuid().ToString("N");

        var profile = await _recipientResolver.ResolveByEmailAsync(toEmail, cancellationToken).ConfigureAwait(false);
        var greeting = BuildGreetingText(profile, fullName);

        var model = new Dictionary<string, object>
        {
            { "full_name", profile.DisplayName ?? fullName },
            { "display_name", profile.DisplayName ?? string.Empty },
            { "username", profile.Username ?? string.Empty },
            { "greeting_text", greeting }
        };

        var htmlBody = await _templateService.RenderTemplateAsync("WelcomeEmail.html", model, cancellationToken).ConfigureAwait(false);

        StructuredEmailAuditLogger.LogDeliveryStage("EmailService", outboxId ?? string.Empty, "WelcomeNotice", toEmail, correlationId);

        var message = new EmailMessage(
            ToEmail: toEmail,
            ToName: profile.DisplayName ?? fullName,
            Subject: "Welcome to CVerify",
            HtmlContent: htmlBody,
            PlainTextContent: $"{greeting} Welcome to CVerify! Your identity account is fully active and ready to link with workspaces.",
            CorrelationId: correlationId,
            Category: EmailCategory.Notification
        );

        await _emailSender.SendEmailAsync(message, cancellationToken).ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task SendOtpEmailAsync(
        string toEmail,
        string? fullName,
        string otpCode,
        string? templateName = null,
        string? correlationId = null,
        string? outboxId = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(toEmail);
        ArgumentException.ThrowIfNullOrWhiteSpace(otpCode);

        correlationId ??= Guid.NewGuid().ToString("N");

        var profile = await _recipientResolver.ResolveByEmailAsync(toEmail, cancellationToken).ConfigureAwait(false);
        var greeting = BuildGreetingText(profile, fullName);

        var model = new Dictionary<string, object>
        {
            { "full_name", profile.DisplayName ?? fullName ?? string.Empty },
            { "display_name", profile.DisplayName ?? string.Empty },
            { "username", profile.Username ?? string.Empty },
            { "greeting_text", greeting },
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

        var type = resolvedTemplate == "OtpVerificationEmail.html" ? "EmailOtpVerification" : "OrganizationRecoveryOtp";
        StructuredEmailAuditLogger.LogDeliveryStage("EmailService", outboxId ?? string.Empty, type, toEmail, correlationId);

        var message = new EmailMessage(
            ToEmail: toEmail,
            ToName: profile.DisplayName ?? fullName ?? string.Empty,
            Subject: subject,
            HtmlContent: htmlBody,
            PlainTextContent: $"{greeting} your CVerify verification code is: {otpCode}",
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
        string? correlationId = null,
        string? outboxId = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(toEmail);
        ArgumentException.ThrowIfNullOrWhiteSpace(companyName);
        ArgumentException.ThrowIfNullOrWhiteSpace(verificationLink);

        correlationId ??= Guid.NewGuid().ToString("N");
        
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

        var profile = await _recipientResolver.ResolveByEmailAsync(toEmail, cancellationToken).ConfigureAwait(false);
        var greeting = BuildGreetingText(profile, "Workspace Administrator");

        var model = new Dictionary<string, object>
        {
            { "full_name", profile.DisplayName ?? "Workspace Administrator" },
            { "display_name", profile.DisplayName ?? string.Empty },
            { "username", profile.Username ?? string.Empty },
            { "greeting_text", greeting },
            { "company_name", companyName },
            { "verification_link", verificationLink }
        };

        var htmlBody = await _templateService.RenderTemplateAsync("CompanyVerificationEmail.html", model, cancellationToken).ConfigureAwait(false);

        StructuredEmailAuditLogger.LogDeliveryStage("EmailService", outboxId ?? string.Empty, "CompanyEmailVerification", toEmail, correlationId);

        var message = new EmailMessage(
            ToEmail: toEmail,
            ToName: profile.DisplayName ?? "Workspace Administrator",
            Subject: "Confirm Company Domain Registration - CVerify",
            HtmlContent: htmlBody,
            PlainTextContent: $"{greeting} Confirm domain registration for {companyName} on CVerify by visiting this link: {verificationLink}",
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
        string? correlationId = null,
        string? outboxId = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(toEmail);
        ArgumentException.ThrowIfNullOrWhiteSpace(alertSubject);
        ArgumentException.ThrowIfNullOrWhiteSpace(alertBody);

        correlationId ??= Guid.NewGuid().ToString("N");

        var profile = await _recipientResolver.ResolveByEmailAsync(toEmail, cancellationToken).ConfigureAwait(false);
        var greeting = BuildGreetingText(profile, "CVerify User");

        var model = new Dictionary<string, object>
        {
            { "full_name", profile.DisplayName ?? "CVerify User" },
            { "display_name", profile.DisplayName ?? string.Empty },
            { "username", profile.Username ?? string.Empty },
            { "greeting_text", greeting },
            { "alert_title", alertSubject },
            { "alert_message", alertBody },
            { "activity_type", "Security Warning" },
            { "activity_time", _timeProvider.GetUtcNow().ToString("yyyy-MM-dd HH:mm:ss UTC") },
            { "ip_address", "Unknown / Internal" },
            { "user_agent", "CVerify Core System" }
        };

        var htmlBody = await _templateService.RenderTemplateAsync("SecurityAlertEmail.html", model, cancellationToken).ConfigureAwait(false);

        var type = alertSubject.Contains("Deactivation") || alertSubject.Contains("Purge") ? "AccountDeletionInitiated" 
                 : (alertSubject.Contains("vote") || alertSubject.Contains("System") ? "SystemNotificationEmail" : "SecurityAlertNotice");

        StructuredEmailAuditLogger.LogDeliveryStage("EmailService", outboxId ?? string.Empty, type, toEmail, correlationId);

        var message = new EmailMessage(
            ToEmail: toEmail,
            ToName: profile.DisplayName ?? "CVerify User",
            Subject: alertSubject.EndsWith("- CVerify") ? alertSubject : alertSubject + " - CVerify",
            HtmlContent: htmlBody,
            PlainTextContent: alertBody,
            CorrelationId: correlationId,
            Category: EmailCategory.Security
        );

        await _emailSender.SendEmailAsync(message, cancellationToken).ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task SendWorkspaceOnboardingEmailAsync(
        string toEmail,
        string fullName,
        string companyName,
        string workspaceId,
        string workspaceUrl,
        string? correlationId = null,
        string? outboxId = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(toEmail);
        ArgumentException.ThrowIfNullOrWhiteSpace(fullName);
        ArgumentException.ThrowIfNullOrWhiteSpace(companyName);
        ArgumentException.ThrowIfNullOrWhiteSpace(workspaceId);
        ArgumentException.ThrowIfNullOrWhiteSpace(workspaceUrl);

        correlationId ??= Guid.NewGuid().ToString("N");

        var profile = await _recipientResolver.ResolveByEmailAsync(toEmail, cancellationToken).ConfigureAwait(false);
        var greeting = BuildGreetingText(profile, fullName);

        var model = new Dictionary<string, object>
        {
            { "full_name", profile.DisplayName ?? fullName },
            { "display_name", profile.DisplayName ?? string.Empty },
            { "username", profile.Username ?? string.Empty },
            { "greeting_text", greeting },
            { "company_name", companyName },
            { "workspace_id", workspaceId },
            { "workspace_url", workspaceUrl }
        };

        var htmlBody = await _templateService.RenderTemplateAsync("WorkspaceOnboardingEmail.html", model, cancellationToken).ConfigureAwait(false);

        StructuredEmailAuditLogger.LogDeliveryStage("EmailService", outboxId ?? string.Empty, "WorkspaceOnboarding", toEmail, correlationId);

        var message = new EmailMessage(
            ToEmail: toEmail,
            ToName: profile.DisplayName ?? fullName,
            Subject: $"Company Activated: {companyName} - CVerify",
            HtmlContent: htmlBody,
            PlainTextContent: $"{greeting} Congratulations! The verified company organization for {companyName} has been fully activated. Access it here: {workspaceUrl}",
            CorrelationId: correlationId,
            Category: EmailCategory.Notification
        );

        await _emailSender.SendEmailAsync(message, cancellationToken).ConfigureAwait(false);
    }

    private static string ComputeSha256(string rawData)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(rawData));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
