using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace CVerify.API.Modules.Admin.DTOs;

public class TokenUsageDto
{
    public int Input { get; set; }
    public int Output { get; set; }
    public int Total { get; set; }
}

public class ObservabilityLogEntryDto
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string Severity { get; set; } = "INFO"; // TRACE, DEBUG, INFO, WARNING, ERROR, CRITICAL
    public string Service { get; set; } = "Backend"; // Frontend, Backend, AI Backend
    public string Source { get; set; } = "System";
    public string Message { get; set; } = string.Empty;
    public string? CorrelationId { get; set; }
    public string? TraceId { get; set; }
    public string? SpanId { get; set; }
    public string? RequestId { get; set; }
    public string? PipelineId { get; set; }
    public string? JobId { get; set; }
    public string? Status { get; set; } // running, success, error, aborted
    public double? LatencyMs { get; set; }
    public TokenUsageDto? TokenUsage { get; set; }
    public decimal? Cost { get; set; }
    public Dictionary<string, object>? Metadata { get; set; }
}

public class MetricItemDto<T>
{
    public string Name { get; set; } = string.Empty;
    public T Value { get; set; } = default!;
    public string? Unit { get; set; }
    public string Status { get; set; } = "normal"; // normal, warning, critical, healthy, degraded, offline
    public DateTime LastUpdated { get; set; } = DateTime.UtcNow;
    public List<double>? Trend { get; set; }
}

public class ServerMetricsDto
{
    public MetricItemDto<double> CpuUsage { get; set; } = new();
    public MetricItemDto<double> RamUsage { get; set; } = new();
    public MetricItemDto<double> RamUsedMb { get; set; } = new();
    public MetricItemDto<double> RamTotalMb { get; set; } = new();
    public MetricItemDto<double>? GpuUsage { get; set; }
    public MetricItemDto<double> DiskUsage { get; set; } = new();
    public MetricItemDto<double> DiskUsedGb { get; set; } = new();
    public MetricItemDto<double> DiskTotalGb { get; set; } = new();
    public MetricItemDto<double> DiskReadKb { get; set; } = new();
    public MetricItemDto<double> DiskWriteKb { get; set; } = new();
    public MetricItemDto<double> NetworkUploadKb { get; set; } = new();
    public MetricItemDto<double> NetworkDownloadKb { get; set; } = new();
}

public class ApplicationMetricsDto
{
    public MetricItemDto<double> AspnetMemoryMb { get; set; } = new();
    public MetricItemDto<int> ThreadCount { get; set; } = new();
    public MetricItemDto<int> ActiveRequests { get; set; } = new();
    public MetricItemDto<int> CurrentQueueSize { get; set; } = new();
    public MetricItemDto<int> ActiveStreamingSessions { get; set; } = new();
    public MetricItemDto<int> ConnectedSignalRClients { get; set; } = new();
    public MetricItemDto<int> ConnectedSSEClients { get; set; } = new();
}

public class AiServiceMetricsDto
{
    public MetricItemDto<string> Status { get; set; } = new();
    public MetricItemDto<int> RunningJobs { get; set; } = new();
    public MetricItemDto<int> QueueLength { get; set; } = new();
    public MetricItemDto<long> TokensProcessed { get; set; } = new();
    public MetricItemDto<double> RequestsPerMinute { get; set; } = new();
    public MetricItemDto<double> AverageResponseTimeMs { get; set; } = new();
    public MetricItemDto<double> ErrorRatePercent { get; set; } = new();
}

public class DatabaseMetricsDto
{
    public MetricItemDto<string> Status { get; set; } = new();
    public MetricItemDto<int> ActiveConnections { get; set; } = new();
    public MetricItemDto<double> QueryLatencyMs { get; set; } = new();
    public MetricItemDto<double> TransactionsPerSec { get; set; } = new();
}

public class CacheMetricsDto
{
    public MetricItemDto<string> Status { get; set; } = new();
    public MetricItemDto<int> ConnectedClients { get; set; } = new();
    public MetricItemDto<double> MemoryUsageMb { get; set; } = new();
    public MetricItemDto<double> HitRatioPercent { get; set; } = new();
}

public class SystemMetricsResponseDto
{
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public ServerMetricsDto Server { get; set; } = new();
    public ApplicationMetricsDto Application { get; set; } = new();
    public AiServiceMetricsDto AiService { get; set; } = new();
    public DatabaseMetricsDto Database { get; set; } = new();
    public CacheMetricsDto Cache { get; set; } = new();
}
