'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface ChartSeries {
  name: string;
  data: number[];
  color: string;
  unit?: string;
}

interface ObservabilityChartProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  series: ChartSeries[];
  height?: number;
}

export function ObservabilityChart({
  title,
  subtitle,
  icon: Icon,
  series,
  height = 180,
}: ObservabilityChartProps) {
  const chartWidth = 500;

  return (
    <Card className="p-0 border border-border bg-surface-secondary/50 text-foreground overflow-hidden">
      <div className="flex justify-between items-center px-4 py-3 border-b border-border/60 bg-surface-tertiary/40">
        <div className="flex items-center gap-2">
          {Icon && (
            <div className="p-1.5 rounded-lg bg-surface-tertiary text-accent">
              <Icon className="w-4 h-4" />
            </div>
          )}
          <div>
            <h4 className="text-sm font-semibold text-foreground">{title}</h4>
            {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {series.map((s) => {
            const lastVal = s.data.length > 0 ? s.data[s.data.length - 1] : 0;
            return (
              <div key={s.name} className="flex items-center gap-1.5 text-xs">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{ backgroundColor: s.color }}
                />
                <span className="text-muted">{s.name}:</span>
                <span className="font-mono font-semibold text-foreground">
                  {lastVal} {s.unit || ''}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-4 overflow-hidden">
        <div className="w-full relative" style={{ height }}>
          <svg
            viewBox={`0 0 ${chartWidth} ${height}`}
            className="w-full h-full overflow-visible text-muted"
            preserveAspectRatio="none"
          >
            <defs>
              {series.map((s, idx) => (
                <linearGradient
                  key={s.name}
                  id={`grad-${idx}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={s.color} stopOpacity="0.35" />
                  <stop offset="100%" stopColor={s.color} stopOpacity="0.0" />
                </linearGradient>
              ))}
            </defs>

            {/* Background Grid Lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
              <line
                key={ratio}
                x1="0"
                y1={height * ratio}
                x2={chartWidth}
                y2={height * ratio}
                stroke="currentColor"
                strokeOpacity="0.15"
                strokeDasharray="4 4"
              />
            ))}

            {/* Render Series Areas & Paths */}
            {series.map((s, sIdx) => {
              if (s.data.length < 2) return null;
              const points = s.data;
              const maxVal = Math.max(...points, 10);
              const minVal = 0;
              const range = maxVal - minVal || 1;

              const pathCoords = points.map((val, pIdx) => {
                const x = (pIdx / (points.length - 1)) * chartWidth;
                const y = height - ((val - minVal) / range) * (height - 16) - 8;
                return `${x.toFixed(1)},${y.toFixed(1)}`;
              });

              const lineD = `M ${pathCoords.join(' L ')}`;
              const areaD = `${lineD} L ${chartWidth},${height} L 0,${height} Z`;

              return (
                <g key={s.name}>
                  <path d={areaD} fill={`url(#grad-${sIdx})`} />
                  <path
                    d={lineD}
                    fill="none"
                    stroke={s.color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {points.length > 0 && (
                    <circle
                      cx={(points.length - 1) / (points.length - 1) * chartWidth}
                      cy={
                        height -
                        ((points[points.length - 1] - minVal) / range) * (height - 16) -
                        8
                      }
                      r="4"
                      fill={s.color}
                      className="animate-pulse"
                    />
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </Card>
  );
}
