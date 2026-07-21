'use client';

import React from 'react';
import { Card, Chip } from '@heroui/react';
import { Button } from '@/components/ui/button';
import { Clock, AlertTriangle, ArrowRight, CheckCircle2, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { type PendingTasksWidget as PendingTasksData } from '../../services/admin-dashboard.service';

export interface PendingTasksWidgetProps {
  data?: PendingTasksData | null;
  isLoading?: boolean;
}

export function PendingTasksWidget({ data, isLoading }: PendingTasksWidgetProps) {
  if (isLoading || !data) {
    return (
      <div className="space-y-3 p-4">
        <div className="h-12 bg-surface-secondary rounded-xl animate-pulse" />
        <div className="h-12 bg-surface-secondary rounded-xl animate-pulse" />
      </div>
    );
  }

  const getPriorityColor = (priority: string) => {
    switch (priority.toUpperCase()) {
      case 'CRITICAL':
      case 'HIGH': return 'danger';
      case 'MEDIUM': return 'warning';
      default: return 'accent';
    }
  };

  return (
    <div className="space-y-4">
      {/* Counters Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <div className="p-3 bg-surface-secondary rounded-xl space-y-0.5">
          <span className="text-[11px] font-bold text-muted uppercase">Orgs Awaiting Review</span>
          <div className="text-lg font-extrabold text-foreground tabular-nums">{data.orgsAwaitingApproval}</div>
        </div>
        <div className="p-3 bg-surface-secondary rounded-xl space-y-0.5">
          <span className="text-[11px] font-bold text-muted uppercase">High-Risk Events</span>
          <div className="text-lg font-extrabold text-danger tabular-nums">{data.flaggedHighRiskUsers}</div>
        </div>
        <div className="p-3 bg-surface-secondary rounded-xl space-y-0.5">
          <span className="text-[11px] font-bold text-muted uppercase">AI Jobs To Retry</span>
          <div className="text-lg font-extrabold text-warning tabular-nums">{data.failedAiJobsNeedingRetry}</div>
        </div>
      </div>

      {/* Task Action Items List */}
      <div className="space-y-2">
        {data.items.map(task => (
          <div
            key={task.id}
            className="p-3 bg-surface border border-separator rounded-xl flex items-center justify-between gap-3 hover:border-accent/30 transition-all select-none"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Chip size="sm" variant="soft" color={getPriorityColor(task.priority)} className="text-[10px] h-4 font-bold shrink-0">
                {task.priority}
              </Chip>
              <div className="truncate">
                <h5 className="text-xs font-bold text-foreground truncate">{task.title}</h5>
                <span className="text-[11px] text-muted font-mono">{new Date(task.createdAt).toLocaleString()}</span>
              </div>
            </div>

            <Link href={task.targetUrl} className="shrink-0">
              <Button size="sm" variant="flat" color="primary" className="text-xs cursor-pointer h-7 px-2.5">
                Review <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
