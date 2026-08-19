import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { adminDashboardService } from '../services/admin-dashboard.service';
import { useDashboardFilters } from '../context/admin-dashboard-filter.context';
import { executeWithStagger, getStaggeredDelay } from '../utils/staggered-refresh-scheduler';

const DEFAULT_STALE_TIME = 10_000;
const DEFAULT_CACHE_TIME = 5 * 60_000;

function retryPolicy(failureCount: number, error: any): boolean {
  const status = error?.response?.status;
  if (status === 401 || status === 403 || status === 400 || status === 404) {
    return false; // Fail fast without useless retries
  }
  return failureCount < 3; // Retry 5xx, 429, or network dropouts up to 3 times
}

function retryDelay(attemptIndex: number): number {
  return Math.min(1000 * Math.pow(2, attemptIndex), 30000);
}

export function usePlatformHealthWidget() {
  const { filters, refreshTrigger } = useDashboardFilters();

  return useQuery({
    queryKey: ['admin', 'dashboard', 'health', filters, refreshTrigger],
    queryFn: () => adminDashboardService.getHealthWidget(filters),
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME,
    placeholderData: keepPreviousData,
    retry: retryPolicy,
    retryDelay,
    refetchInterval: filters.autoRefreshInterval > 0 ? filters.autoRefreshInterval * 1000 : false
  });
}

export function useInfrastructureWidget() {
  const { filters, refreshTrigger } = useDashboardFilters();

  return useQuery({
    queryKey: ['admin', 'dashboard', 'infrastructure', filters, refreshTrigger],
    queryFn: () => adminDashboardService.getInfrastructureWidget(filters),
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME,
    placeholderData: keepPreviousData,
    retry: retryPolicy,
    retryDelay,
    refetchInterval: filters.autoRefreshInterval > 0 ? filters.autoRefreshInterval * 1000 : false
  });
}

export function useAiOpsWidget() {
  const { filters, refreshTrigger } = useDashboardFilters();

  return useQuery({
    queryKey: ['admin', 'dashboard', 'ai-ops', filters, refreshTrigger],
    queryFn: () => adminDashboardService.getAiOpsWidget(filters),
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME,
    placeholderData: keepPreviousData,
    retry: retryPolicy,
    retryDelay,
    refetchInterval: filters.autoRefreshInterval > 0 ? filters.autoRefreshInterval * 1000 : false
  });
}

export function useActivityWidget(count = 20, category?: string) {
  const { filters, refreshTrigger } = useDashboardFilters();

  return useQuery({
    queryKey: ['admin', 'dashboard', 'activity', count, category, filters, refreshTrigger],
    queryFn: () => adminDashboardService.getActivityWidget(count, category, filters),
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME,
    placeholderData: keepPreviousData,
    retry: retryPolicy,
    retryDelay,
    refetchInterval: filters.autoRefreshInterval > 0 ? filters.autoRefreshInterval * 1000 : false
  });
}

export function useAlertsWidget() {
  const { filters, refreshTrigger } = useDashboardFilters();

  return useQuery({
    queryKey: ['admin', 'dashboard', 'alerts', filters, refreshTrigger],
    queryFn: () => adminDashboardService.getAlertsWidget(filters),
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME,
    placeholderData: keepPreviousData,
    retry: retryPolicy,
    retryDelay,
    refetchInterval: filters.autoRefreshInterval > 0 ? filters.autoRefreshInterval * 1000 : false
  });
}

export function useUserAnalyticsWidget() {
  const { filters, refreshTrigger } = useDashboardFilters();

  return useQuery({
    queryKey: ['admin', 'dashboard', 'user-analytics', filters, refreshTrigger],
    queryFn: () => executeWithStagger(() => adminDashboardService.getUserAnalyticsWidget(filters), getStaggeredDelay('user-analytics', 100)),
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME,
    placeholderData: keepPreviousData,
    retry: retryPolicy,
    retryDelay,
    refetchInterval: filters.autoRefreshInterval > 0 ? filters.autoRefreshInterval * 1000 : false
  });
}

export function useRepositoryAnalyticsWidget() {
  const { filters, refreshTrigger } = useDashboardFilters();

  return useQuery({
    queryKey: ['admin', 'dashboard', 'repo-analytics', filters, refreshTrigger],
    queryFn: () => executeWithStagger(() => adminDashboardService.getRepositoryAnalyticsWidget(filters), getStaggeredDelay('repo-analytics', 200)),
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME,
    placeholderData: keepPreviousData,
    retry: retryPolicy,
    retryDelay,
    refetchInterval: filters.autoRefreshInterval > 0 ? filters.autoRefreshInterval * 1000 : false
  });
}

export function useCvAnalyticsWidget() {
  const { filters, refreshTrigger } = useDashboardFilters();

  return useQuery({
    queryKey: ['admin', 'dashboard', 'cv-analytics', filters, refreshTrigger],
    queryFn: () => executeWithStagger(() => adminDashboardService.getCvAnalyticsWidget(filters), getStaggeredDelay('cv-analytics', 300)),
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME,
    placeholderData: keepPreviousData,
    retry: retryPolicy,
    retryDelay,
    refetchInterval: filters.autoRefreshInterval > 0 ? filters.autoRefreshInterval * 1000 : false
  });
}

export function useOrganizationAnalyticsWidget() {
  const { filters, refreshTrigger } = useDashboardFilters();

  return useQuery({
    queryKey: ['admin', 'dashboard', 'org-analytics', filters, refreshTrigger],
    queryFn: () => executeWithStagger(() => adminDashboardService.getOrganizationAnalyticsWidget(filters), getStaggeredDelay('org-analytics', 400)),
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME,
    placeholderData: keepPreviousData,
    retry: retryPolicy,
    retryDelay,
    refetchInterval: filters.autoRefreshInterval > 0 ? filters.autoRefreshInterval * 1000 : false
  });
}

export function useAiCostWidget() {
  const { filters, refreshTrigger } = useDashboardFilters();

  return useQuery({
    queryKey: ['admin', 'dashboard', 'ai-cost', filters, refreshTrigger],
    queryFn: () => adminDashboardService.getAiCostWidget(filters),
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME,
    placeholderData: keepPreviousData,
    retry: retryPolicy,
    retryDelay,
    refetchInterval: filters.autoRefreshInterval > 0 ? filters.autoRefreshInterval * 1000 : false
  });
}

export function usePendingTasksWidget() {
  const { filters, refreshTrigger } = useDashboardFilters();

  return useQuery({
    queryKey: ['admin', 'dashboard', 'pending-tasks', filters, refreshTrigger],
    queryFn: () => adminDashboardService.getPendingTasksWidget(filters),
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME,
    placeholderData: keepPreviousData,
    retry: retryPolicy,
    retryDelay,
    refetchInterval: filters.autoRefreshInterval > 0 ? filters.autoRefreshInterval * 1000 : false
  });
}

export function useRecentDeploymentsWidget() {
  const { filters, refreshTrigger } = useDashboardFilters();

  return useQuery({
    queryKey: ['admin', 'dashboard', 'deployments', filters, refreshTrigger],
    queryFn: () => adminDashboardService.getDeploymentsWidget(filters),
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME,
    placeholderData: keepPreviousData,
    retry: retryPolicy,
    retryDelay,
    refetchInterval: filters.autoRefreshInterval > 0 ? filters.autoRefreshInterval * 1000 : false
  });
}

export function useAuditSummaryWidget() {
  const { filters, refreshTrigger } = useDashboardFilters();

  return useQuery({
    queryKey: ['admin', 'dashboard', 'audit-summary', filters, refreshTrigger],
    queryFn: () => adminDashboardService.getAuditSummaryWidget(filters),
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME,
    placeholderData: keepPreviousData,
    retry: retryPolicy,
    retryDelay,
    refetchInterval: filters.autoRefreshInterval > 0 ? filters.autoRefreshInterval * 1000 : false
  });
}
