using System.Threading;

namespace CVerify.API.Modules.Shared.Diagnostics;

/// <summary>
/// Monitors logging pipeline health metrics to prevent hidden performance bottlenecks.
/// </summary>
public class PipelineTelemetry
{
    private long _processedCount;
    private long _droppedCount;
    private long _suppressedExceptionsCount;
    private long _throttledLogsCount;
    private long _formattingWarningsCount;

    public long ProcessedCount => Interlocked.Read(ref _processedCount);
    public long DroppedCount => Interlocked.Read(ref _droppedCount);
    public long SuppressedExceptionsCount => Interlocked.Read(ref _suppressedExceptionsCount);
    public long ThrottledLogsCount => Interlocked.Read(ref _throttledLogsCount);
    public long FormattingWarningsCount => Interlocked.Read(ref _formattingWarningsCount);

    public void RecordProcessed() => Interlocked.Increment(ref _processedCount);
    public void RecordDropped() => Interlocked.Increment(ref _droppedCount);
    public void RecordExceptionSuppressed() => Interlocked.Increment(ref _suppressedExceptionsCount);
    public void RecordThrottled() => Interlocked.Increment(ref _throttledLogsCount);
    public void RecordFormattingWarning() => Interlocked.Increment(ref _formattingWarningsCount);

    public object GetStatusReport(int currentQueueSize, int capacity)
    {
        return new
        {
            QueueSize = currentQueueSize,
            QueueCapacity = capacity,
            ProcessedCount = ProcessedCount,
            DroppedCount = DroppedCount,
            SuppressedExceptionsCount = SuppressedExceptionsCount,
            ThrottledLogsCount = ThrottledLogsCount,
            FormattingWarningsCount = FormattingWarningsCount
        };
    }
}
