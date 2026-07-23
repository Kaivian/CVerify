'use client';

import React, { useEffect } from 'react';
import { Tabs } from '@heroui/react';
import { useQueryClient } from '@tanstack/react-query';
import * as signalR from '@microsoft/signalr';
import {
  LayoutDashboard,
  Server,
  BarChart3,
  ShieldCheck,
  Activity,
  AlertTriangle,
  Clock,
  Sparkles,
  Users,
  GitBranch,
  FileText,
  Building2
} from 'lucide-react';

import { DashboardFilterProvider, useDashboardFilters } from '../context/admin-dashboard-filter.context';
import { AdminDashboardFilterBar } from '../components/admin-dashboard-filter-bar';
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

import {
  usePlatformHealthWidget,
  useInfrastructureWidget,
  useAiOpsWidget,
  useActivityWidget,
  useAlertsWidget,
  useUserAnalyticsWidget,
  useRepositoryAnalyticsWidget,
  useCvAnalyticsWidget,
  useOrganizationAnalyticsWidget,
  useAiCostWidget,
  usePendingTasksWidget,
  useRecentDeploymentsWidget,
  useAuditSummaryWidget
} from '../hooks/use-admin-dashboard-widgets';

import { adminDashboardService } from '../services/admin-dashboard.service';

function AdminDashboardContent() {
  const queryClient = useQueryClient();
  const { triggerRefreshAll } = useDashboardFilters();
  const [activeTab, setActiveTab] = React.useState<string>('overview');
  const [isApiLocked, setIsApiLocked] = React.useState<boolean>(false);

  // Granular React Query Hooks
  const healthQuery = usePlatformHealthWidget();
  const infraQuery = useInfrastructureWidget();
  const aiOpsQuery = useAiOpsWidget();
  const activityQuery = useActivityWidget();
  const alertsQuery = useAlertsWidget();
  const userAnalyticsQuery = useUserAnalyticsWidget();
  const repoAnalyticsQuery = useRepositoryAnalyticsWidget();
  const cvAnalyticsQuery = useCvAnalyticsWidget();
  const orgAnalyticsQuery = useOrganizationAnalyticsWidget();
  const aiCostQuery = useAiCostWidget();
  const pendingTasksQuery = usePendingTasksWidget();
  const deploymentsQuery = useRecentDeploymentsWidget();
  const auditSummaryQuery = useAuditSummaryWidget();

  // SignalR Listener setup for real-time invalidation
  useEffect(() => {
    let hubConnection: signalR.HubConnection | null = null;
    try {
      hubConnection = new signalR.HubConnectionBuilder()
        .withUrl('/hubs/admin')
        .withAutomaticReconnect()
        .build();

      hubConnection.on('MetricsUpdated', () => {
        queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
      });

      hubConnection.on('AlertTriggered', () => {
        alertsQuery.refetch();
      });

      hubConnection.start().catch((err: any) => console.log('[SignalR] SignalR connection fallback to polling:', err));
    } catch (e) {
      // SignalR optional fallback
    }

    return () => {
      if (hubConnection) {
        hubConnection.stop();
      }
    };
  }, [queryClient, alertsQuery]);

  const handleToggleApiLock = async () => {
    try {
      const res = await adminDashboardService.toggleApiEmergencyLock();
      setIsApiLocked(res.isLocked);
      triggerRefreshAll();
    } catch (err) {
      console.error('Failed to toggle API lock:', err);
    }
  };

  const handleDismissAlert = async (alertId: string) => {
    try {
      await adminDashboardService.dismissAlert(alertId);
      alertsQuery.refetch();
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
        version={deploymentsQuery.data?.currentVersion || 'v2.4.0'}
        deploymentStatus={deploymentsQuery.data?.deploymentStatus || 'Healthy'}
        isApiLocked={isApiLocked}
        onToggleApiLock={handleToggleApiLock}
        onRefreshAll={triggerRefreshAll}
        isRefreshing={healthQuery.isFetching}
      />

      {/* 2. Global Unified Filter Bar */}
      <AdminDashboardFilterBar />

      {/* 3. Category Tabs */}
      <div className="border-b border-separator pb-4">
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
      </div>

      {/* Tab 1: Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <DashboardWidgetWrapper
            title="Platform Operations Overview"
            subtitle="High-level key performance indicators across the entire CVerify platform"
            icon={<Activity className="w-4 h-4" />}
            isLoading={healthQuery.isLoading}
            isFetching={healthQuery.isFetching}
            error={healthQuery.error}
            onRefresh={healthQuery.refetch}
          >
            <PlatformHealthWidget data={healthQuery.data} isLoading={healthQuery.isLoading} />
          </DashboardWidgetWrapper>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DashboardWidgetWrapper
              title="System Alerts & Warnings"
              subtitle="Active operational notifications requiring administrator attention"
              icon={<AlertTriangle className="w-4 h-4 text-warning" />}
              isLoading={alertsQuery.isLoading}
              isFetching={alertsQuery.isFetching}
              error={alertsQuery.error}
              onRefresh={alertsQuery.refetch}
            >
              <SystemAlertsWidget
                alerts={alertsQuery.data}
                isLoading={alertsQuery.isLoading}
                onDismissAlert={handleDismissAlert}
              />
            </DashboardWidgetWrapper>

            <DashboardWidgetWrapper
              title="Pending Administrative Tasks"
              subtitle="Operations queue awaiting review and approval"
              icon={<Clock className="w-4 h-4 text-accent" />}
              isLoading={pendingTasksQuery.isLoading}
              isFetching={pendingTasksQuery.isFetching}
              error={pendingTasksQuery.error}
              onRefresh={pendingTasksQuery.refetch}
            >
              <PendingTasksWidget data={pendingTasksQuery.data} isLoading={pendingTasksQuery.isLoading} />
            </DashboardWidgetWrapper>
          </div>

          <DashboardWidgetWrapper
            title="Administrative Control Shortcuts"
            subtitle="Quick access entry points for common platform operations"
            icon={<Sparkles className="w-4 h-4" />}
          >
            <AdministrativeShortcutsWidget />
          </DashboardWidgetWrapper>

          <DashboardWidgetWrapper
            title="Live Platform Activity Stream"
            subtitle="Real-time timeline of user registrations, repository jobs, CV parsing, and security events"
            icon={<Activity className="w-4 h-4" />}
            isLoading={activityQuery.isLoading}
            isFetching={activityQuery.isFetching}
            error={activityQuery.error}
            onRefresh={activityQuery.refetch}
          >
            <ActivityTimelineWidget items={activityQuery.data} isLoading={activityQuery.isLoading} onRefresh={activityQuery.refetch} />
          </DashboardWidgetWrapper>
        </div>
      )}

      {/* Tab 2: Infrastructure & AI Operations */}
      {activeTab === 'infrastructure' && (
        <div className="space-y-6">
          <DashboardWidgetWrapper
            title="Platform Infrastructure & Resources"
            subtitle="Host CPU, RAM, Disk, Network, PostgreSQL, Redis, and FastAPI status"
            icon={<Server className="w-4 h-4" />}
            isLoading={infraQuery.isLoading}
            isFetching={infraQuery.isFetching}
            error={infraQuery.error}
            onRefresh={infraQuery.refetch}
          >
            <InfrastructureTelemetryWidget data={infraQuery.data} isLoading={infraQuery.isLoading} />
          </DashboardWidgetWrapper>

          <DashboardWidgetWrapper
            title="AI Engine & Pipeline Operations"
            subtitle="FastAPI microservices status, task queue throughput, latency, and LLM distribution"
            icon={<Sparkles className="w-4 h-4" />}
            isLoading={aiOpsQuery.isLoading}
            isFetching={aiOpsQuery.isFetching}
            error={aiOpsQuery.error}
            onRefresh={aiOpsQuery.refetch}
          >
            <AiOperationsWidget data={aiOpsQuery.data} isLoading={aiOpsQuery.isLoading} />
          </DashboardWidgetWrapper>

          <DashboardWidgetWrapper
            title="AI Cost & Token Consumption Dashboard"
            subtitle="Daily, weekly, and monthly LLM expenditure breakdown by model and pipeline"
            icon={<Sparkles className="w-4 h-4 text-success" />}
            isLoading={aiCostQuery.isLoading}
            isFetching={aiCostQuery.isFetching}
            error={aiCostQuery.error}
            onRefresh={aiCostQuery.refetch}
          >
            <AiCostDashboardWidget data={aiCostQuery.data} isLoading={aiCostQuery.isLoading} />
          </DashboardWidgetWrapper>
        </div>
      )}

      {/* Tab 3: Domain Analytics */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <DashboardWidgetWrapper
            title="User Accounts & Identity Analytics"
            subtitle="Registration growth trends, daily active users, and OAuth account linking"
            icon={<Users className="w-4 h-4" />}
            isLoading={userAnalyticsQuery.isLoading}
            isFetching={userAnalyticsQuery.isFetching}
            error={userAnalyticsQuery.error}
            onRefresh={userAnalyticsQuery.refetch}
          >
            <UserAnalyticsWidget data={userAnalyticsQuery.data} isLoading={userAnalyticsQuery.isLoading} />
          </DashboardWidgetWrapper>

          <DashboardWidgetWrapper
            title="Repository & Source Code Intelligence Analytics"
            subtitle="Analysis success rates, average duration, top programming languages, and frameworks"
            icon={<GitBranch className="w-4 h-4" />}
            isLoading={repoAnalyticsQuery.isLoading}
            isFetching={repoAnalyticsQuery.isFetching}
            error={repoAnalyticsQuery.error}
            onRefresh={repoAnalyticsQuery.refetch}
          >
            <RepositoryAnalyticsWidget data={repoAnalyticsQuery.data} isLoading={repoAnalyticsQuery.isLoading} />
          </DashboardWidgetWrapper>

          <DashboardWidgetWrapper
            title="CV & Talent Processing Analytics"
            subtitle="Total uploaded CVs, parsing latency, and candidate skill distribution"
            icon={<FileText className="w-4 h-4" />}
            isLoading={cvAnalyticsQuery.isLoading}
            isFetching={cvAnalyticsQuery.isFetching}
            error={cvAnalyticsQuery.error}
            onRefresh={cvAnalyticsQuery.refetch}
          >
            <CvAnalyticsWidget data={cvAnalyticsQuery.data} isLoading={cvAnalyticsQuery.isLoading} />
          </DashboardWidgetWrapper>

          <DashboardWidgetWrapper
            title="Organization & Enterprise Operations"
            subtitle="Verified companies, premium subscriptions, active recruiters, and open job vacancies"
            icon={<Building2 className="w-4 h-4" />}
            isLoading={orgAnalyticsQuery.isLoading}
            isFetching={orgAnalyticsQuery.isFetching}
            error={orgAnalyticsQuery.error}
            onRefresh={orgAnalyticsQuery.refetch}
          >
            <OrganizationAnalyticsWidget data={orgAnalyticsQuery.data} isLoading={orgAnalyticsQuery.isLoading} />
          </DashboardWidgetWrapper>
        </div>
      )}

      {/* Tab 4: Security & Audit */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <DashboardWidgetWrapper
            title="System Audit Trail Summary"
            subtitle="Recent administrative actions, role modifications, and operational events"
            icon={<FileText className="w-4 h-4" />}
            isLoading={auditSummaryQuery.isLoading}
            isFetching={auditSummaryQuery.isFetching}
            error={auditSummaryQuery.error}
            onRefresh={auditSummaryQuery.refetch}
          >
            <AuditSummaryWidget data={auditSummaryQuery.data} isLoading={auditSummaryQuery.isLoading} />
          </DashboardWidgetWrapper>

          <DashboardWidgetWrapper
            title="Recent Deployment Metadata"
            subtitle="Environment build details, Git commit hash, and platform release version"
            icon={<Server className="w-4 h-4" />}
            isLoading={deploymentsQuery.isLoading}
            isFetching={deploymentsQuery.isFetching}
            error={deploymentsQuery.error}
            onRefresh={deploymentsQuery.refetch}
          >
            <RecentDeploymentsWidget data={deploymentsQuery.data} isLoading={deploymentsQuery.isLoading} />
          </DashboardWidgetWrapper>
        </div>
      )}

      {/* Section 16: Footer */}
      <PlatformFooterWidget
        platformVersion={deploymentsQuery.data?.currentVersion || 'v2.4.0'}
        environment={deploymentsQuery.data?.environment || 'Production'}
        dbStatus={infraQuery.data?.dbHealthy ? 'Connected & Healthy' : 'Degraded'}
      />
    </div>
  );
}

export function AdminDashboardView() {
  return (
    <DashboardFilterProvider>
      <AdminDashboardContent />
    </DashboardFilterProvider>
  );
}
