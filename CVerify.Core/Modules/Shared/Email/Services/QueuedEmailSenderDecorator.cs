
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.Shared.Email.DTOs;

namespace CVerify.API.Modules.Shared.Email.Services;

/// <summary>
/// Intercepts direct email transport dispatch requests and enqueues them into the background channel, returning instantly.
/// </summary>
public class QueuedEmailSenderDecorator : IEmailSender
{
    private readonly IEmailQueue _emailQueue;
    private readonly ILogger<QueuedEmailSenderDecorator> _logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="QueuedEmailSenderDecorator"/> class.
    /// </summary>
    public QueuedEmailSenderDecorator(
        IEmailQueue emailQueue,
        ILogger<QueuedEmailSenderDecorator> _logger)
    {
        _emailQueue = emailQueue;
        this._logger = _logger;
    }

    /// <inheritdoc />
    public Task SendEmailAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        // Enqueue the message to our background channel
        _emailQueue.QueueEmail(message);
        
        _logger.LogInformation("[CorrelationID: {CorrelationId}] Email successfully enqueued to background channel processor for {ToEmail}.", message.CorrelationId, message.ToEmail);
        
        return Task.CompletedTask;
    }
}
