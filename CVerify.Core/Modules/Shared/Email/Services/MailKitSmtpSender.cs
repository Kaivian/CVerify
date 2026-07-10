
using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Options;
using MailKit.Net.Smtp;
using MimeKit;
using Polly;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.Email.DTOs;
using CVerify.API.Modules.Shared.Exceptions;

namespace CVerify.API.Modules.Shared.Email.Services;

/// <summary>
/// Dispatches emails over SMTP using MailKit and MimeKit within a Polly resilience pipeline.
/// </summary>
public class MailKitSmtpSender : IEmailSender
{
    private readonly EmailSettings _settings;
    private readonly IEmailAuditLogger _auditLogger;
    private readonly ResiliencePipeline _resiliencePipeline;

    /// <summary>
    /// Initializes a new instance of the <see cref="MailKitSmtpSender"/> class.
    /// </summary>
    public MailKitSmtpSender(
        IOptions<EmailSettings> settings,
        IEmailAuditLogger auditLogger,
        ResiliencePipeline resiliencePipeline)
    {
        _settings = settings.Value;
        _auditLogger = auditLogger;
        _resiliencePipeline = resiliencePipeline;
    }

    /// <inheritdoc />
    public async Task SendEmailAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(message);

        // Sanitize recipient and sender headers to block header injection
        var senderName = SanitizeHeaderInput(_settings.SenderName);
        var senderEmail = SanitizeHeaderInput(_settings.SenderEmail);
        var recipientName = SanitizeHeaderInput(message.ToName);
        var recipientEmail = SanitizeHeaderInput(message.ToEmail);
        var subject = SanitizeHeaderInput(message.Subject);

        if (!global::System.Net.Mail.MailAddress.TryCreate(recipientEmail, out _))
        {
            throw new EmailSendingException($"Invalid recipient email address format: '{recipientEmail}'");
        }

        var mimeMessage = new MimeMessage();
        mimeMessage.From.Add(new MailboxAddress(senderName, senderEmail));
        mimeMessage.To.Add(new MailboxAddress(recipientName, recipientEmail));
        mimeMessage.Subject = subject;

        // Correlation tracking headers
        mimeMessage.Headers.Add("X-Correlation-ID", message.CorrelationId);
        if (!string.IsNullOrWhiteSpace(message.IdempotencyKey))
        {
            mimeMessage.Headers.Add("X-Idempotency-Key", message.IdempotencyKey);
        }

        var bodyBuilder = new BodyBuilder
        {
            HtmlBody = message.HtmlContent,
            TextBody = message.PlainTextContent
        };
        mimeMessage.Body = bodyBuilder.ToMessageBody();

        // Setup Polly Context with Message Reference for Audit Logging inside pipelines
        var pollyContext = ResilienceContextPool.Shared.Get(cancellationToken);
        pollyContext.Properties.Set(new ResiliencePropertyKey<EmailMessage>("Message"), message);
        pollyContext.Properties.Set(new ResiliencePropertyKey<string>("Provider"), "SMTP");

        StructuredEmailAuditLogger.LogDeliveryStage("SmtpSender", "", message.Category.ToString(), message.ToEmail, message.CorrelationId);

        try
        {
            await _resiliencePipeline.ExecuteAsync(async ct =>
            {
                using var client = new SmtpClient();
                client.Timeout = (int)TimeSpan.FromSeconds(_settings.TimeoutSeconds).TotalMilliseconds;

                var socketOptions = MailKit.Security.SecureSocketOptions.Auto;
                if (_settings.Smtp.Port == 587)
                {
                    socketOptions = MailKit.Security.SecureSocketOptions.StartTls;
                }
                else if (_settings.Smtp.Port == 465)
                {
                    socketOptions = MailKit.Security.SecureSocketOptions.SslOnConnect;
                }
                else
                {
                    socketOptions = _settings.Smtp.EnableSsl
                        ? MailKit.Security.SecureSocketOptions.SslOnConnect
                        : MailKit.Security.SecureSocketOptions.StartTlsWhenAvailable;
                }

                await client.ConnectAsync(_settings.Smtp.Host, _settings.Smtp.Port, socketOptions, ct.CancellationToken).ConfigureAwait(false);

                if (!string.IsNullOrWhiteSpace(_settings.Smtp.Username))
                {
                    var password = _settings.Smtp.Password;
                    // Strip spaces for Gmail App Passwords if copied directly with formatting spaces
                    if (!string.IsNullOrEmpty(password) && _settings.Smtp.Host.Contains("gmail.com", StringComparison.OrdinalIgnoreCase))
                    {
                        password = password.Replace(" ", "");
                    }
                    await client.AuthenticateAsync(_settings.Smtp.Username, password, ct.CancellationToken).ConfigureAwait(false);
                }

                await client.SendAsync(mimeMessage, ct.CancellationToken).ConfigureAwait(false);
                await client.DisconnectAsync(true, ct.CancellationToken).ConfigureAwait(false);
            }, pollyContext).ConfigureAwait(false);

            _auditLogger.LogSent(message, "SMTP");
        }
        catch (Exception ex)
        {
            _auditLogger.LogFailed(message, "SMTP", ex);
            throw new EmailSendingException($"SMTP transport failed to deliver email to {recipientEmail}.", ex);
        }
        finally
        {
            ResilienceContextPool.Shared.Return(pollyContext);
        }
    }

    private static string SanitizeHeaderInput(string input)
    {
        if (string.IsNullOrEmpty(input)) return input;
        // Strip carriage returns and line feeds to prevent header injection
        return input.Replace("\r", "").Replace("\n", "");
    }
}
