"use client";

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldAlert, Server, Activity, Users, Lock, Eye } from 'lucide-react';
import { Typography } from '@heroui/react';

export function AdminDashboardView() {
  return (
    <div className="space-y-6 font-outfit">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-background border border-border text-foreground select-none">
        <div className="space-y-1">
          <Typography type="h2" className="text-xl font-bold flex items-center gap-2 text-foreground">
            System Administrator Console{' '}
            <ShieldAlert size={20} className="text-danger animate-pulse" />
          </Typography>
          <Typography type="body-xs" className="text-muted font-light mt-0.5">
            Deploy operational changes, audit logs, and toggle emergency API locks.
          </Typography>
        </div>
        <div className="flex gap-2">
          <Button variant="solid" className="w-fit self-start shrink-0 text-danger bg-danger/10 hover:bg-danger/20 border border-danger/25 cursor-pointer" size="sm">
            <Lock size={14} className="mr-1" />
            Toggle API Lock
          </Button>
        </div>
      </div>

      {/* Admin KPIs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Metric 1: Platform load */}
        <Card glow={false}>
          <div className="flex justify-between items-start mb-4 select-none">
            <div>
              <Typography type="body-xs" className="text-muted uppercase font-extrabold block mb-1 tracking-wider">
                Platform CPU/Memory
              </Typography>
              <Typography type="h2" className="text-3xl font-extrabold tracking-tight tabular-nums text-foreground">
                18.4%
              </Typography>
            </div>
            <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
              <Server size={18} />
            </div>
          </div>
          <Typography type="body-xs" className="text-muted">
            Platform utilization: 4.2 of 16 GB RAM
          </Typography>
        </Card>

        {/* Metric 2: API Request index */}
        <Card glow={false}>
          <div className="flex justify-between items-start mb-4 select-none">
            <div>
              <Typography type="body-xs" className="text-muted uppercase font-extrabold block mb-1 tracking-wider">
                API Response Health
              </Typography>
              <Typography type="h2" className="text-3xl font-extrabold tracking-tight tabular-nums text-foreground">
                99.98%
              </Typography>
            </div>
            <div className="w-10 h-10 rounded-xl bg-success/10 text-success flex items-center justify-center">
              <Activity size={18} />
            </div>
          </div>
          <Typography type="body-xs" className="text-muted">
            Healthy average response latency: 140ms
          </Typography>
        </Card>

        {/* Metric 3: Active user accounts count */}
        <Card glow={false}>
          <div className="flex justify-between items-start mb-4 select-none">
            <div>
              <Typography type="body-xs" className="text-muted uppercase font-extrabold block mb-1 tracking-wider">
                Total User Accounts
              </Typography>
              <Typography type="h2" className="text-3xl font-extrabold tracking-tight tabular-nums text-foreground">
                142,500
              </Typography>
            </div>
            <div className="w-10 h-10 rounded-xl bg-warning/10 text-warning flex items-center justify-center">
              <Users size={18} />
            </div>
          </div>
          <Typography type="body-xs" className="text-muted">
            Total user database records (1,820 active today)
          </Typography>
        </Card>
      </div>

      {/* Live simulated console security log stream */}
      <Card glow={false}>
        <div className="flex justify-between items-center mb-5 select-none">
          <div>
            <Typography type="h3" className="font-bold text-foreground">
              Live Diagnostic Logs
            </Typography>
            <Typography type="body-xs" className="text-muted">
              Realtime monitoring feed of system events and OAuth flows.
            </Typography>
          </div>
          <Button variant="bordered" size="sm" className="cursor-pointer">
            <Eye size={14} className="mr-1" />
            Inspect Audit Trail
          </Button>
        </div>

        <div className="p-4 rounded-xl bg-surface-secondary font-mono text-xs text-foreground space-y-2 max-h-56 overflow-y-auto shadow-inner border border-separator select-none font-medium">
          <div className="flex items-start gap-2.5">
            <span className="text-muted font-semibold">[15:48:10]</span>
            <span className="text-success font-bold">[SUCCESS]</span>
            <span>Cryptographic key rotation completed successfully by admin@cverify.ai</span>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="text-muted font-semibold">[15:44:22]</span>
            <span className="text-danger font-bold">[WARN]</span>
            <span>Brute-force security mitigation triggered on router IP: 192.168.1.42</span>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="text-muted font-semibold">[15:39:15]</span>
            <span className="text-success font-bold">[SUCCESS]</span>
            <span>OAuth Federated sign-in completed for traveler_4892@gmail.com</span>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="text-muted font-semibold">[15:32:04]</span>
            <span className="text-warning font-bold">[INFO]</span>
            <span>Stateless JWT authorization context validated for route prefix.</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
