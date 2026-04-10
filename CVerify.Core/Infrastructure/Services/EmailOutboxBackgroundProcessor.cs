using System;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using CVerify.API.Application.Interfaces;
using CVerify.API.Core.Entities;
using CVerify.API.Infrastructure.Persistence;

namespace CVerify.API.Infrastructure.Services;

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

    private async Task ProcessPendingMessagesAsync(CancellationToken stoppingToken)
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
                                await emailService.SendVerificationEmailAsync(
                                    verifyPayload.Email,
                                    verifyPayload.FullName,
                                    verifyPayload.Link,
                                    stoppingToken).ConfigureAwait(false);
                            }
                            break;

                        case "PasswordReset":
                            var resetPayload = JsonSerializer.Deserialize<ResetPayload>(message.Payload);
                            if (resetPayload != null)
                            {
                                await emailService.SendResetPasswordEmailAsync(
                                    resetPayload.Email,
                                    resetPayload.FullName,
                                    resetPayload.Link,
                                    stoppingToken).ConfigureAwait(false);
                            }
                            break;

                        case "WelcomeNotice":
                            var welcomePayload = JsonSerializer.Deserialize<WelcomePayload>(message.Payload);
                            if (welcomePayload != null)
                            {
                                await emailService.SendWelcomeEmailAsync(
                                    welcomePayload.Email,
                                    welcomePayload.FullName,
                                    stoppingToken).ConfigureAwait(false);
                            }
                            break;

                        case "EmailOtpVerification":
                            var otpPayload = JsonSerializer.Deserialize<OtpVerificationPayload>(message.Payload);
                            if (otpPayload != null)
                            {
                                await emailService.SendOtpEmailAsync(
                                    otpPayload.Email,
                                    "Candidate User",
                                    otpPayload.Otp,
                                    otpPayload.Template,
                                    stoppingToken).ConfigureAwait(false);
                            }
                            break;

                        case "CompanyEmailVerification":
                            var companyPayload = JsonSerializer.Deserialize<CompanyVerificationPayload>(message.Payload);
                            if (companyPayload != null)
                            {
                                await emailService.SendCompanyVerificationEmailAsync(
                                    companyPayload.Email,
                                    companyPayload.CompanyName,
                                    companyPayload.Link,
                                    stoppingToken).ConfigureAwait(false);
                            }
                            break;

                        case "OrganizationRecoveryOtp":
                            var orgOtpPayload = JsonSerializer.Deserialize<OrganizationRecoveryOtpPayload>(message.Payload);
                            if (orgOtpPayload != null)
                            {
                                await emailService.SendOtpEmailAsync(
                                    orgOtpPayload.Email,
                                    orgOtpPayload.CompanyName + " Admin",
                                    orgOtpPayload.Code,
                                    templateName: null,
                                    cancellationToken: stoppingToken).ConfigureAwait(false);
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
    }

    private class CompanyVerificationPayload
    {
        public string Email { get; set; } = null!;
        public string CompanyName { get; set; } = null!;
        public string Link { get; set; } = null!;
    }

    private class OrganizationRecoveryOtpPayload
    {
        public string Email { get; set; } = null!;
        public string CompanyName { get; set; } = null!;
        public string TaxCode { get; set; } = null!;
        public string Code { get; set; } = null!;
        public string CorrelationId { get; set; } = null!;
    }
}
