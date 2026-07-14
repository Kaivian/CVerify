import { axiosClient } from '../../../services/axios-client';

export interface PipelineMetadata {
  id: string;
  displayName: string;
  routeSlug: string;
  queueTypes: string[];
  description: string;
}

export interface StronglyTypedMetric {
  label: string;
  value: string;
  unit?: string;
  trend?: string;
  icon?: string;
  color?: string;
  description?: string;
}

export interface AiPipelineStats {
  activePipelines: number;
  runningTasks: number;
  pendingQueue: number;
  completedToday: number;
  failedToday: number;
  cancelledTasks: number;
  averageExecutionTimeMs: number;
  averageQueueWaitingTimeMs: number;
  activeWorkers: number;
  activeSseConnections: number;
  costToday: number;
  costThisMonth: number;
  successRate: number;
  dailyTrends: AiDailyMetric[];
  domainMetrics?: StronglyTypedMetric[];
  costByProvider?: Record<string, number>;
  costByRepository?: Record<string, number>;
  totalPromptTokens?: number;
  totalCompletionTokens?: number;
}

export interface AiDailyMetric {
  date: string;
  tasksCount: number;
  completedCount: number;
  failedCount: number;
  cancelledCount: number;
  tokenConsumption: number;
  costUsd: number;
  avgLatencyMs: number;
}

export interface AiPipelineListItem {
  id: string;
  pipelineId: string; // pipeline type
  status: string;
  progress: number;
  currentStep?: string;
  modelName?: string;
  provider?: string;
  startedAt?: string;
  completedAt?: string;
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  errorMessage?: string;
  pipelineVersion: string;
  createdAtUtc: string;
  candidateName?: string;
  candidateEmail?: string;
  organizationName?: string;
  organizationId?: string;
  repositoryName?: string;
  repositoryId?: string;
  retryCount: number;
  queuePosition: number;
}

export interface AiPipelineDetail {
  id: string;
  pipelineId: string;
  status: string;
  progress: number;
  currentStep?: string;
  modelName?: string;
  provider?: string;
  startedAt?: string;
  completedAt?: string;
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  errorMessage?: string;
  pipelineVersion: string;
  createdAtUtc: string;
  candidateName?: string;
  candidateEmail?: string;
  organizationName?: string;
  organizationId?: string;
  repositoryName?: string;
  repositoryId?: string;
  stages: AiStreamingStage[];
  metrics: AiStreamingMetric[];
  logs: AiStreamingLog[];
  pipelineTasks: AiTask[];
}

export interface AiStreamingStage {
  id: string;
  stageId: string;
  stageName: string;
  parentStageId?: string;
  status: string;
  progress: number;
  description?: string;
  details?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  retryCount: number;
}

export interface AiStreamingMetric {
  id: string;
  stageId?: string;
  metricName: string;
  metricValue: number;
  timestamp: string;
}

export interface AiStreamingLog {
  id: string;
  stageId?: string;
  logLevel: string;
  component?: string;
  message: string;
  timestamp: string;
}

export interface AiTask {
  id: string;
  jobId: string;
  taskType: string;
  status: string;
  progress: number;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  retryCount: number;
  errorMessage?: string;
  promptTokens?: number;
  completionTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  estimatedCostUsd?: number;
  modelName?: string;
  metadata?: string;
  createdAtUtc: string;
}

export interface AiQueue {
  queueName: string;
  queueLength: number;
  avgWaitingTimeMs: number;
  oldestTask?: string;
  newestTask?: string;
  throughputTps: number;
  workerAllocation: number;
  status: string; // Active/Paused
}

export interface AiProvider {
  providerName: string;
  isAvailable: boolean;
  latencyMs: number;
  requestsPerSec: number;
  errorRate: number;
  rateLimitStatus: string;
  currentQueueSize: number;
  tokenThroughputPerSec: number;
  accumulatedCost: number;
  healthStatus: string;
  fallbackStatus: string;
}

export interface AiWorker {
  workerName: string;
  containerId: string;
  version: string;
  lastHeartbeat: string;
  currentTask: string;
  memoryUsagePercent: number;
  cpuUsagePercent: number;
  activePipelines: number;
  healthStatus: string;
}

class AiOperationsService {
  async getRegistry(): Promise<PipelineMetadata[]> {
    const response = await axiosClient.get<PipelineMetadata[]>('/admin/ai/operations/registry');
    return response.data;
  }

  async getStats(pipelineType?: string): Promise<AiPipelineStats> {
    const params: Record<string, string> = {};
    if (pipelineType) params.pipelineType = pipelineType;

    const response = await axiosClient.get<AiPipelineStats>('/admin/ai/operations/stats', { params });
    return response.data;
  }

  async getPipelines(pipelineType?: string, status?: string, page = 1, pageSize = 50): Promise<AiPipelineListItem[]> {
    const params: Record<string, string | number> = { page, pageSize };
    if (pipelineType) params.pipelineType = pipelineType;
    if (status) params.status = status;

    const response = await axiosClient.get<AiPipelineListItem[]>('/admin/ai/operations/pipelines', { params });
    // Note: our controller route is /api/admin/ai/operations/pipelines, so in backend it is [Route("api/admin/ai/operations")].
    // Wait, since baseURL is /api, we should use /admin/ai/operations/pipelines!
    // Yes! Let's correct this path to '/admin/ai/operations/pipelines'!
    return response.data;
  }

  async getPipelineDetail(id: string): Promise<AiPipelineDetail> {
    const response = await axiosClient.get<AiPipelineDetail>(`/admin/ai/operations/pipelines/${id}`);
    return response.data;
  }

  async getQueues(): Promise<AiQueue[]> {
    const response = await axiosClient.get<AiQueue[]>('/admin/ai/operations/queues');
    return response.data;
  }

  async pauseQueue(queueName: string): Promise<void> {
    await axiosClient.post(`/admin/ai/operations/queues/${queueName}/pause`);
  }

  async resumeQueue(queueName: string): Promise<void> {
    await axiosClient.post(`/admin/ai/operations/queues/${queueName}/resume`);
  }

  async clearQueue(queueName: string): Promise<void> {
    await axiosClient.post(`/admin/ai/operations/queues/${queueName}/clear`);
  }

  async cancelPipeline(id: string, pipelineType: string): Promise<void> {
    await axiosClient.post(`/admin/ai/operations/pipelines/${id}/cancel`, null, {
      params: { pipelineType },
    });
  }

  async retryPipeline(id: string, pipelineType: string, taskId?: string): Promise<void> {
    const params: Record<string, string> = { pipelineType };
    if (taskId) params.taskId = taskId;

    await axiosClient.post(`/admin/ai/operations/pipelines/${id}/retry`, null, { params });
  }

  async getProviders(): Promise<AiProvider[]> {
    const response = await axiosClient.get<AiProvider[]>('/admin/ai/operations/providers');
    return response.data;
  }

  async getWorkers(): Promise<AiWorker[]> {
    const response = await axiosClient.get<AiWorker[]>('/admin/ai/operations/workers');
    return response.data;
  }

  async getRepositories(): Promise<RepoHealth[]> {
    const response = await axiosClient.get<RepoHealth[]>('/admin/ai/operations/repositories');
    return response.data;
  }

  async getEvents(): Promise<AiEvent[]> {
    const response = await axiosClient.get<AiEvent[]>('/admin/ai/operations/events');
    return response.data;
  }

  async triggerRepositoryAnalysis(repoId: string): Promise<{ jobId: string; status: string }> {
    const response = await axiosClient.post<{ jobId: string; status: string }>(`/repositories/${repoId}/analyses`);
    return response.data;
  }
}

export interface RepoHealth {
  id: string;
  name: string;
  owner: string;
  defaultBranch: string;
  latestAnalysisStatus: string;
  latestAnalysisCompletedAtUtc: string | null;
  trustScore: number;
  latestRiskLevel: string;
  latestRiskScore: number;
  lastSyncedAt: string;
  isEnabled: boolean;
}

export interface AiEvent {
  id: string;
  pipelineType: string;
  eventType: string;
  message: string;
  logLevel: string;
  timestamp: string;
  repositoryName: string | null;
}

export const aiOperationsService = new AiOperationsService();
