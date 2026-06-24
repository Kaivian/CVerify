
using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Options;
using Polly;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.Email.DTOs;
using CVerify.API.Modules.Shared.Exceptions;
using CVerify.API.Modules.Shared.Exceptions.Catalogs;

namespace CVerify.API.Modules.Shared.Email.Services;

/// <summary>
/// Dispatches emails over SendGrid REST HTTP API endpoints utilizing HttpClient inside a Polly resilience pipeline.
/// </summary>
public class SendGridHttpSender : IEmailSender
{
    private readonly HttpClient _httpClient;
    private readonly EmailSettings _settings;
    private readonly IEmailAuditLogger _auditLogger;
    private readonly ResiliencePipeline _resiliencePipeline;

    /// <summary>
    /// Initializes a new instance of the <see cref="SendGridHttpSender"/> class.
    /// </summary>
    public SendGridHttpSender(
        HttpClient httpClient,
        IOptions<EmailSettings> settings,
        IEmailAuditLogger auditLogger,
        ResiliencePipeline resiliencePipeline)
    {
        _httpClient = httpClient;
        _settings = settings.Value;
        _auditLogger = auditLogger;
        _resiliencePipeline = resiliencePipeline;
    }

    /// <inheritdoc />
    public async Task SendEmailAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(message);

        var senderName = SanitizeHeaderInput(_settings.SenderName);
        var senderEmail = SanitizeHeaderInput(_settings.SenderEmail);
        var recipientName = SanitizeHeaderInput(message.ToName);
        var recipientEmail = SanitizeHeaderInput(message.ToEmail);
        var subject = SanitizeHeaderInput(message.Subject);

        if (!global::System.Net.Mail.MailAddress.TryCreate(recipientEmail, out _))
        {
            throw new EmailSendingException($"Invalid recipient email address format: '{recipientEmail}'");
        }

        // Construct SendGrid REST API Payload
        var payload = new
        {
            personalizations = new[]
            {
                new
                {
                    to = new[]
                    {
                        new { email = recipientEmail, name = recipientName }
                    }
                }
            },
            from = new { email = senderEmail, name = senderName },
            subject = subject,
            content = new[]
            {
                new { type = "text/html", value = message.HtmlContent }
            },
            headers = new Dictionary<string, string>
            {
                { "X-Correlation-ID", message.CorrelationId }
            }
        };

        var json = JsonSerializer.Serialize(payload);

        // Setup Polly Context with Message Reference for Audit Logging inside pipelines
        var pollyContext = ResilienceContextPool.Shared.Get(cancellationToken);
        pollyContext.Properties.Set(new ResiliencePropertyKey<EmailMessage>("Message"), message);
        pollyContext.Properties.Set(new ResiliencePropertyKey<string>("Provider"), "SendGrid");

        StructuredEmailAuditLogger.LogDeliveryStage("SmtpSender", "", message.Category.ToString(), message.ToEmail, message.CorrelationId);

        try
        {
            await _resiliencePipeline.ExecuteAsync(async ct =>
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.sendgrid.com/v3/mail/send");

                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _settings.SendGrid.ApiKey);
                request.Content = new StringContent(json, Encoding.UTF8, "application/json");

                using var response = await _httpClient.SendAsync(request, ct.CancellationToken).ConfigureAwait(false);

                if (!response.IsSuccessStatusCode)
                {
                    var responseBody = await response.Content.ReadAsStringAsync(ct.CancellationToken).ConfigureAwait(false);
                    throw new EmailSendingException($"SendGrid REST API responded with error status code {response.StatusCode}. Details: {responseBody}");
                }
            }, pollyContext).ConfigureAwait(false);

            _auditLogger.LogSent(message, "SendGrid");
        }
        catch (Exception ex)
        {
            _auditLogger.LogFailed(message, "SendGrid", ex);
            throw new EmailSendingException($"SendGrid REST transport failed to deliver email to {recipientEmail}.", ex);
        }
        finally
        {
            ResilienceContextPool.Shared.Return(pollyContext);
        }
    }

    private static string SanitizeHeaderInput(string input)
    {
        if (string.IsNullOrEmpty(input)) return input;
        return input.Replace("\r", "").Replace("\n", "");
    }
}
