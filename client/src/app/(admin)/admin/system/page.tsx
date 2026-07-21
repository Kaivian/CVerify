'use client';

import React from 'react';
import {
  Cpu,
  HardDrive,
  Activity,
  Server,
  Database,
  Zap,
  Sparkles,
  Wifi,
  Layers,
  Radio,
  Clock,
  BarChart3,
} from 'lucide-react';
import { Chip } from '@heroui/react';
import { useObservabilityStream } from '@/features/observability/hooks/use-observability-stream';
import { useObservabilityStore } from '@/features/observability/store/use-observability-store';
import { ObservabilityCard } from '@/features/observability/components/observability-card';
import { ObservabilityChart } from '@/features/observability/components/observability-chart';

export default function SystemOverviewPage() {
  const { isConnected, error } = useObservabilityStream('ALL');
  const metrics = useObservabilityStore((s) => s.metrics);

  const defaultMetric = (name: string, unit: string = '') => ({
    name,
    value: 0,
    unit,
    status: 'normal' as const,
    lastUpdated: new Date().toISOString(),
    trend: [0, 0, 0, 0, 0],
  });

  const defaultStringMetric = (name: string, defaultValue: string = 'Healthy') => ({
    name,
    value: defaultValue,
    unit: '',
    status: 'healthy' as const,
    lastUpdated: new Date().toISOString(),
    trend: [1, 1, 1, 1, 1],
  });

  const server = metrics?.server;
  const app = metrics?.application;
  const ai = metrics?.aiService;
  const db = metrics?.database;
  const cache = metrics?.cache;

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Activity className="w-6 h-6 text-accent" />
            Real-Time System Observability Center
          </h1>
          <p className="text-xs text-muted mt-1">
            Live infrastructure diagnostics, resource metrics, service health probes, and application performance counters.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Chip
            variant="soft"
            color={isConnected ? 'success' : 'danger'}
            className="text-xs px-3 py-1 font-medium"
          >
            {isConnected ? 'LIVE STREAM CONNECTED' : error ? 'STREAM DISCONNECTED' : 'CONNECTING...'}
          </Chip>
        </div>
      </div>

      {/* Live Continuous Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ObservabilityChart
          title="Server Resources (CPU & RAM %)"
          subtitle="Real-time processor & memory utilization"
          icon={Cpu}
          series={[
            {
              name: 'CPU Usage',
              data: server?.cpuUsage.trend || [10, 15, 20, 18, 25, 22, 19],
              color: 'var(--accent, #854e28)',
              unit: '%',
            },
            {
              name: 'RAM Usage',
              data: server?.ramUsage.trend || [40, 42, 41, 43, 42, 44, 43],
              color: 'var(--success, #169c46)',
              unit: '%',
            },
          ]}
        />

        <ObservabilityChart
          title="Application Traffic & AI Jobs"
          subtitle="Active HTTP requests & background pipeline tasks"
          icon={Zap}
          series={[
            {
              name: 'Active Requests',
              data: app?.activeRequests.trend || [1, 3, 2, 4, 3, 5, 2],
              color: 'var(--success, #169c46)',
              unit: 'req',
            },
            {
              name: 'AI Requests / Min',
              data: ai?.requestsPerMinute.trend || [4, 6, 5, 8, 7, 10, 9],
              color: 'var(--warning, #ff9555)',
              unit: 'RPM',
            },
          ]}
        />
      </div>

      {/* Metrics Section: 1. Server Infrastructure */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted flex items-center gap-2">
          <Server className="w-4 h-4 text-accent" />
          Server Infrastructure
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <ObservabilityCard
            title="CPU Usage"
            icon={Cpu}
            metric={server?.cpuUsage || defaultMetric('CPU Usage', '%')}
          />
          <ObservabilityCard
            title="RAM Usage"
            icon={Activity}
            metric={server?.ramUsage || defaultMetric('RAM Usage', '%')}
            subtext={`${server?.ramUsedMb.value || 0} / ${server?.ramTotalMb.value || 0} MB`}
          />
          <ObservabilityCard
            title="Disk Usage"
            icon={HardDrive}
            metric={server?.diskUsage || defaultMetric('Disk Usage', '%')}
            subtext={`${server?.diskUsedGb.value || 0} / ${server?.diskTotalGb.value || 0} GB`}
          />
          <ObservabilityCard
            title="Disk Read / Write"
            icon={HardDrive}
            metric={server?.diskReadKb || defaultMetric('Disk Read', 'KB/s')}
            subtext={`Write: ${server?.diskWriteKb.value || 0} KB/s`}
          />
          <ObservabilityCard
            title="Network Upload"
            icon={Wifi}
            metric={server?.networkUploadKb || defaultMetric('Network Upload', 'KB/s')}
          />
          <ObservabilityCard
            title="Network Download"
            icon={Wifi}
            metric={server?.networkDownloadKb || defaultMetric('Network Download', 'KB/s')}
          />
        </div>
      </div>

      {/* Metrics Section: 2. Application Runtime */}
      <div className="space-y-3 pt-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted flex items-center gap-2">
          <Layers className="w-4 h-4 text-accent" />
          ASP.NET Core Application Runtime
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <ObservabilityCard
            title="ASP.NET Memory"
            icon={Activity}
            metric={app?.aspnetMemoryMb || defaultMetric('ASP.NET Memory', 'MB')}
          />
          <ObservabilityCard
            title="Thread Count"
            icon={Layers}
            metric={app?.threadCount || defaultMetric('Thread Count')}
          />
          <ObservabilityCard
            title="Active Requests"
            icon={Zap}
            metric={app?.activeRequests || defaultMetric('Active Requests')}
          />
          <ObservabilityCard
            title="SignalR Clients"
            icon={Radio}
            metric={app?.connectedSignalRClients || defaultMetric('SignalR Clients')}
          />
        </div>
      </div>

      {/* Metrics Section: 3. AI Service */}
      <div className="space-y-3 pt-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent" />
          Python FastAPI AI Microservice
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <ObservabilityCard
            title="AI Status"
            icon={Sparkles}
            metric={ai?.status || defaultStringMetric('AI Status')}
          />
          <ObservabilityCard
            title="Requests / Min"
            icon={Activity}
            metric={ai?.requestsPerMinute || defaultMetric('Requests / Min', 'RPM')}
          />
          <ObservabilityCard
            title="Avg Response Time"
            icon={Clock}
            metric={ai?.averageResponseTimeMs || defaultMetric('Avg Response Time', 'ms')}
          />
          <ObservabilityCard
            title="Tokens Processed"
            icon={BarChart3}
            metric={ai?.tokensProcessed || defaultMetric('Tokens Processed')}
          />
        </div>
      </div>

      {/* Metrics Section: 4 & 5. Database & Cache */}
      <div className="space-y-3 pt-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted flex items-center gap-2">
          <Database className="w-4 h-4 text-success" />
          Persistence & Cache Infrastructure
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <ObservabilityCard
            title="PostgreSQL Status"
            icon={Database}
            metric={db?.status || defaultStringMetric('PostgreSQL Status')}
          />
          <ObservabilityCard
            title="Active Connections"
            icon={Layers}
            metric={db?.activeConnections || defaultMetric('Active Connections')}
          />
          <ObservabilityCard
            title="Query Latency"
            icon={Clock}
            metric={db?.queryLatencyMs || defaultMetric('Query Latency', 'ms')}
          />
          <ObservabilityCard
            title="Redis Hit Ratio"
            icon={Zap}
            metric={cache?.hitRatioPercent || defaultMetric('Hit Ratio', '%')}
            subtext={`Memory: ${cache?.memoryUsageMb.value || 14.2} MB`}
          />
        </div>
      </div>
    </div>
  );
}
