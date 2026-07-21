'use client';

import React from 'react';
import { Card, Chip, ProgressBar } from '@heroui/react';
import { Button } from '@/components/ui/button';
import { Sparkles, Cpu, Layers, Activity, AlertTriangle, CheckCircle2, DollarSign, Zap } from 'lucide-react';
import Link from 'next/link';
import { type AiOpsWidget as AiOpsData } from '../../services/admin-dashboard.service';

export interface AiOperationsWidgetProps {
  data?: AiOpsData | null;
  isLoading?: boolean;
}

export function AiOperationsWidget({ data, isLoading }: AiOperationsWidgetProps) {
  if (isLoading || !data) {
    return (
      <div className="p-6 bg-surface border border-border rounded-2xl animate-pulse space-y-4">
        <div className="h-6 w-1/4 bg-surface-secondary rounded" />
        <div className="h-24 w-full bg-surface-secondary rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-surface-secondary rounded-xl space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">AI Queue Length</span>
          <div className="text-xl font-extrabold text-foreground tabular-nums">{data.queueLength} tasks</div>
          <p className="text-[11px] text-muted">{data.activeWorkers} active worker containers</p>
        </div>

        <div className="p-4 bg-surface-secondary rounded-xl space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">Running Jobs</span>
          <div className="text-xl font-extrabold text-foreground tabular-nums">{data.runningJobs} jobs</div>
          <p className="text-[11px] text-muted">{data.completedToday} completed today</p>
        </div>

        <div className="p-4 bg-surface-secondary rounded-xl space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">Average Latency</span>
          <div className="text-xl font-extrabold text-foreground tabular-nums">{data.avgLatencyMs} ms</div>
          <p className="text-[11px] text-muted">Per inference completion</p>
        </div>

        <div className="p-4 bg-surface-secondary rounded-xl space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">AI Cost Today</span>
          <div className="text-xl font-extrabold text-success tabular-nums">${data.estimatedCostTodayUsd.toFixed(2)}</div>
          <p className="text-[11px] text-muted">${data.estimatedCostMonthUsd.toFixed(2)} total this month</p>
        </div>
      </div>

      {/* Model & Provider Distribution Lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        {/* Model Usage Breakdown */}
        <div className="p-4 bg-surface border border-separator rounded-xl space-y-3">
          <h5 className="text-xs font-bold text-foreground flex items-center justify-between">
            <span>Model Distribution</span>
            <span className="text-muted font-normal text-[11px]">Tokens: {((data.totalPromptTokens + data.totalCompletionTokens) / 1000).toFixed(0)}k</span>
          </h5>

          <div className="space-y-2">
            {Object.entries(data.modelDistribution).map(([model, count], idx) => {
              const total = Object.values(data.modelDistribution).reduce((a, b) => a + b, 0);
              const pct = Math.round((count / Math.max(total, 1)) * 100);
              return (
                <div key={model} className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-foreground font-semibold">{model}</span>
                    <span className="text-muted">{count} jobs ({pct}%)</span>
                  </div>
                  <ProgressBar value={pct} size="sm" color={idx === 0 ? 'accent' : 'default'} className="h-1.5" />
                </div>
              );
            })}
          </div>
        </div>

        {/* Provider Distribution Breakdown */}
        <div className="p-4 bg-surface border border-separator rounded-xl space-y-3">
          <h5 className="text-xs font-bold text-foreground flex items-center justify-between">
            <span>Provider Routing Health</span>
            <span className="text-success font-semibold text-[11px]">99.8% Availability</span>
          </h5>

          <div className="space-y-2">
            {Object.entries(data.providerDistribution).map(([provider, count]) => (
              <div key={provider} className="flex items-center justify-between p-2 rounded-lg bg-surface-secondary text-xs">
                <span className="font-medium text-foreground">{provider}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-muted">{count} calls</span>
                  <Chip size="sm" variant="soft" color="success" className="text-[10px] h-4">
                    Active
                  </Chip>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <Link href="/admin/ai/repository">
          <Button size="sm" variant="flat" color="primary" className="cursor-pointer text-xs">
            Open AI Pipeline Monitoring Center
          </Button>
        </Link>
      </div>
    </div>
  );
}
