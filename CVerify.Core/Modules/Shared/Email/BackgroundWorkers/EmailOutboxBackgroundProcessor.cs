using System;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Email.Services;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.Modules.Shared.Email.BackgroundWorkers;

/// <summary>
/// Background worker implementing the Outbox Pattern to process and dispatch pending email notifications.
/// Ensures "at-least-once" delivery of critical security/onboarding emails.
/// </summary>
public class EmailOutboxBackgroundProcessor : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<EmailOutboxBackgroundProcessor> _logger;
    private readonly TimeProvider _timeProvider;

    public EmailOutboxBackgroundProcessor(
        IServiceProvider serviceProvider,
        ILogger<EmailOutboxBackgroundProcessor> logger,
        TimeProvider timeProvider)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _timeProvider = timeProvider;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Email Outbox Background Processor starting execution.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessPendingMessagesAsync(stoppingToken).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An unhandled exception occurred in the Email Outbox Background Processor thread.");
            }

            // Sleep for 5 seconds before next polling cycle
            await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken).ConfigureAwait(false);
        }

        _logger.LogInformation("Email Outbox Background Processor stopping execution.");
    }

    internal async Task ProcessPendingMessagesAsync(CancellationToken stoppingToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var cacheService = scope.ServiceProvider.GetRequiredService<ICacheService>();

        var lockKey = "lock:outbox:processor";
        var lockValue = Guid.NewGuid().ToString("N");
        // Acquire 20-second lease lock to allow execution
        var acquired = await cacheService.AcquireLockAsync(lockKey, lockValue, TimeSpan.FromSeconds(20)).ConfigureAwait(false);
        if (!acquired)
        {
            // Lock held by another instance
            return;
        }

        try
        {
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var emailService = scope.ServiceProvider.GetRequiredService<IEmailService>();

            // Fetch pending outbox messages in batches to avoid locking large chunks of the table
            var pendingMessages = await context.OutboxMessages
                .Where(m => m.ProcessedAt == null)
                .OrderBy(m => m.CreatedAt)
                .Take(50)
                .ToListAsync(stoppingToken)
                .ConfigureAwait(false);

            if (!pendingMessages.Any()) return;

            _logger.LogInformation("Processing {Count} pending outbox messages.", pendingMessages.Count);

            foreach (var message in pendingMessages)
            {
                if (stoppingToken.IsCancellationRequested) break;

                try
                {
                    switch (message.Type)
                    {
                        case "EmailVerification":
                            var verifyPayload = JsonSerializer.Deserialize<VerificationPayload>(message.Payload);
                            if (verifyPayload != null)
                            {
                                StructuredEmailAuditLogger.LogDeliveryStage(
                                    "BackgroundProcessor",
                                    message.Id.ToString(),
                                    message.Type,
                                    verifyPayload.Email,
                                    verifyPayload.CorrelationId);

                                await emailService.SendVerificationEmailAsync(
                                    verifyPayload.Email,
                                    verifyPayload.FullName,
                                    verifyPayload.Link,
                                    verifyPayload.CorrelationId,
                                    message.Id.ToString(),
                                    stoppingToken).ConfigureAwait(false);
                            }
                            break;

                        case "PasswordReset":
                            var resetPayload = JsonSerializer.Deserialize<ResetPayload>(message.Payload);
                            if (resetPayload != null)
                            {
                                StructuredEmailAuditLogger.LogDeliveryStage(
                                    "BackgroundProcessor",
                                    message.Id.ToString(),
                                    message.Type,
                                    resetPayload.Email,
                                    resetPayload.CorrelationId);

                                await emailService.SendResetPasswordEmailAsync(
                                    resetPayload.Email,
                                    resetPayload.FullName,
                                    resetPayload.Link,
                                    resetPayload.CorrelationId,
                                    message.Id.ToString(),
                                    stoppingToken).ConfigureAwait(false);
                            }
                            break;

                        case "WelcomeNotice":
                            var welcomePayload = JsonSerializer.Deserialize<WelcomePayload>(message.Payload);
                            if (welcomePayload != null)
                            {
                                StructuredEmailAuditLogger.LogDeliveryStage(
                                    "BackgroundProcessor",
                                    message.Id.ToString(),
                                    message.Type,
                                    welcomePayload.Email,
                                    welcomePayload.CorrelationId);

                                await emailService.SendWelcomeEmailAsync(
                                    welcomePayload.Email,
                                    welcomePayload.FullName,
                                    welcomePayload.CorrelationId,
                                    message.Id.ToString(),
                                    stoppingToken).ConfigureAwait(false);
                            }
                            break;

                        case "EmailOtpVerification":
                            var otpPayload = JsonSerializer.Deserialize<OtpVerificationPayload>(message.Payload);
                            if (otpPayload != null)
                            {
                                var correlationId = otpPayload.CorrelationId ?? string.Empty;
                                StructuredEmailAuditLogger.LogDeliveryStage(
                                    "BackgroundProcessor",
                                    message.Id.ToString(),
                                    message.Type,
                                    otpPayload.Email,
                                    correlationId);

                                await emailService.SendOtpEmailAsync(
                                    otpPayload.Email,
                                    null, // Pass null as the name argument to trigger resolution
                                    otpPayload.Otp,
                                    otpPayload.Template,
                                    correlationId,
                                    message.Id.ToString(),
                                    stoppingToken).ConfigureAwait(false);
                            }
                            break;

                        case "CompanyEmailVerification":
                            var companyPayload = JsonSerializer.Deserialize<CompanyVerificationPayload>(message.Payload);
                            if (companyPayload != null)
                            {
                                var correlationId = companyPayload.CorrelationId ?? string.Empty;
                                StructuredEmailAuditLogger.LogDeliveryStage(
                                    "BackgroundProcessor",
                                    message.Id.ToString(),
                                    message.Type,
                                    companyPayload.Email,
                                    correlationId);

                                await emailService.SendCompanyVerificationEmailAsync(
                                    companyPayload.Email,
                                    companyPayload.CompanyName,
                                    companyPayload.Link,
                                    correlationId,
                                    message.Id.ToString(),
                                    stoppingToken).ConfigureAwait(false);
                            }
                            break;

                        case "OrganizationRecoveryOtp":
                            var orgOtpPayload = JsonSerializer.Deserialize<OrganizationRecoveryOtpPayload>(message.Payload);
                            if (orgOtpPayload != null)
                            {
                                StructuredEmailAuditLogger.LogDeliveryStage(
                                    "BackgroundProcessor",
                                    message.Id.ToString(),
                                    message.Type,
                                    orgOtpPayload.Email,
                                    orgOtpPayload.CorrelationId);

                                await emailService.SendOtpEmailAsync(
                                    orgOtpPayload.Email,
                                    orgOtpPayload.CompanyName + " Admin",
                                    orgOtpPayload.Code,
                                    templateName: null,
                                    correlationId: orgOtpPayload.CorrelationId,
                                    outboxId: message.Id.ToString(),
                                    cancellationToken: stoppingToken).ConfigureAwait(false);
                            }
                            break;

                        case "SecurityAlertNotice":
                            var alertPayload = JsonSerializer.Deserialize<SecurityAlertPayload>(message.Payload);
                            if (alertPayload != null)
                            {
                                var correlationId = alertPayload.CorrelationId ?? string.Empty;
                                StructuredEmailAuditLogger.LogDeliveryStage(
                                    "BackgroundProcessor",
                                    message.Id.ToString(),
                                    message.Type,
                                    alertPayload.Email,
                                    correlationId);

                                await emailService.SendSecurityAlertEmailAsync(
                                    alertPayload.Email,
                                    alertPayload.Subject,
                                    alertPayload.Body,
                                    correlationId,
                                    message.Id.ToString(),
                                    stoppingToken).ConfigureAwait(false);
                            }
                            break;

                        case "AccountDeletionInitiated":
                            var deletionPayload = JsonSerializer.Deserialize<AccountDeletionInitiatedPayload>(message.Payload);
                            if (deletionPayload != null)
                            {
                                StructuredEmailAuditLogger.LogDeliveryStage(
                                    "BackgroundProcessor",
                                    message.Id.ToString(),
                                    message.Type,
                                    deletionPayload.Email,
                                    deletionPayload.CorrelationId);

                                var subject = "CVerify Account Deactivation and Scheduled Purge";
                                var body = $"Hi {deletionPayload.FullName},\n\nYour CVerify account deactivation has been initiated. Your profile and credentials are now hidden. Your account will enter a 14-day grace period, and will be permanently purged on {deletionPayload.ReactivateDeadline:yyyy-MM-dd HH:mm} UTC. If you wish to reactivate your account before this time, please log back in and follow the reactivation link.";

                                await emailService.SendSecurityAlertEmailAsync(
                                    deletionPayload.Email,
                                    subject,
                                    body,
                                    deletionPayload.CorrelationId,
                                    message.Id.ToString(),
                                    stoppingToken).ConfigureAwait(false);
                            }
                            break;

                        case "SystemNotificationEmail":
                            var sysPayload = JsonSerializer.Deserialize<SystemNotificationPayload>(message.Payload);
                            if (sysPayload != null)
                            {
                                StructuredEmailAuditLogger.LogDeliveryStage(
                                    "BackgroundProcessor",
                                    message.Id.ToString(),
                                    message.Type,
                                    sysPayload.Email,
                                    sysPayload.CorrelationId);

                                await emailService.SendSecurityAlertEmailAsync(
                                    sysPayload.Email,
                                    sysPayload.Subject,
                                    sysPayload.Content,
                                    sysPayload.CorrelationId,
                                    message.Id.ToString(),
                                    stoppingToken).ConfigureAwait(false);
                            }
                            break;

                        default:
                            _logger.LogWarning("Unknown outbox message type: '{Type}'. Skipping message.", message.Type);
                            break;
                    }

                    message.ProcessedAt = _timeProvider.GetUtcNow();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to dispatch outbox message {MessageId} of type {Type}.", message.Id, message.Type);
                    message.Error = ex.ToString();
                }
            }

            // Persist process states
            await context.SaveChangesAsync(stoppingToken).ConfigureAwait(false);
        }
        finally
        {
            await cacheService.ReleaseLockAsync(lockKey, lockValue).ConfigureAwait(false);
        }
    }


    private class VerificationPayload
    {
        public string Email { get; set; } = null!;
        public string FullName { get; set; } = null!;
        public string Link { get; set; } = null!;
        public string CorrelationId { get; set; } = null!;
    }

    private class ResetPayload
    {
        public string Email { get; set; } = null!;
        public string FullName { get; set; } = null!;
        public string Link { get; set; } = null!;
        public string CorrelationId { get; set; } = null!;
    }

    private class WelcomePayload
    {
        public string Email { get; set; } = null!;
        public string FullName { get; set; } = null!;
        public string CorrelationId { get; set; } = null!;
    }

    private class OtpVerificationPayload
    {
        public string Email { get; set; } = null!;
        public string Otp { get; set; } = null!;
        public string ChallengeId { get; set; } = null!;
        public string Purpose { get; set; } = null!;
        public string? Template { get; set; }
        public string? CorrelationId { get; set; }
    }

    private class CompanyVerificationPayload
    {
        public string Email { get; set; } = null!;
        public string CompanyName { get; set; } = null!;
        public string Link { get; set; } = null!;
        public string? CorrelationId { get; set; }
    }

    private class OrganizationRecoveryOtpPayload
    {
        public string Email { get; set; } = null!;
        public string CompanyName { get; set; } = null!;
        public string TaxCode { get; set; } = null!;
        public string Code { get; set; } = null!;
        public string CorrelationId { get; set; } = null!;
    }

    private class SecurityAlertPayload
    {
        public string Email { get; set; } = null!;
        public string Subject { get; set; } = null!;
        public string Body { get; set; } = null!;
        public string? CorrelationId { get; set; }
    }

    private class AccountDeletionInitiatedPayload
    {
        public string Email { get; set; } = null!;
        public string FullName { get; set; } = null!;
        public DateTime ReactivateDeadline { get; set; }
        public string CorrelationId { get; set; } = null!;
    }

    private class SystemNotificationPayload
    {
        public string Email { get; set; } = null!;
        public string CompanyName { get; set; } = null!;
        public string Subject { get; set; } = null!;
        public string Content { get; set; } = null!;
        public string CorrelationId { get; set; } = null!;
    }
}
