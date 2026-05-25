using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Application.DTOs;

namespace CVerify.API.Application.Interfaces;

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
