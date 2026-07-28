
using System;
using CVerify.API.Modules.Shared.Email.DTOs;

namespace CVerify.API.Modules.Shared.Email.Services;

/// <summary>
/// Pipeline contract for structured email audit logging.
/// </summary>
public interface IEmailAuditLogger
{
    /// <summary>
    /// Logs a successfully dispatched email transaction.
    /// </summary>
    /// <param name="message">The email payload.</param>
    void LogSent(EmailMessage message);

    /// <summary>
    /// Logs a terminal/final delivery failure.
    /// </summary>
    /// <param name="message">The email payload.</param>
    /// <param name="exception">The underlying exception thrown.</param>
    void LogFailed(EmailMessage message, Exception exception);

    /// <summary>
    /// Logs a transient retry attempt in progress.
    /// </summary>
    /// <param name="message">The email payload.</param>
    /// <param name="attempt">The retry iteration attempt.</param>
    /// <param name="exception">The transient failure exception causing the retry.</param>
    void LogRetry(EmailMessage message, int attempt, Exception exception);
}
