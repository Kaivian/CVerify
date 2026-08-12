'use client';

import React from 'react';
import { Card, Chip } from '@heroui/react';
import { Server, Database, Cpu, Sparkles, Clock, CheckCircle2 } from 'lucide-react';

export interface PlatformFooterWidgetProps {
  platformVersion?: string;
  apiVersion?: string;
  backendVersion?: string;
  aiVersion?: string;
  environment?: string;
  dbStatus?: string;
}

export function PlatformFooterWidget({
  platformVersion = 'v2.4.0',
  apiVersion = 'v1.0.4',
  backendVersion = 'CVerify.Core v8.0',
  aiVersion = 'CVerify.AI v3.2',
  environment = 'Production',
  dbStatus = 'Connected & Healthy'
}: PlatformFooterWidgetProps) {
  return (
    <Card className="p-4 bg-surface border border-border rounded-2xl shadow-sm select-none">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted font-mono">
        {/* Left: Versions */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1 text-foreground font-semibold">
            <Server className="w-3.5 h-3.5 text-accent" /> Platform: {platformVersion}
          </span>
          <span>•</span>
          <span>API: {apiVersion}</span>
          <span>•</span>
          <span>Backend: {backendVersion}</span>
          <span>•</span>
          <span>AI Engine: {aiVersion}</span>
        </div>

        {/* Right: Environment & DB Status */}
        <div className="flex items-center gap-3">
          <Chip size="sm" variant="soft" color="success" className="text-[10px] font-semibold h-5">
            <CheckCircle2 className="w-2.5 h-2.5 inline mr-1" /> DB: {dbStatus}
          </Chip>
          <span className="px-2.5 py-0.5 rounded-full bg-surface-secondary text-foreground font-semibold text-[11px]">
            {environment}
          </span>
        </div>
      </div>
    </Card>
  );
}
