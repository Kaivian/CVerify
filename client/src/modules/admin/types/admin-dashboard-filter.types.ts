export type TimeRangePreset = '10m' | '30m' | '1h' | '6h' | '24h' | '7d' | 'custom';
export type EnvironmentFilter = 'all' | 'development' | 'staging' | 'production';
export type AiProviderFilter = 'all' | 'openai' | 'anthropic' | 'gemini' | 'local';
export type RegionFilter = 'all' | 'us-east' | 'us-west' | 'eu-central' | 'ap-southeast';
export type HealthStatusFilter = 'all' | 'healthy' | 'warning' | 'critical' | 'offline';

export interface DashboardFilterState {
  timeRange: TimeRangePreset;
  customStartDate: string | null;
  customEndDate: string | null;
  autoRefreshInterval: number; // seconds, 0 = manual
  environment: EnvironmentFilter;
  organizationId: string; // 'all' or specific org ID
  aiProvider: AiProviderFilter;
  region: RegionFilter;
  status: HealthStatusFilter;
}

export const DEFAULT_DASHBOARD_FILTERS: DashboardFilterState = {
  timeRange: '24h',
  customStartDate: null,
  customEndDate: null,
  autoRefreshInterval: 30,
  environment: 'all',
  organizationId: 'all',
  aiProvider: 'all',
  region: 'all',
  status: 'all'
};
