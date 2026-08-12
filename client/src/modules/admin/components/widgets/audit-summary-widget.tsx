'use client';

import React from 'react';
import { Card, Chip } from '@heroui/react';
import { Button } from '@/components/ui/button';
import { FileText, Shield, User, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { type AuditSummaryWidget as AuditSummaryData } from '../../services/admin-dashboard.service';

export interface AuditSummaryWidgetProps {
  data?: AuditSummaryData | null;
  isLoading?: boolean;
}

export function AuditSummaryWidget({ data, isLoading }: AuditSummaryWidgetProps) {
  if (isLoading || !data) {
    return (
      <div className="space-y-2 p-4">
        <div className="h-10 bg-surface-secondary rounded-lg animate-pulse" />
        <div className="h-10 bg-surface-secondary rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="flex items-center justify-between text-xs font-mono select-none">
        <span className="text-muted">{data.totalEvents24h} administrative events in past 24 hours</span>
        <Chip size="sm" variant="soft" color="warning" className="text-[10px] h-4">
          {data.securityEventsCount} Security Events
        </Chip>
      </div>

      {/* Logs Table / List */}
      <div className="space-y-2 font-mono text-xs select-none">
        {data.recentLogs.map(log => (
          <div key={log.id} className="p-3 bg-surface border border-separator rounded-xl flex items-center justify-between gap-3">
            <div className="space-y-0.5 truncate font-sans">
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground text-xs">{log.eventType}</span>
                <Chip size="sm" variant="soft" color="default" className="text-[10px] h-4 font-mono">
                  {log.category}
                </Chip>
              </div>
              <p className="text-xs text-muted truncate">{log.description}</p>
            </div>

            <div className="text-right text-[11px] text-muted shrink-0">
              <span className="block font-semibold text-foreground">{log.actorEmail}</span>
              <span>{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end pt-1">
        <Link href="/admin/audit-logs">
          <Button size="sm" variant="flat" color="primary" className="cursor-pointer text-xs">
            View Complete Immutable Audit Trail <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
