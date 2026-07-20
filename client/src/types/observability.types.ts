export type LogSeverity = 'TRACE' | 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
export type LogService = 'Frontend' | 'Backend' | 'AI Backend';

export interface ObservabilityLogEntry {
  id: string;
  timestamp: string;
  severity: LogSeverity;
  service: LogService;
  source: string;
  message: string;
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  requestId?: string;
  pipelineId?: string;
  jobId?: string;
  status?: 'running' | 'success' | 'error' | 'aborted';
  latencyMs?: number;
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };
  cost?: number;
  metadata?: Record<string, any>;
  isPinned?: boolean;
}

export interface MetricItem<T = number | string> {
  name: string;
  value: T;
  unit?: string;
  status: 'normal' | 'warning' | 'critical' | 'healthy' | 'degraded' | 'offline';
  lastUpdated: string;
  trend?: number[]; // Array of past numeric samples for mini sparklines
}

export interface ServerMetrics {
  cpuUsage: MetricItem<number>;
  ramUsage: MetricItem<number>; // percentage
  ramUsedMb: MetricItem<number>;
  ramTotalMb: MetricItem<number>;
  gpuUsage?: MetricItem<number>;
  diskUsage: MetricItem<number>; // percentage
  diskUsedGb: MetricItem<number>;
  diskTotalGb: MetricItem<number>;
  diskReadKb: MetricItem<number>;
  diskWriteKb: MetricItem<number>;
  networkUploadKb: MetricItem<number>;
  networkDownloadKb: MetricItem<number>;
}

export interface ApplicationMetrics {
  aspnetMemoryMb: MetricItem<number>;
  threadCount: MetricItem<number>;
  activeRequests: MetricItem<number>;
  currentQueueSize: MetricItem<number>;
  activeStreamingSessions: MetricItem<number>;
  connectedSignalRClients: MetricItem<number>;
  connectedSSEClients: MetricItem<number>;
}

export interface AiServiceMetrics {
  status: MetricItem<string>;
  runningJobs: MetricItem<number>;
  queueLength: MetricItem<number>;
  tokensProcessed: MetricItem<number>;
  requestsPerMinute: MetricItem<number>;
  averageResponseTimeMs: MetricItem<number>;
  errorRatePercent: MetricItem<number>;
}

export interface DatabaseMetrics {
  status: MetricItem<string>;
  activeConnections: MetricItem<number>;
  queryLatencyMs: MetricItem<number>;
  transactionsPerSec: MetricItem<number>;
}

export interface CacheMetrics {
  status: MetricItem<string>;
  connectedClients: MetricItem<number>;
  memoryUsageMb: MetricItem<number>;
  hitRatioPercent: MetricItem<number>;
}

export interface SystemMetricsResponse {
  timestamp: string;
  server: ServerMetrics;
  application: ApplicationMetrics;
  aiService: AiServiceMetrics;
  database: DatabaseMetrics;
  cache: CacheMetrics;
}

export interface ObservabilityFilterOptions {
  severity?: LogSeverity | 'ALL';
  service?: LogService | 'ALL';
  source?: string | 'ALL';
  searchQuery?: string;
  pipelineId?: string;
  timeRange?: '1m' | '5m' | '15m' | '1h' | '24h' | 'ALL';
  showOnlyPinned?: boolean;
}
