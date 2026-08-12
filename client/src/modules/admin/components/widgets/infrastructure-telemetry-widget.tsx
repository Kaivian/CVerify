'use client';

import React from 'react';
import { Card, ProgressBar, Chip, Tooltip } from '@heroui/react';
import { Server, Cpu, HardDrive, Network, Database, Zap, Sparkles, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { type InfrastructureWidget as InfrastructureData } from '../../services/admin-dashboard.service';

export interface InfrastructureTelemetryWidgetProps {
  data?: InfrastructureData | null;
  isLoading?: boolean;
}

export function InfrastructureTelemetryWidget({ data, isLoading }: InfrastructureTelemetryWidgetProps) {
  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-4 bg-surface border border-border rounded-2xl animate-pulse space-y-3">
            <div className="h-4 w-1/3 bg-surface-secondary rounded" />
            <div className="h-8 w-full bg-surface-secondary rounded-xl" />
          </Card>
        ))}
      </div>
    );
  }

  const getStatusColor = (percent: number) => {
    if (percent >= 85) return 'danger';
    if (percent >= 70) return 'warning';
    return 'success';
  };

  return (
    <div className="space-y-4">
      {/* 4 Primary Resource Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CPU */}
        <Card className="p-4 bg-surface border border-border rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted">CPU Load</h4>
                <span className="text-lg font-extrabold text-foreground tabular-nums">{data.cpuUsagePercent}%</span>
              </div>
            </div>
            <Chip size="sm" variant="soft" color={getStatusColor(data.cpuUsagePercent)} className="text-[10px] font-bold">
              {data.cpuStatus}
            </Chip>
          </div>
          <ProgressBar value={data.cpuUsagePercent} color={getStatusColor(data.cpuUsagePercent)} size="sm" className="h-1.5" />
          <p className="text-[11px] text-muted">Host CPU allocation index</p>
        </Card>

        {/* RAM */}
        <Card className="p-4 bg-surface border border-border rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                <Server className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted">RAM Usage</h4>
                <span className="text-lg font-extrabold text-foreground tabular-nums">{data.ramUsagePercent}%</span>
              </div>
            </div>
            <span className="text-xs font-mono text-muted tabular-nums">
              {(data.ramUsedMb / 1024).toFixed(1)} / {(data.ramTotalMb / 1024).toFixed(1)} GB
            </span>
          </div>
          <ProgressBar value={data.ramUsagePercent} color={getStatusColor(data.ramUsagePercent)} size="sm" className="h-1.5" />
          <p className="text-[11px] text-muted">Working set RAM memory</p>
        </Card>

        {/* Disk */}
        <Card className="p-4 bg-surface border border-border rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                <HardDrive className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted">Disk Space</h4>
                <span className="text-lg font-extrabold text-foreground tabular-nums">{data.diskUsagePercent}%</span>
              </div>
            </div>
            <span className="text-xs font-mono text-muted tabular-nums">
              {data.diskUsedGb} / {data.diskTotalGb} GB
            </span>
          </div>
          <ProgressBar value={data.diskUsagePercent} color={getStatusColor(data.diskUsagePercent)} size="sm" className="h-1.5" />
          <p className="text-[11px] text-muted">Volume storage utilization</p>
        </Card>

        {/* Network */}
        <Card className="p-4 bg-surface border border-border rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                <Network className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted">Network I/O</h4>
                <span className="text-lg font-extrabold text-foreground tabular-nums">{data.networkUploadKb + data.networkDownloadKb} KB/s</span>
              </div>
            </div>
            <Chip size="sm" variant="soft" color="success" className="text-[10px] font-bold">
              Active
            </Chip>
          </div>
          <div className="flex items-center justify-between text-xs text-muted font-mono pt-1">
            <span>↑ {data.networkUploadKb} KB/s</span>
            <span>↓ {data.networkDownloadKb} KB/s</span>
          </div>
          <p className="text-[11px] text-muted">Network bandwidth throughput</p>
        </Card>
      </div>

      {/* Backend Infrastructure Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Database */}
        <div className="p-4 bg-surface-secondary border border-border rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 text-accent" />
            <div>
              <h5 className="text-xs font-bold text-foreground">PostgreSQL Cluster</h5>
              <p className="text-[11px] text-muted font-mono">{data.dbActiveConnections} connections • {data.dbQueryLatencyMs}ms ping</p>
            </div>
          </div>
          <Chip size="sm" variant="soft" color={data.dbHealthy ? 'success' : 'danger'} className="text-xs font-semibold">
            {data.dbHealthy ? <CheckCircle2 className="w-3 h-3 inline mr-1" /> : <XCircle className="w-3 h-3 inline mr-1" />}
            {data.dbHealthy ? 'Healthy' : 'Degraded'}
          </Chip>
        </div>

        {/* Redis */}
        <div className="p-4 bg-surface-secondary border border-border rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-accent" />
            <div>
              <h5 className="text-xs font-bold text-foreground">Redis Cache & Bus</h5>
              <p className="text-[11px] text-muted font-mono">{data.redisConnectedClients} clients • {data.redisHitRatio}% hit ratio</p>
            </div>
          </div>
          <Chip size="sm" variant="soft" color={data.redisHealthy ? 'success' : 'danger'} className="text-xs font-semibold">
            {data.redisHealthy ? <CheckCircle2 className="w-3 h-3 inline mr-1" /> : <XCircle className="w-3 h-3 inline mr-1" />}
            {data.redisHealthy ? 'Healthy' : 'Offline'}
          </Chip>
        </div>

        {/* AI Service */}
        <div className="p-4 bg-surface-secondary border border-border rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-accent" />
            <div>
              <h5 className="text-xs font-bold text-foreground">FastAPI AI Microservice</h5>
              <p className="text-[11px] text-muted font-mono">Avg latency: {data.aiAvgLatencyMs}ms</p>
            </div>
          </div>
          <Chip size="sm" variant="soft" color={data.aiServiceHealthy ? 'success' : 'danger'} className="text-xs font-semibold">
            {data.aiServiceHealthy ? <CheckCircle2 className="w-3 h-3 inline mr-1" /> : <XCircle className="w-3 h-3 inline mr-1" />}
            {data.aiServiceHealthy ? 'Healthy' : 'Offline'}
          </Chip>
        </div>
      </div>
    </div>
  );
}
