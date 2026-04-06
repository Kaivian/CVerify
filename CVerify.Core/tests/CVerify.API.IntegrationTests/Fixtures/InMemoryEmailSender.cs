using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Application.DTOs;
using CVerify.API.Application.Interfaces;

namespace CVerify.API.IntegrationTests.Fixtures;

/// <summary>
/// A high-performance, thread-safe in-memory email sender for validating transactional dispatches in integration tests.
/// </summary>
public class InMemoryEmailSender : IEmailSender
{
    private readonly ConcurrentQueue<EmailMessage> _sentMessages = new();

    /// <summary>
    /// Holds all intercepted email messages dispatched during the current test transaction.
    /// </summary>
    public IEnumerable<EmailMessage> SentMessages => _sentMessages.ToArray();

    /// <summary>
    /// Resets the buffered messages.
    /// </summary>
    public void Clear() => _sentMessages.Clear();

    /// <inheritdoc />
    public Task SendEmailAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        _sentMessages.Enqueue(message);
        return Task.CompletedTask;
    }
}
