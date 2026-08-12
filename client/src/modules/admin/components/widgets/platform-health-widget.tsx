'use client';

import React from 'react';
import { Card, Chip, Tooltip } from '@heroui/react';
import { Users, Building2, GitBranch, UserCheck, Cpu, Activity, AlertTriangle, Inbox, HardDrive, TrendingUp, TrendingDown, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { type PlatformHealthWidget as PlatformHealthData } from '../../services/admin-dashboard.service';

export interface PlatformHealthWidgetProps {
  data?: PlatformHealthData | null;
  isLoading?: boolean;
}

export function PlatformHealthWidget({ data, isLoading }: PlatformHealthWidgetProps) {
  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <Card key={i} className="p-4 bg-surface border border-border rounded-2xl animate-pulse space-y-2">
            <div className="w-8 h-8 rounded-xl bg-surface-secondary" />
            <div className="h-6 w-1/2 bg-surface-secondary rounded-md" />
            <div className="h-3 w-3/4 bg-surface-secondary rounded-md" />
          </Card>
        ))}
      </div>
    );
  }

  const kpis = [
    {
      title: 'Total Users',
      value: data.totalUsers.toLocaleString(),
      subtitle: `${data.activeUsers24h.toLocaleString()} active today`,
      trend: data.usersTrendVsYesterdayPercent,
      icon: <Users className="w-4 h-4 text-accent" />,
      link: '/admin/users'
    },
    {
      title: 'Organizations',
      value: data.totalOrganizations.toLocaleString(),
      subtitle: 'Registered & Enterprise',
      trend: data.organizationsTrendPercent,
      icon: <Building2 className="w-4 h-4 text-accent" />,
      link: '/admin/enterprise-operations'
    },
    {
      title: 'Repositories',
      value: data.totalRepositories.toLocaleString(),
      subtitle: 'Synchronized & Analyzed',
      trend: data.repositoriesTrendPercent,
      icon: <GitBranch className="w-4 h-4 text-accent" />,
      link: '/admin/ai/repository'
    },
    {
      title: 'Candidate Profiles',
      value: data.totalCandidates.toLocaleString(),
      subtitle: 'Verified Developer Profiles',
      trend: data.candidatesTrendPercent,
      icon: <UserCheck className="w-4 h-4 text-accent" />,
      link: '/admin/ai/cv'
    },
    {
      title: 'AI Jobs Today',
      value: data.aiJobsToday.toLocaleString(),
      subtitle: `${data.runningPipelines} pipelines running`,
      trend: 12.4,
      icon: <Cpu className="w-4 h-4 text-accent" />,
      link: '/admin/ai/job'
    },
    {
      title: 'Running Pipelines',
      value: data.runningPipelines.toLocaleString(),
      subtitle: 'Active background workers',
      trend: 0,
      icon: <Activity className="w-4 h-4 text-success" />,
      link: '/admin/ai/job'
    },
    {
      title: 'Failed Jobs Today',
      value: data.failedJobsToday.toLocaleString(),
      subtitle: `${data.successRatePercent}% success rate`,
      trend: -1.2,
      isWarning: data.failedJobsToday > 0,
      icon: <AlertTriangle className="w-4 h-4 text-danger" />,
      link: '/admin/ai/job'
    },
    {
      title: 'Pending Reviews',
      value: data.pendingReviewsCount.toLocaleString(),
      subtitle: 'Enterprise requests queue',
      trend: 0,
      icon: <Inbox className="w-4 h-4 text-warning" />,
      link: '/admin/enterprise-operations'
    },
    {
      title: 'Storage Usage',
      value: `${data.storageUsageGb} GB`,
      subtitle: `of ${data.storageTotalGb} GB total capacity`,
      trend: 2.1,
      icon: <HardDrive className="w-4 h-4 text-accent" />,
      link: '/admin/system'
    },
    {
      title: 'Platform Health Rate',
      value: `${data.successRatePercent}%`,
      subtitle: 'System SLO compliance',
      trend: 0.1,
      icon: <Activity className="w-4 h-4 text-success" />,
      link: '/admin/system'
    }
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {kpis.map((kpi, idx) => (
        <Link key={idx} href={kpi.link} className="no-underline group">
          <Card className="p-4 bg-surface border border-border hover:border-accent/40 transition-all rounded-2xl shadow-sm space-y-2 cursor-pointer group-hover:shadow-md">
            <div className="flex items-center justify-between select-none">
              <div className="w-8 h-8 rounded-xl bg-surface-secondary flex items-center justify-center">
                {kpi.icon}
              </div>
              {kpi.trend !== 0 && (
                <Chip
                  size="sm"
                  variant="soft"
                  color={kpi.trend > 0 ? 'success' : 'danger'}
                  className="text-[10px] font-bold px-1.5 h-4 border-none"
                >
                  {kpi.trend > 0 ? (
                    <TrendingUp className="w-2.5 h-2.5 inline mr-0.5" />
                  ) : (
                    <TrendingDown className="w-2.5 h-2.5 inline mr-0.5" />
                  )}
                  {Math.abs(kpi.trend)}%
                </Chip>
              )}
            </div>

            <div className="space-y-0.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted block truncate">
                {kpi.title}
              </span>
              <div className="text-xl font-extrabold tracking-tight tabular-nums text-foreground flex items-center justify-between">
                <span>{kpi.value}</span>
                <ChevronRight className="w-3.5 h-3.5 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-[11px] text-muted truncate">{kpi.subtitle}</p>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
