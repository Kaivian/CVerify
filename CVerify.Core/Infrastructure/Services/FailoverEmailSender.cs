using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using CVerify.API.Application.DTOs;
using CVerify.API.Application.Interfaces;
using CVerify.API.Application.Exceptions;

namespace CVerify.API.Infrastructure.Services;

/// <summary>
/// Orchestrates delivery failover, attempting primary SMTP delivery first and failing over to SendGrid on persistent failures.
/// </summary>
public class FailoverEmailSender : IEmailSender
{
    private readonly MailKitSmtpSender _smtpSender;
    private readonly SendGridHttpSender _sendGridSender;
    private readonly ILogger<FailoverEmailSender> _logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="FailoverEmailSender"/> class.
    /// </summary>
    public FailoverEmailSender(
        MailKitSmtpSender smtpSender,
        SendGridHttpSender sendGridSender,
        ILogger<FailoverEmailSender> logger)
    {
        _smtpSender = smtpSender;
        _sendGridSender = sendGridSender;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task SendEmailAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(message);

        try
        {
            _logger.LogInformation("[CorrelationID: {CorrelationId}] Attempting email delivery via primary SMTP gateway...", message.CorrelationId);
            await _smtpSender.SendEmailAsync(message, cancellationToken).ConfigureAwait(false);
            _logger.LogInformation("[CorrelationID: {CorrelationId}] SMTP delivery completed successfully.", message.CorrelationId);
        }
        catch (Exception smtpEx)
        {
            _logger.LogWarning(smtpEx, "[CorrelationID: {CorrelationId}] SMTP transport failed. Initiating fallback delivery to SendGrid REST gateway...", message.CorrelationId);

            try
            {
                await _sendGridSender.SendEmailAsync(message, cancellationToken).ConfigureAwait(false);
                _logger.LogInformation("[CorrelationID: {CorrelationId}] Failover SendGrid delivery completed successfully.", message.CorrelationId);
            }
            catch (Exception sgEx)
            {
                _logger.LogError(sgEx, "[CorrelationID: {CorrelationId}] Both SMTP and SendGrid transports failed to deliver email.", message.CorrelationId);
                throw new EmailSendingException(
                    $"All configured email transports failed. SMTP Error: {smtpEx.Message}. SendGrid Error: {sgEx.Message}.",
                    sgEx);
            }
        }
    }
}
