using System;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;

namespace CVerify.API.Modules.SourceCode.Services;

public record RepositorySyncJob(
    Guid JobId,
    Guid UserId,
    Guid? AuthProviderId
);

public interface IRepositorySyncQueue
{
    void QueueSyncJob(RepositorySyncJob job);
    Task<RepositorySyncJob> DequeueAsync(CancellationToken cancellationToken);
    bool TryDequeue(out RepositorySyncJob job);
    Task<bool> WaitToReadAsync(CancellationToken cancellationToken);
    void CompleteWriter();
}

public class BackgroundRepositorySyncQueue : IRepositorySyncQueue
{
    private readonly Channel<RepositorySyncJob> _channel;

    public BackgroundRepositorySyncQueue()
    {
        var options = new BoundedChannelOptions(1000)
        {
            FullMode = BoundedChannelFullMode.Wait,
            SingleWriter = false,
            SingleReader = true
        };
        _channel = Channel.CreateBounded<RepositorySyncJob>(options);
    }

    public void QueueSyncJob(RepositorySyncJob job)
    {
        ArgumentNullException.ThrowIfNull(job);

        if (!_channel.Writer.TryWrite(job))
        {
            Task.Run(async () => await _channel.Writer.WriteAsync(job).ConfigureAwait(false));
        }
    }

    public async Task<RepositorySyncJob> DequeueAsync(CancellationToken cancellationToken)
    {
        return await _channel.Reader.ReadAsync(cancellationToken).ConfigureAwait(false);
    }

    public bool TryDequeue(out RepositorySyncJob job)
    {
        return _channel.Reader.TryRead(out job!);
    }

    public async Task<bool> WaitToReadAsync(CancellationToken cancellationToken)
    {
        return await _channel.Reader.WaitToReadAsync(cancellationToken).ConfigureAwait(false);
    }

    public void CompleteWriter()
    {
        _channel.Writer.TryComplete();
    }
}
