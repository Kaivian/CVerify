'use client';
import { type AiCostDashboardWidget as AiCostData } from '../../services/admin-dashboard.service';

export interface AiCostDashboardWidgetProps {
  data?: AiCostData | null;
  isLoading?: boolean;
}

export function AiCostDashboardWidget({ data, isLoading }: AiCostDashboardWidgetProps) {
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
      {/* 3 Summary Cost Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-surface-secondary rounded-xl space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">Daily Cost</span>
          <div className="text-2xl font-extrabold text-foreground tabular-nums">${data.dailyCostUsd.toFixed(2)}</div>
          <p className="text-[11px] text-muted">Past 24 hours</p>
        </div>

        <div className="p-4 bg-surface-secondary rounded-xl space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">Weekly Cost</span>
          <div className="text-2xl font-extrabold text-foreground tabular-nums">${data.weeklyCostUsd.toFixed(2)}</div>
          <p className="text-[11px] text-muted">Past 7 days</p>
        </div>

        <div className="p-4 bg-surface-secondary rounded-xl space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">Monthly Expenditure</span>
          <div className="text-2xl font-extrabold text-success tabular-nums">${data.monthlyCostUsd.toFixed(2)}</div>
          <p className="text-[11px] text-muted font-mono">{((data.totalTokenConsumption) / 1000000).toFixed(2)}M tokens consumed</p>
        </div>
      </div>

      {/* Breakdown Grids */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Cost by Provider */}
        <div className="p-4 bg-surface border border-separator rounded-xl space-y-3">
          <h5 className="text-xs font-bold text-foreground">Expenditure by Provider</h5>
          <div className="space-y-2">
            {Object.entries(data.providerBreakdownUsd).map(([provider, cost]) => (
              <div key={provider} className="flex justify-between items-center text-xs p-2 rounded-lg bg-surface-secondary">
                <span className="font-medium text-foreground">{provider}</span>
                <span className="font-mono font-bold text-accent">${cost.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cost by Pipeline */}
        <div className="p-4 bg-surface border border-separator rounded-xl space-y-3">
          <h5 className="text-xs font-bold text-foreground">Expenditure by Pipeline</h5>
          <div className="space-y-2">
            {Object.entries(data.pipelineBreakdownUsd).map(([pipeline, cost]) => (
              <div key={pipeline} className="flex justify-between items-center text-xs p-2 rounded-lg bg-surface-secondary">
                <span className="font-medium text-foreground">{pipeline}</span>
                <span className="font-mono font-bold text-foreground">${cost.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
