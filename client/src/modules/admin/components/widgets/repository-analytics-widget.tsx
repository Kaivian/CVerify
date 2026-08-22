'use client';

import React from 'react';
import { Card, ProgressBar, Chip } from '@heroui/react';
import { GitBranch, CheckCircle2, AlertTriangle, Clock, Code2, Layers } from 'lucide-react';
import { type RepositoryAnalyticsWidget as RepositoryAnalyticsData } from '../../services/admin-dashboard.service';

export interface RepositoryAnalyticsWidgetProps {
  data?: RepositoryAnalyticsData | null;
  isLoading?: boolean;
}

export function RepositoryAnalyticsWidget({ data, isLoading }: RepositoryAnalyticsWidgetProps) {
  if (isLoading || !data) {
    return (
      <div className="p-6 bg-surface border border-border rounded-2xl animate-pulse space-y-4">
        <div className="h-6 w-1/3 bg-surface-secondary rounded" />
        <div className="h-32 bg-surface-secondary rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overview Numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-surface-secondary rounded-xl space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">Total Repositories</span>
          <div className="text-lg font-extrabold text-foreground tabular-nums">{data.totalRepositories.toLocaleString()}</div>
          <p className="text-[11px] text-muted">Across all candidate profiles</p>
        </div>

        <div className="p-3.5 bg-surface-secondary rounded-xl space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">Analyzed Repos</span>
          <div className="text-lg font-extrabold text-success tabular-nums">{data.successfullyAnalyzed.toLocaleString()}</div>
          <p className="text-[11px] text-muted">Deep analysis completed</p>
        </div>

        <div className="p-3.5 bg-surface-secondary rounded-xl space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">Failed Analyses</span>
          <div className="text-lg font-extrabold text-danger tabular-nums">{data.failedAnalyses.toLocaleString()}</div>
          <p className="text-[11px] text-muted">Failed parsing / clone</p>
        </div>

        <div className="p-3.5 bg-surface-secondary rounded-xl space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">Avg Duration</span>
          <div className="text-lg font-extrabold text-foreground tabular-nums">{data.avgAnalysisDurationSeconds} s</div>
          <p className="text-[11px] text-muted">AST & AI evaluation speed</p>
        </div>
      </div>

      {/* Language & Framework Distributions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Top Languages */}
        <div className="p-4 bg-surface border border-separator rounded-xl space-y-3">
          <h5 className="text-xs font-bold text-foreground flex items-center justify-between">
            <span className="flex items-center gap-1.5"><Code2 className="w-3.5 h-3.5 text-accent" /> Top Analyzed Languages</span>
            <Chip size="sm" variant="soft" color="accent" className="text-[10px] h-4">Language Distribution</Chip>
          </h5>
          <div className="space-y-2.5">
            {data.topLanguages.length === 0 ? (
              <p className="text-xs text-muted py-2 italic text-center">No language distribution data recorded yet</p>
            ) : (
              data.topLanguages.map((lang, idx) => (
                <div key={lang.name} className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="font-semibold text-foreground">{lang.name}</span>
                    <span className="text-muted">{lang.count} repos ({lang.percentage}%)</span>
                  </div>
                  <ProgressBar value={lang.percentage} size="sm" color={idx === 0 ? 'accent' : 'default'} className="h-1.5" />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Frameworks */}
        <div className="p-4 bg-surface border border-separator rounded-xl space-y-3">
          <h5 className="text-xs font-bold text-foreground flex items-center justify-between">
            <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-accent" /> Framework Popularity</span>
            <Chip size="sm" variant="soft" color="default" className="text-[10px] h-4">Framework Distribution</Chip>
          </h5>
          <div className="space-y-2.5">
            {data.topFrameworks.length === 0 ? (
              <p className="text-xs text-muted py-2 italic text-center">No framework distribution data recorded yet</p>
            ) : (
              data.topFrameworks.map((fw, idx) => (
                <div key={fw.name} className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="font-semibold text-foreground">{fw.name}</span>
                    <span className="text-muted">{fw.count} repos ({fw.percentage}%)</span>
                  </div>
                  <ProgressBar value={fw.percentage} size="sm" color={idx === 0 ? 'success' : 'warning'} className="h-1.5" />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
