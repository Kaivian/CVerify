'use client';

import React from 'react';
import { Card, ProgressBar, Chip } from '@heroui/react';
import { FileText, CheckCircle2, AlertTriangle, Clock, Sparkles } from 'lucide-react';
import { type CvAnalyticsWidget as CvAnalyticsData } from '../../services/admin-dashboard.service';

export interface CvAnalyticsWidgetProps {
  data?: CvAnalyticsData | null;
  isLoading?: boolean;
}

export function CvAnalyticsWidget({ data, isLoading }: CvAnalyticsWidgetProps) {
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
      {/* Overview Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-surface-secondary rounded-xl space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">Total Uploaded CVs</span>
          <div className="text-lg font-extrabold text-foreground tabular-nums">{data.totalCvDocuments.toLocaleString()}</div>
          <p className="text-[11px] text-muted">PDF / Word documents</p>
        </div>

        <div className="p-3.5 bg-surface-secondary rounded-xl space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">Parsed & Analyzed</span>
          <div className="text-lg font-extrabold text-success tabular-nums">{data.completedAnalyses.toLocaleString()}</div>
          <p className="text-[11px] text-muted">Extracted skill profiles</p>
        </div>

        <div className="p-3.5 bg-surface-secondary rounded-xl space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">Pending In Queue</span>
          <div className="text-lg font-extrabold text-warning tabular-nums">{data.pendingAnalyses.toLocaleString()}</div>
          <p className="text-[11px] text-muted">Awaiting LLM parsing</p>
        </div>

        <div className="p-3.5 bg-surface-secondary rounded-xl space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">Avg Processing Time</span>
          <div className="text-lg font-extrabold text-foreground tabular-nums">{data.avgProcessingTimeSeconds} s</div>
          <p className="text-[11px] text-muted">OCR & entity extraction</p>
        </div>
      </div>

      {/* Skill Distribution */}
      <div className="p-4 bg-surface border border-separator rounded-xl space-y-3">
        <h5 className="text-xs font-bold text-foreground flex items-center justify-between">
          <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-accent" /> Candidate Skill Domain Breakdown</span>
          <Chip size="sm" variant="soft" color="success" className="text-[10px] h-4">Extracted Domains</Chip>
        </h5>

        {data.skillDistribution.length === 0 ? (
          <p className="text-xs text-muted py-3 italic text-center">No skill distribution data recorded yet</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.skillDistribution.map((skill, idx) => (
              <div key={skill.name} className="p-3 rounded-lg bg-surface-secondary space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="font-semibold text-foreground">{skill.name}</span>
                  <span className="text-muted">{skill.count} profiles ({skill.percentage}%)</span>
                </div>
                <ProgressBar value={skill.percentage} size="sm" color={idx === 0 ? 'accent' : 'success'} className="h-1.5" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
