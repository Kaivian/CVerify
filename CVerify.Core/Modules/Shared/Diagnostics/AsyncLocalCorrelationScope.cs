using System;
using System.Threading;

namespace CVerify.API.Modules.Shared.Diagnostics;

/// <summary>
/// Execution Context boundary context wrapper for tracking Correlation / Request IDs across asynchronous chains.
/// </summary>
public static class AsyncLocalCorrelationScope
{
    private static readonly AsyncLocal<string?> _correlationId = new();

    public static string? CurrentCorrelationId
    {
        get => _correlationId.Value;
        set => _correlationId.Value = value;
    }

    public static IDisposable BeginScope(string correlationId)
    {
        var previous = _correlationId.Value;
        _correlationId.Value = correlationId;
        return new ScopeDisposable(previous);
    }

    private class ScopeDisposable : IDisposable
    {
        private readonly string? _previous;

        public ScopeDisposable(string? previous)
        {
            _previous = previous;
        }

        public void Dispose()
        {
            _correlationId.Value = _previous;
        }
    }
}
