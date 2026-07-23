export interface WidgetMetadata {
  id: string;
  title: string;
  subtitle: string;
  category: 'overview' | 'infrastructure' | 'analytics' | 'security';
  gridSpan: { sm: number; lg: number };
  requiredPermission?: string;
  featureFlag?: string;
  refreshStrategy: 'polling' | 'signalr' | 'manual';
  staggerDelayMs: number;
}

export const ADMIN_WIDGET_REGISTRY: WidgetMetadata[] = [
  // Overview Tab
  {
    id: 'platform-health',
    title: 'Platform Operations Overview',
    subtitle: 'High-level key performance indicators across the entire CVerify platform',
    category: 'overview',
    gridSpan: { sm: 12, lg: 12 },
    refreshStrategy: 'polling',
    staggerDelayMs: 0
  },
  {
    id: 'system-alerts',
    title: 'System Alerts & Warnings',
    subtitle: 'Active operational notifications requiring administrator attention',
    category: 'overview',
    gridSpan: { sm: 12, lg: 6 },
    refreshStrategy: 'signalr',
    staggerDelayMs: 150
  },
  {
    id: 'pending-tasks',
    title: 'Pending Administrative Tasks',
    subtitle: 'Operations queue awaiting review and approval',
    category: 'overview',
    gridSpan: { sm: 12, lg: 6 },
    refreshStrategy: 'polling',
    staggerDelayMs: 300
  },
  {
    id: 'admin-shortcuts',
    title: 'Administrative Control Shortcuts',
    subtitle: 'Quick access entry points for common platform operations',
    category: 'overview',
    gridSpan: { sm: 12, lg: 12 },
    refreshStrategy: 'manual',
    staggerDelayMs: 0
  },
  {
    id: 'activity-timeline',
    title: 'Live Platform Activity Stream',
    subtitle: 'Real-time timeline of user registrations, repository jobs, CV parsing, and security events',
    category: 'overview',
    gridSpan: { sm: 12, lg: 12 },
    refreshStrategy: 'signalr',
    staggerDelayMs: 450
  },

  // Infrastructure & AI Tab
  {
    id: 'infrastructure-telemetry',
    title: 'Platform Infrastructure & Resources',
    subtitle: 'Host CPU, RAM, Disk, Network, PostgreSQL, Redis, and FastAPI status',
    category: 'infrastructure',
    gridSpan: { sm: 12, lg: 12 },
    refreshStrategy: 'polling',
    staggerDelayMs: 0
  },
  {
    id: 'ai-operations',
    title: 'AI Engine & Pipeline Operations',
    subtitle: 'FastAPI microservices status, task queue throughput, latency, and LLM distribution',
    category: 'infrastructure',
    gridSpan: { sm: 12, lg: 12 },
    refreshStrategy: 'polling',
    staggerDelayMs: 200
  },
  {
    id: 'ai-cost',
    title: 'AI Cost & Token Consumption Dashboard',
    subtitle: 'Daily, weekly, and monthly LLM expenditure breakdown by model and pipeline',
    category: 'infrastructure',
    gridSpan: { sm: 12, lg: 12 },
    refreshStrategy: 'polling',
    staggerDelayMs: 400
  },

  // Domain Analytics Tab
  {
    id: 'user-analytics',
    title: 'User Accounts & Identity Analytics',
    subtitle: 'Registration growth trends, daily active users, and OAuth account linking',
    category: 'analytics',
    gridSpan: { sm: 12, lg: 12 },
    refreshStrategy: 'polling',
    staggerDelayMs: 0
  },
  {
    id: 'repository-analytics',
    title: 'Repository & Source Code Intelligence Analytics',
    subtitle: 'Analysis success rates, average duration, top programming languages, and frameworks',
    category: 'analytics',
    gridSpan: { sm: 12, lg: 12 },
    refreshStrategy: 'polling',
    staggerDelayMs: 200
  },
  {
    id: 'cv-analytics',
    title: 'CV & Talent Processing Analytics',
    subtitle: 'Total uploaded CVs, parsing latency, and candidate skill distribution',
    category: 'analytics',
    gridSpan: { sm: 12, lg: 12 },
    refreshStrategy: 'polling',
    staggerDelayMs: 400
  },
  {
    id: 'organization-analytics',
    title: 'Organization & Enterprise Operations',
    subtitle: 'Verified companies, premium subscriptions, active recruiters, and open job vacancies',
    category: 'analytics',
    gridSpan: { sm: 12, lg: 12 },
    refreshStrategy: 'polling',
    staggerDelayMs: 600
  },

  // Security & Audit Tab
  {
    id: 'audit-summary',
    title: 'System Audit Trail Summary',
    subtitle: 'Recent administrative actions, role modifications, and operational events',
    category: 'security',
    gridSpan: { sm: 12, lg: 12 },
    refreshStrategy: 'polling',
    staggerDelayMs: 0
  },
  {
    id: 'recent-deployments',
    title: 'Recent Deployment Metadata',
    subtitle: 'Environment build details, Git commit hash, and platform release version',
    category: 'security',
    gridSpan: { sm: 12, lg: 12 },
    refreshStrategy: 'polling',
    staggerDelayMs: 200
  }
];
