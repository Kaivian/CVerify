
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Modules.Shared.Email.DTOs;

namespace CVerify.API.Modules.Shared.Email.Services;

/// <summary>
/// Represents a high-speed, thread-safe memory queue backed by System.Threading.Channels.
/// </summary>
public interface IEmailQueue
{
    /// <summary>
    /// Enqueues a message for background dispatch.
    /// </summary>
    /// <param name="message">The immutable email payload.</param>
    void QueueEmail(EmailMessage message);

    /// <summary>
    /// Dequeues an email asynchronously from the background worker.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token trace.</param>
    /// <returns>The enqueued email message.</returns>
    Task<EmailMessage> DequeueAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Attempts to immediately dequeue an item if available (non-blocking).
    /// </summary>
    /// <param name="message">The dequeued item if successful.</param>
    /// <returns>True if an item was successfully dequeued; otherwise false.</returns>
    bool TryDequeue(out EmailMessage message);

    /// <summary>
    /// Blocks until items are written or the channel completes. Supporting graceful draining.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token trace.</param>
    /// <returns>True if more items are available; false if the queue is completed and empty.</returns>
    Task<bool> WaitToReadAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Closes the channel writer, preventing additional enqueues and allowing graceful StopAsync draining.
    /// </summary>
    void CompleteWriter();
}
