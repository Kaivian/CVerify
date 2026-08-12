'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { MetricItem } from '@/types/observability.types';

interface ObservabilityCardProps<T = number | string> {
  title: string;
  icon: LucideIcon;
  metric: MetricItem<T>;
  subtext?: string;
}

export function ObservabilityCard<T = number | string>({
  title,
  icon: Icon,
  metric,
  subtext,
}: ObservabilityCardProps<T>) {
  const statusBadge = React.useMemo(() => {
    switch (metric.status) {
      case 'healthy':
      case 'normal':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-success/15 text-success border border-success/30 capitalize">{metric.status}</span>;
      case 'warning':
      case 'degraded':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-warning/15 text-warning border border-warning/30 capitalize">{metric.status}</span>;
      case 'critical':
      case 'offline':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-danger/15 text-danger border border-danger/30 capitalize">{metric.status}</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface-tertiary text-muted border border-border capitalize">{metric.status}</span>;
    }
  }, [metric.status]);

  // Generate SVG Sparkline path
  const sparklinePath = React.useMemo(() => {
    if (!metric.trend || metric.trend.length < 2) return '';
    const points = metric.trend;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;

    const width = 80;
    const height = 24;

    const coords = points.map((val, idx) => {
      const x = (idx / (points.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return `M ${coords.join(' L ')}`;
  }, [metric.trend]);

  const formattedTime = React.useMemo(() => {
    if (!metric.lastUpdated) return 'Just now';
    // eslint-disable-next-line react-hooks/purity
    const diffSec = Math.floor((Date.now() - new Date(metric.lastUpdated).getTime()) / 1000);
    if (diffSec < 2) return 'Updated just now';
    if (diffSec < 60) return `Updated ${diffSec} sec ago`;
    return `Updated ${Math.floor(diffSec / 60)} min ago`;
  }, [metric.lastUpdated]);

  return (
    <Card className="p-4 gap-3 bg-surface-secondary/40 border-border hover:border-accent/40 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted">
          <div className="p-1.5 rounded-lg bg-surface-tertiary text-accent">
            <Icon className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">
            {title}
          </span>
        </div>

        {statusBadge}
      </div>

      <div className="flex items-baseline justify-between mt-1">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold tracking-tight text-foreground font-mono">
            {typeof metric.value === 'number' ? metric.value.toLocaleString() : String(metric.value)}
          </span>
          {metric.unit && (
            <span className="text-xs font-medium text-muted">{metric.unit}</span>
          )}
        </div>

        {sparklinePath && (
          <div className="w-20 h-6 flex items-center justify-end">
            <svg width="80" height="24" className="overflow-visible">
              <path
                d={sparklinePath}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={
                  metric.status === 'critical' || metric.status === 'offline'
                    ? 'text-danger'
                    : metric.status === 'warning' || metric.status === 'degraded'
                    ? 'text-warning'
                    : 'text-success'
                }
              />
            </svg>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted pt-2 border-t border-border/50">
        <span>{subtext || formattedTime}</span>
        {metric.trend && metric.trend.length > 0 && (
          <span className="font-mono text-[10px] text-muted">
            Range: {Math.min(...metric.trend)} - {Math.max(...metric.trend)}
          </span>
        )}
      </div>
    </Card>
  );
}
