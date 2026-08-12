'use client';

import React from 'react';
import { Card, Chip } from '@heroui/react';
import { Button } from '@/components/ui/button';
import { ShieldAlert, AlertTriangle, Info, CheckCircle2, X } from 'lucide-react';
import Link from 'next/link';
import { type AlertItem } from '../../services/admin-dashboard.service';

export interface SystemAlertsWidgetProps {
  alerts?: AlertItem[] | null;
  isLoading?: boolean;
  onDismissAlert?: (id: string) => void;
}

export function SystemAlertsWidget({ alerts, isLoading, onDismissAlert }: SystemAlertsWidgetProps) {
  if (isLoading || !alerts) {
    return (
      <div className="space-y-2">
        <div className="h-16 bg-surface-secondary rounded-xl animate-pulse" />
        <div className="h-16 bg-surface-secondary rounded-xl animate-pulse" />
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="p-4 bg-success/10 border border-success/20 rounded-xl flex items-center justify-between text-xs text-success font-medium select-none">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>No critical system alerts or active incidents.</span>
        </div>
        <Chip size="sm" variant="soft" color="success" className="text-[10px] h-4">
          All Clear
        </Chip>
      </div>
    );
  }

  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case 'Critical': return <ShieldAlert className="w-4 h-4 text-danger shrink-0" />;
      case 'Warning': return <AlertTriangle className="w-4 h-4 text-warning shrink-0" />;
      default: return <Info className="w-4 h-4 text-primary shrink-0" />;
    }
  };

  const getAlertBorderColor = (severity: string) => {
    switch (severity) {
      case 'Critical': return 'border-danger/30 bg-danger/5';
      case 'Warning': return 'border-warning/30 bg-warning/5';
      default: return 'border-primary/20 bg-primary/5';
    }
  };

  return (
    <div className="space-y-2.5">
      {alerts.map(alert => (
        <div
          key={alert.id}
          className={`p-3.5 rounded-xl border ${getAlertBorderColor(alert.severity)} transition-all flex items-start justify-between gap-3 select-none`}
        >
          <div className="flex items-start gap-3 min-w-0">
            {getAlertIcon(alert.severity)}
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h5 className="text-xs font-bold text-foreground">{alert.title}</h5>
                <Chip size="sm" variant="soft" color={alert.severity === 'Critical' ? 'danger' : alert.severity === 'Warning' ? 'warning' : 'accent'} className="text-[10px] h-4">
                  {alert.severity}
                </Chip>
              </div>
              <p className="text-xs text-muted leading-relaxed">{alert.message}</p>
              {alert.targetLink && (
                <Link href={alert.targetLink} className="text-xs font-semibold text-accent hover:underline inline-block pt-0.5">
                  View details & resolve →
                </Link>
              )}
            </div>
          </div>

          {onDismissAlert && (
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={() => onDismissAlert(alert.id)}
              className="text-muted hover:text-foreground shrink-0 cursor-pointer -mr-1 -mt-1"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
