'use client';

import React from 'react';
import { Card, Chip } from '@heroui/react';
import { Server, GitCommit, Clock, CheckCircle2 } from 'lucide-react';
import { type RecentDeploymentsWidget as RecentDeploymentsData } from '../../services/admin-dashboard.service';

export interface RecentDeploymentsWidgetProps {
  data?: RecentDeploymentsData | null;
  isLoading?: boolean;
}

export function RecentDeploymentsWidget({ data, isLoading }: RecentDeploymentsWidgetProps) {
  if (isLoading || !data) {
    return (
      <div className="p-4 bg-surface border border-border rounded-2xl animate-pulse space-y-2">
        <div className="h-4 w-1/3 bg-surface-secondary rounded" />
        <div className="h-12 bg-surface-secondary rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-4 bg-surface-secondary/70 border border-border rounded-xl space-y-3 select-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-accent" />
          <span className="text-xs font-bold text-foreground">Current Deployment</span>
        </div>
        <Chip size="sm" variant="soft" color="success" className="text-[10px] font-bold h-4">
          <CheckCircle2 className="w-2.5 h-2.5 inline mr-1" /> {data.deploymentStatus}
        </Chip>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
        <div>
          <span className="text-[10px] text-muted block uppercase font-bold">Release</span>
          <span className="font-bold text-foreground">{data.currentVersion}</span>
        </div>

        <div>
          <span className="text-[10px] text-muted block uppercase font-bold">Git Commit</span>
          <span className="text-accent font-semibold">{data.gitCommitHash}</span>
        </div>

        <div>
          <span className="text-[10px] text-muted block uppercase font-bold">Branch</span>
          <span className="text-foreground">{data.gitBranch}</span>
        </div>

        <div>
          <span className="text-[10px] text-muted block uppercase font-bold">Environment</span>
          <span className="text-foreground">{data.environment}</span>
        </div>
      </div>
    </div>
  );
}
