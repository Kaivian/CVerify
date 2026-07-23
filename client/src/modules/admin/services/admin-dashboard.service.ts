import { axiosClient } from '@/services/axios-client';
import { DashboardFilterState } from '../types/admin-dashboard-filter.types';

export interface PlatformHealthWidget {
  totalUsers: number;
  activeUsers24h: number;
  usersTrendVsYesterdayPercent: number;
  totalOrganizations: number;
  organizationsTrendPercent: number;
  totalRepositories: number;
  repositoriesTrendPercent: number;
  totalCandidates: number;
  candidatesTrendPercent: number;
  aiJobsToday: number;
  runningPipelines: number;
  failedJobsToday: number;
  successRatePercent: number;
  pendingReviewsCount: number;
  storageUsageGb: number;
  storageTotalGb: number;
}

export interface InfrastructureWidget {
  cpuUsagePercent: number;
  cpuStatus: string;
  ramUsagePercent: number;
  ramUsedMb: number;
  ramTotalMb: number;
  diskUsagePercent: number;
  diskUsedGb: number;
  diskTotalGb: number;
  networkUploadKb: number;
  networkDownloadKb: number;
  dbHealthy: boolean;
  dbQueryLatencyMs: number;
  dbActiveConnections: number;
  redisHealthy: boolean;
  redisHitRatio: number;
  redisConnectedClients: number;
  aiServiceHealthy: boolean;
  aiAvgLatencyMs: number;
  cpuHistory: number[];
  memoryHistory: number[];
  lastUpdated: string;
}

export interface AiOpsWidget {
  serviceStatus: string;
  fastApiStatus: string;
  queueLength: number;
  activeWorkers: number;
  runningJobs: number;
  completedToday: number;
  failedToday: number;
  avgLatencyMs: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  estimatedCostTodayUsd: number;
  estimatedCostMonthUsd: number;
  modelDistribution: Record<string, number>;
  providerDistribution: Record<string, number>;
}

export interface ActivityItem {
  id: string;
  category: string;
  action: string;
  description: string;
  actorName: string;
  status: 'Success' | 'Warning' | 'Danger' | 'Info';
  timestamp: string;
}

export interface AlertItem {
  id: string;
  severity: 'Critical' | 'Warning' | 'Information';
  title: string;
  message: string;
  targetLink: string;
  dismissed: boolean;
  createdAt: string;
}

export interface DailyTrendMetric {
  date: string;
  value: number;
}

export interface CategoryCount {
  name: string;
  count: number;
  percentage: number;
}

export interface UserAnalyticsWidget {
  totalUsers: number;
  activeUsers24h: number;
  recruitersCount: number;
  candidatesCount: number;
  developersCount: number;
  githubLinkedAccounts: number;
  gitlabLinkedAccounts: number;
  registrationTrend: DailyTrendMetric[];
  dauTrend: DailyTrendMetric[];
}

export interface RepositoryAnalyticsWidget {
  totalRepositories: number;
  successfullyAnalyzed: number;
  failedAnalyses: number;
  avgAnalysisDurationSeconds: number;
  topLanguages: CategoryCount[];
  topFrameworks: CategoryCount[];
  analysisTrend: DailyTrendMetric[];
}

export interface CvAnalyticsWidget {
  totalCvDocuments: number;
  completedAnalyses: number;
  failedAnalyses: number;
  pendingAnalyses: number;
  avgProcessingTimeSeconds: number;
  processingTrend: DailyTrendMetric[];
  skillDistribution: CategoryCount[];
}

export interface OrganizationAnalyticsWidget {
  totalOrganizations: number;
  activeOrganizations: number;
  premiumOrganizations: number;
  openJobVacancies: number;
  activeRecruiters: number;
}

export interface AiCostDashboardWidget {
  dailyCostUsd: number;
  weeklyCostUsd: number;
  monthlyCostUsd: number;
  totalTokenConsumption: number;
  providerBreakdownUsd: Record<string, number>;
  modelBreakdownUsd: Record<string, number>;
  pipelineBreakdownUsd: Record<string, number>;
}

export interface PendingTaskItem {
  id: string;
  title: string;
  type: string;
  priority: string;
  targetUrl: string;
  createdAt: string;
}

export interface PendingTasksWidget {
  orgsAwaitingApproval: number;
  flaggedHighRiskUsers: number;
  failedAiJobsNeedingRetry: number;
  repoReAnalysisRequests: number;
  manualModerationRequests: number;
  openSupportTickets: number;
  items: PendingTaskItem[];
}

export interface RecentDeploymentsWidget {
  currentVersion: string;
  previousVersion: string;
  deploymentTime: string;
  environment: string;
  gitCommitHash: string;
  gitBranch: string;
  deploymentStatus: string;
}

export interface AuditLogItemSummary {
  id: string;
  category: string;
  eventType: string;
  actorEmail: string;
  description: string;
  ipAddress: string;
  createdAt: string;
}

export interface AuditSummaryWidget {
  totalEvents24h: number;
  securityEventsCount: number;
  recentLogs: AuditLogItemSummary[];
}

export interface AdminDashboardOverview {
  health: PlatformHealthWidget;
  infrastructure: InfrastructureWidget;
  aiOperations: AiOpsWidget;
  recentActivity: ActivityItem[];
  systemAlerts: AlertItem[];
  userAnalytics: UserAnalyticsWidget;
  repositoryAnalytics: RepositoryAnalyticsWidget;
  cvAnalytics: CvAnalyticsWidget;
  organizationAnalytics: OrganizationAnalyticsWidget;
  aiCost: AiCostDashboardWidget;
  pendingTasks: PendingTasksWidget;
  deployments: RecentDeploymentsWidget;
  auditSummary: AuditSummaryWidget;
  timestamp: string;
}

function buildQueryParams(filters?: DashboardFilterState) {
  if (!filters) return {};
  return {
    timeRange: filters.timeRange,
    customStartDate: filters.customStartDate,
    customEndDate: filters.customEndDate,
    environment: filters.environment,
    organizationId: filters.organizationId,
    aiProvider: filters.aiProvider,
    region: filters.region,
    status: filters.status
  };
}

export const adminDashboardService = {
  async getOverview(filters?: DashboardFilterState): Promise<AdminDashboardOverview> {
    const response = await axiosClient.get<AdminDashboardOverview>('/admin/dashboard/overview', {
      params: buildQueryParams(filters)
    });
    return response.data;
  },

  async getHealthWidget(filters?: DashboardFilterState): Promise<PlatformHealthWidget> {
    const response = await axiosClient.get<PlatformHealthWidget>('/admin/dashboard/widgets/health', {
      params: buildQueryParams(filters)
    });
    return response.data;
  },

  async getInfrastructureWidget(filters?: DashboardFilterState): Promise<InfrastructureWidget> {
    const response = await axiosClient.get<InfrastructureWidget>('/admin/dashboard/widgets/infrastructure', {
      params: buildQueryParams(filters)
    });
    return response.data;
  },

  async getAiOpsWidget(filters?: DashboardFilterState): Promise<AiOpsWidget> {
    const response = await axiosClient.get<AiOpsWidget>('/admin/dashboard/widgets/ai-ops', {
      params: buildQueryParams(filters)
    });
    return response.data;
  },

  async getActivityWidget(count = 20, category?: string, filters?: DashboardFilterState): Promise<ActivityItem[]> {
    const response = await axiosClient.get<ActivityItem[]>('/admin/dashboard/widgets/activity', {
      params: { count, category, ...buildQueryParams(filters) }
    });
    return response.data;
  },

  async getAlertsWidget(filters?: DashboardFilterState): Promise<AlertItem[]> {
    const response = await axiosClient.get<AlertItem[]>('/admin/dashboard/widgets/alerts', {
      params: buildQueryParams(filters)
    });
    return response.data;
  },

  async getUserAnalyticsWidget(filters?: DashboardFilterState): Promise<UserAnalyticsWidget> {
    const response = await axiosClient.get<UserAnalyticsWidget>('/admin/dashboard/widgets/user-analytics', {
      params: buildQueryParams(filters)
    });
    return response.data;
  },

  async getRepositoryAnalyticsWidget(filters?: DashboardFilterState): Promise<RepositoryAnalyticsWidget> {
    const response = await axiosClient.get<RepositoryAnalyticsWidget>('/admin/dashboard/widgets/repo-analytics', {
      params: buildQueryParams(filters)
    });
    return response.data;
  },

  async getCvAnalyticsWidget(filters?: DashboardFilterState): Promise<CvAnalyticsWidget> {
    const response = await axiosClient.get<CvAnalyticsWidget>('/admin/dashboard/widgets/cv-analytics', {
      params: buildQueryParams(filters)
    });
    return response.data;
  },

  async getOrganizationAnalyticsWidget(filters?: DashboardFilterState): Promise<OrganizationAnalyticsWidget> {
    const response = await axiosClient.get<OrganizationAnalyticsWidget>('/admin/dashboard/widgets/org-analytics', {
      params: buildQueryParams(filters)
    });
    return response.data;
  },

  async getAiCostWidget(filters?: DashboardFilterState): Promise<AiCostDashboardWidget> {
    const response = await axiosClient.get<AiCostDashboardWidget>('/admin/dashboard/widgets/ai-cost', {
      params: buildQueryParams(filters)
    });
    return response.data;
  },

  async getPendingTasksWidget(filters?: DashboardFilterState): Promise<PendingTasksWidget> {
    const response = await axiosClient.get<PendingTasksWidget>('/admin/dashboard/widgets/pending-tasks', {
      params: buildQueryParams(filters)
    });
    return response.data;
  },

  async getDeploymentsWidget(filters?: DashboardFilterState): Promise<RecentDeploymentsWidget> {
    const response = await axiosClient.get<RecentDeploymentsWidget>('/admin/dashboard/widgets/deployments', {
      params: buildQueryParams(filters)
    });
    return response.data;
  },

  async getAuditSummaryWidget(filters?: DashboardFilterState): Promise<AuditSummaryWidget> {
    const response = await axiosClient.get<AuditSummaryWidget>('/admin/dashboard/widgets/audit-summary', {
      params: buildQueryParams(filters)
    });
    return response.data;
  },

  async toggleApiEmergencyLock(): Promise<{ success: boolean; isLocked: boolean; message: string }> {
    const response = await axiosClient.post<{ success: boolean; isLocked: boolean; message: string }>('/admin/dashboard/quick-action/toggle-api-lock');
    return response.data;
  },

  async dismissAlert(alertId: string): Promise<{ success: boolean }> {
    const response = await axiosClient.post<{ success: boolean }>(`/admin/dashboard/quick-action/dismiss-alert/${alertId}`);
    return response.data;
  }
};
