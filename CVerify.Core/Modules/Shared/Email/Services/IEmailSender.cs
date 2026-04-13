
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Modules.Shared.Email.DTOs;

namespace CVerify.API.Modules.Shared.Email.Services;

/// <summary>
/// Defines the low-level transport contract for email dispatch operations.
/// </summary>
public interface IEmailSender
{
    /// <summary>
    /// Executes physical/REST dispatch of a structured EmailMessage.
    /// </summary>
    /// <param name="message">The immutable email payload.</param>
    /// <param name="cancellationToken">Cancellation token trace.</param>
    Task SendEmailAsync(EmailMessage message, CancellationToken cancellationToken = default);
}
