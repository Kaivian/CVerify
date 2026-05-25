using System;
using CVerify.API.Application.DTOs;

namespace CVerify.API.Application.Interfaces;

/// <summary>
/// Pipeline contract for structured email audit logging.
/// </summary>
public interface IEmailAuditLogger
{
    /// <summary>
    /// Logs a successfully dispatched email transaction.
    /// </summary>
    /// <param name="message">The email payload.</param>
    /// <param name="provider">The active transport delivery channel (SMTP/SendGrid).</param>
    void LogSent(EmailMessage message, string provider);

    /// <summary>
    /// Logs a terminal/final delivery failure.
    /// </summary>
    /// <param name="message">The email payload.</param>
    /// <param name="provider">The active transport delivery channel (SMTP/SendGrid).</param>
    /// <param name="exception">The underlying exception thrown.</param>
    void LogFailed(EmailMessage message, string provider, Exception exception);

    /// <summary>
    /// Logs a transient retry attempt in progress.
    /// </summary>
    /// <param name="message">The email payload.</param>
    /// <param name="provider">The active transport delivery channel (SMTP/SendGrid).</param>
    /// <param name="attempt">The retry iteration attempt.</param>
    /// <param name="exception">The transient failure exception causing the retry.</param>
    void LogRetry(EmailMessage message, string provider, int attempt, Exception exception);
}
