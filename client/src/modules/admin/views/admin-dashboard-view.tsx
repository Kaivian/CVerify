'use client';

import React from 'react';
import { Tabs, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@heroui/react';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Server,
  BarChart3,
  ShieldCheck,
  RefreshCw,
  Clock,
  Sparkles,
  Activity,
  AlertTriangle,
  FileText,
  Users,
  Building2,
  GitBranch
} from 'lucide-react';

import { DashboardWidgetWrapper } from '../components/dashboard-widget-wrapper';
import { WelcomeHeaderWidget } from '../components/widgets/welcome-header-widget';
import { PlatformHealthWidget } from '../components/widgets/platform-health-widget';
import { InfrastructureTelemetryWidget } from '../components/widgets/infrastructure-telemetry-widget';
import { AiOperationsWidget } from '../components/widgets/ai-operations-widget';
import { ActivityTimelineWidget } from '../components/widgets/activity-timeline-widget';
import { SystemAlertsWidget } from '../components/widgets/system-alerts-widget';
import { UserAnalyticsWidget } from '../components/widgets/user-analytics-widget';
import { RepositoryAnalyticsWidget } from '../components/widgets/repository-analytics-widget';
import { CvAnalyticsWidget } from '../components/widgets/cv-analytics-widget';
import { OrganizationAnalyticsWidget } from '../components/widgets/organization-analytics-widget';
import { AiCostDashboardWidget } from '../components/widgets/ai-cost-dashboard-widget';
import { AdministrativeShortcutsWidget } from '../components/widgets/administrative-shortcuts-widget';
import { PendingTasksWidget } from '../components/widgets/pending-tasks-widget';
import { RecentDeploymentsWidget } from '../components/widgets/recent-deployments-widget';
import { AuditSummaryWidget } from '../components/widgets/audit-summary-widget';
import { PlatformFooterWidget } from '../components/widgets/platform-footer-widget';

import { adminDashboardService, type AdminDashboardOverview } from '../services/admin-dashboard.service';

export function AdminDashboardView() {
  const [data, setData] = React.useState<AdminDashboardOverview | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  const [activeTab, setActiveTab] = React.useState<string>('overview');
  const [autoRefreshInterval, setAutoRefreshInterval] = React.useState<number>(30); // 30s default
  const [isApiLocked, setIsApiLocked] = React.useState<boolean>(false);

  const fetchData = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const overview = await adminDashboardService.getOverview();
      setData(overview);
    } catch (err: any) {
      console.error('[AdminDashboardView] Failed to fetch dashboard overview:', err);
      setError(err?.response?.data?.message || err?.message || 'Failed to load control center overview data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto Refresh Timer
  React.useEffect(() => {
    if (autoRefreshInterval <= 0) return;

    const timer = setInterval(() => {
      fetchData();
    }, autoRefreshInterval * 1000);

    return () => clearInterval(timer);
  }, [autoRefreshInterval, fetchData]);

  const handleToggleApiLock = async () => {
    try {
      const res = await adminDashboardService.toggleApiEmergencyLock();
      setIsApiLocked(res.isLocked);
      fetchData();
    } catch (err) {
      console.error('Failed to toggle API lock:', err);
    }
  };

  const handleDismissAlert = async (alertId: string) => {
    try {
      await adminDashboardService.dismissAlert(alertId);
      fetchData();
    } catch (err) {
      console.error('Failed to dismiss alert:', err);
    }
  };

  return (
    <div className="space-y-6 font-outfit pb-12">
      {/* 1. Welcome Header Banner Widget */}
      <WelcomeHeaderWidget
        adminName="System Administrator"
        adminEmail="admin@cverify.ai"
        environment="Production"
        version={data?.deployments?.currentVersion || 'v2.4.0'}
        deploymentStatus={data?.deployments?.deploymentStatus || 'Healthy'}
        isApiLocked={isApiLocked}
        onToggleApiLock={handleToggleApiLock}
        onRefreshAll={fetchData}
        isRefreshing={isLoading}
      />

      {/* Control Bar: Tabs & Auto-Refresh Policy */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-separator pb-4">
        <Tabs
          selectedKey={activeTab}
          onSelectionChange={(key) => setActiveTab(key as string)}
          variant="secondary"
        >
          <Tabs.ListContainer>
            <Tabs.List aria-label="Dashboard Section Tabs" className="gap-6 border-none">
              <Tabs.Tab id="overview" className="pb-1.5 text-xs font-bold select-none cursor-pointer flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4" />
                <span>Overview</span>
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="infrastructure" className="pb-1.5 text-xs font-bold select-none cursor-pointer flex items-center gap-2">
                <Server className="w-4 h-4" />
                <span>Infrastructure & AI</span>
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="analytics" className="pb-1.5 text-xs font-bold select-none cursor-pointer flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                <span>Domain Analytics</span>
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="security" className="pb-1.5 text-xs font-bold select-none cursor-pointer flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                <span>Security & Audit</span>
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>

        {/* Auto Refresh Dropdown */}
        <div className="flex items-center gap-2 shrink-0 select-none">
          <span className="text-xs text-muted font-medium flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-accent" /> Auto Refresh:
          </span>
          <Dropdown>
            <DropdownTrigger>
              <Button size="sm" variant="bordered" className="text-xs font-semibold cursor-pointer border-border">
                {autoRefreshInterval > 0 ? `Every ${autoRefreshInterval}s` : 'Paused'}
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Auto Refresh Rate"
              onAction={(key) => setAutoRefreshInterval(Number(key))}
            >
              <DropdownItem key="10">Every 10 seconds</DropdownItem>
              <DropdownItem key="30">Every 30 seconds</DropdownItem>
              <DropdownItem key="60">Every 60 seconds</DropdownItem>
              <DropdownItem key="0">Paused (Manual only)</DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
      </div>

      {/* Tab 1: Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Section 2: Platform Health Overview */}
          <DashboardWidgetWrapper
            title="Platform Operations Overview"
            subtitle="High-level key performance indicators across the entire CVerify platform"
            icon={<Activity className="w-4 h-4" />}
            isLoading={isLoading}
            error={error}
            onRefresh={fetchData}
          >
            <PlatformHealthWidget data={data?.health} isLoading={isLoading} />
          </DashboardWidgetWrapper>

          {/* Section 6 & Section 13: System Alerts & Pending Administrative Tasks */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DashboardWidgetWrapper
              title="System Alerts & Warnings"
              subtitle="Active operational notifications requiring administrator attention"
              icon={<AlertTriangle className="w-4 h-4 text-warning" />}
              isLoading={isLoading}
              error={error}
              onRefresh={fetchData}
            >
              <SystemAlertsWidget
                alerts={data?.systemAlerts}
                isLoading={isLoading}
                onDismissAlert={handleDismissAlert}
              />
            </DashboardWidgetWrapper>

            <DashboardWidgetWrapper
              title="Pending Administrative Tasks"
              subtitle="Operations queue awaiting review and approval"
              icon={<Clock className="w-4 h-4 text-accent" />}
              isLoading={isLoading}
              error={error}
              onRefresh={fetchData}
            >
              <PendingTasksWidget data={data?.pendingTasks} isLoading={isLoading} />
            </DashboardWidgetWrapper>
          </div>

          {/* Section 12: Administrative Shortcuts */}
          <DashboardWidgetWrapper
            title="Administrative Control Shortcuts"
            subtitle="Quick access entry points for common platform operations"
            icon={<Sparkles className="w-4 h-4" />}
          >
            <AdministrativeShortcutsWidget />
          </DashboardWidgetWrapper>

          {/* Section 5: Recent Platform Activity Timeline */}
          <DashboardWidgetWrapper
            title="Live Platform Activity Stream"
            subtitle="Real-time timeline of user registrations, repository jobs, CV parsing, and security events"
            icon={<Activity className="w-4 h-4" />}
            isLoading={isLoading}
            error={error}
            onRefresh={fetchData}
          >
            <ActivityTimelineWidget items={data?.recentActivity} isLoading={isLoading} onRefresh={fetchData} />
          </DashboardWidgetWrapper>
        </div>
      )}

      {/* Tab 2: Infrastructure & AI Operations */}
      {activeTab === 'infrastructure' && (
        <div className="space-y-6">
          {/* Section 3: Infrastructure Status */}
          <DashboardWidgetWrapper
            title="Platform Infrastructure & Resources"
            subtitle="Host CPU, RAM, Disk, Network, PostgreSQL, Redis, and FastAPI status"
            icon={<Server className="w-4 h-4" />}
            isLoading={isLoading}
            error={error}
            onRefresh={fetchData}
          >
            <InfrastructureTelemetryWidget data={data?.infrastructure} isLoading={isLoading} />
          </DashboardWidgetWrapper>

          {/* Section 4: AI Platform Status */}
          <DashboardWidgetWrapper
            title="AI Engine & Pipeline Operations"
            subtitle="FastAPI microservices status, task queue throughput, latency, and LLM distribution"
            icon={<Sparkles className="w-4 h-4" />}
            isLoading={isLoading}
            error={error}
            onRefresh={fetchData}
          >
            <AiOperationsWidget data={data?.aiOperations} isLoading={isLoading} />
          </DashboardWidgetWrapper>

          {/* Section 11: AI Cost Dashboard */}
          <DashboardWidgetWrapper
            title="AI Cost & Token Consumption Dashboard"
            subtitle="Daily, weekly, and monthly LLM expenditure breakdown by model and pipeline"
            icon={<Sparkles className="w-4 h-4 text-success" />}
            isLoading={isLoading}
            error={error}
            onRefresh={fetchData}
          >
            <AiCostDashboardWidget data={data?.aiCost} isLoading={isLoading} />
          </DashboardWidgetWrapper>
        </div>
      )}

      {/* Tab 3: Domain Analytics */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Section 7: User Analytics */}
          <DashboardWidgetWrapper
            title="User Accounts & Identity Analytics"
            subtitle="Registration growth trends, daily active users, and OAuth account linking"
            icon={<Users className="w-4 h-4" />}
            isLoading={isLoading}
            error={error}
            onRefresh={fetchData}
          >
            <UserAnalyticsWidget data={data?.userAnalytics} isLoading={isLoading} />
          </DashboardWidgetWrapper>

          {/* Section 8: Repository Analytics */}
          <DashboardWidgetWrapper
            title="Repository & Source Code Intelligence Analytics"
            subtitle="Analysis success rates, average duration, top programming languages, and frameworks"
            icon={<GitBranch className="w-4 h-4" />}
            isLoading={isLoading}
            error={error}
            onRefresh={fetchData}
          >
            <RepositoryAnalyticsWidget data={data?.repositoryAnalytics} isLoading={isLoading} />
          </DashboardWidgetWrapper>

          {/* Section 9: CV Analytics */}
          <DashboardWidgetWrapper
            title="CV & Talent Processing Analytics"
            subtitle="Total uploaded CVs, parsing latency, and candidate skill distribution"
            icon={<FileText className="w-4 h-4" />}
            isLoading={isLoading}
            error={error}
            onRefresh={fetchData}
          >
            <CvAnalyticsWidget data={data?.cvAnalytics} isLoading={isLoading} />
          </DashboardWidgetWrapper>

          {/* Section 10: Organization Analytics */}
          <DashboardWidgetWrapper
            title="Organization & Enterprise Operations"
            subtitle="Verified companies, premium subscriptions, active recruiters, and open job vacancies"
            icon={<Building2 className="w-4 h-4" />}
            isLoading={isLoading}
            error={error}
            onRefresh={fetchData}
          >
            <OrganizationAnalyticsWidget data={data?.organizationAnalytics} isLoading={isLoading} />
          </DashboardWidgetWrapper>
        </div>
      )}

      {/* Tab 4: Security & Audit */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          {/* Section 15: Audit Log Summary */}
          <DashboardWidgetWrapper
            title="System Audit Trail Summary"
            subtitle="Recent administrative actions, role modifications, and operational events"
            icon={<FileText className="w-4 h-4" />}
            isLoading={isLoading}
            error={error}
            onRefresh={fetchData}
          >
            <AuditSummaryWidget data={data?.auditSummary} isLoading={isLoading} />
          </DashboardWidgetWrapper>

          {/* Section 14: Recent Deployments */}
          <DashboardWidgetWrapper
            title="Recent Deployment Metadata"
            subtitle="Environment build details, Git commit hash, and platform release version"
            icon={<Server className="w-4 h-4" />}
            isLoading={isLoading}
            error={error}
            onRefresh={fetchData}
          >
            <RecentDeploymentsWidget data={data?.deployments} isLoading={isLoading} />
          </DashboardWidgetWrapper>
        </div>
      )}

      {/* Section 16: Footer */}
      <PlatformFooterWidget
        platformVersion={data?.deployments?.currentVersion || 'v2.4.0'}
        environment={data?.deployments?.environment || 'Production'}
        dbStatus={data?.infrastructure?.dbHealthy ? 'Connected & Healthy' : 'Degraded'}
      />
    </div>
  );
}
