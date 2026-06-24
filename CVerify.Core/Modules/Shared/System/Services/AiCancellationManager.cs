using System;
using System.Collections.Concurrent;
using System.Threading;

namespace CVerify.API.Modules.Shared.System.Services;

public class AiCancellationManager : IAiCancellationManager
{
    private readonly ConcurrentDictionary<Guid, CancellationTokenSource> _activeSessions = new();
    private readonly object _lock = new();

    public CancellationToken Register(Guid sessionId, CancellationToken linkToken = default)
    {
        lock (_lock)
        {
            // Cancel and replace if exists
            if (_activeSessions.TryRemove(sessionId, out var oldCts))
            {
                try
                {
                    oldCts.Cancel();
                    oldCts.Dispose();
                }
                catch { }
            }

            var cts = linkToken == default
                ? new CancellationTokenSource()
                : CancellationTokenSource.CreateLinkedTokenSource(linkToken);

            if (_activeSessions.TryAdd(sessionId, cts))
            {
                return cts.Token;
            }

            cts.Dispose();
            throw new InvalidOperationException($"Failed to register cancellation token source for session {sessionId}.");
        }
    }

    public void Cancel(Guid sessionId)
    {
        lock (_lock)
        {
            if (_activeSessions.TryRemove(sessionId, out var cts))
            {
                try
                {
                    cts.Cancel();
                }
                finally
                {
                    cts.Dispose();
                }
            }
        }
    }

    public void Unregister(Guid sessionId)
    {
        lock (_lock)
        {
            if (_activeSessions.TryRemove(sessionId, out var cts))
            {
                cts.Dispose();
            }
        }
    }
}
