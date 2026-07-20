'use client';

import React from 'react';
import { Card, Avatar, Chip, Tooltip } from '@heroui/react';
import { Button } from '@/components/ui/button';
import { ShieldAlert, Lock, RefreshCw, Clock, Server, CheckCircle2, UserCheck, Building2, GitBranch, Sparkles } from 'lucide-react';
import Link from 'next/link';

export interface WelcomeHeaderWidgetProps {
  adminName?: string;
  adminEmail?: string;
  avatarUrl?: string;
  environment?: string;
  version?: string;
  deploymentStatus?: string;
  isApiLocked?: boolean;
  onToggleApiLock?: () => void;
  onRefreshAll?: () => void;
  isRefreshing?: boolean;
}

export function WelcomeHeaderWidget({
  adminName = 'System Administrator',
  adminEmail = 'admin@cverify.ai',
  avatarUrl,
  environment = 'Production',
  version = 'v2.4.0',
  deploymentStatus = 'Healthy',
  isApiLocked = false,
  onToggleApiLock,
  onRefreshAll,
  isRefreshing = false
}: WelcomeHeaderWidgetProps) {
  const [serverTime, setServerTime] = React.useState<string>('');

  React.useEffect(() => {
    const updateClock = () => {
      setServerTime(new Date().toUTCString());
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="p-6 bg-surface border border-border rounded-2xl shadow-sm space-y-5 select-none">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Left: Avatar + Greeting */}
        <div className="flex items-center gap-4">
          <Avatar className="w-12 h-12 rounded-full ring-2 ring-accent/30 bg-surface-secondary text-accent font-bold shrink-0">
            {avatarUrl && <Avatar.Image src={avatarUrl} alt={adminName} />}
            <Avatar.Fallback className="font-bold text-xs">
              {adminName ? adminName.substring(0, 2).toUpperCase() : 'AD'}
            </Avatar.Fallback>
          </Avatar>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Welcome back, {adminName}
              </h1>
              <Chip size="sm" variant="soft" color="success" className="text-xs font-semibold">
                <CheckCircle2 className="w-3 h-3 inline mr-1" /> System Operational
              </Chip>
              {isApiLocked && (
                <Chip size="sm" variant="soft" color="danger" className="text-xs font-bold animate-pulse">
                  API Lock Active
                </Chip>
              )}
            </div>
            <p className="text-xs text-muted font-normal flex items-center gap-2 flex-wrap">
              <span>{adminEmail}</span>
              <span>•</span>
              <span className="flex items-center gap-1 font-mono">
                <Clock className="w-3 h-3 text-accent" /> {serverTime || 'UTC Clock'}
              </span>
            </p>
          </div>
        </div>

        {/* Right: Environment Info + Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs bg-surface-secondary px-3 py-2 rounded-xl border border-separator">
            <Server className="w-3.5 h-3.5 text-accent" />
            <span className="text-muted font-medium">Env:</span>
            <span className="font-semibold text-foreground">{environment}</span>
            <span className="text-separator">|</span>
            <span className="font-mono text-muted">{version}</span>
          </div>

          {onRefreshAll && (
            <Tooltip delay={0}>
              <Tooltip.Trigger>
                <Button
                  variant="bordered"
                  size="sm"
                  onPress={onRefreshAll}
                  className="cursor-pointer text-foreground border-border hover:bg-surface-secondary"
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? 'animate-spin text-accent' : ''}`} />
                  Refresh
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content className="bg-surface border border-border p-2 shadow-md rounded-lg text-xs text-foreground">
                Refresh all control center widgets
              </Tooltip.Content>
            </Tooltip>
          )}

          {onToggleApiLock && (
            <Button
              variant={isApiLocked ? 'solid' : 'flat'}
              color={isApiLocked ? 'danger' : 'warning'}
              size="sm"
              onPress={onToggleApiLock}
              className="cursor-pointer font-semibold shadow-sm"
            >
              <Lock className="w-3.5 h-3.5 mr-1.5" />
              {isApiLocked ? 'Release API Lock' : 'Toggle API Lock'}
            </Button>
          )}
        </div>
      </div>

      {/* Quick Action Navigation Bar */}
      <div className="pt-3 border-t border-separator grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
        <Link href="/admin/users" className="no-underline">
          <div className="p-2.5 rounded-xl bg-surface-secondary hover:bg-surface-tertiary transition-colors flex items-center gap-2 cursor-pointer border border-transparent hover:border-border">
            <UserCheck className="w-4 h-4 text-accent" />
            <span className="text-xs font-semibold text-foreground truncate">Manage Users</span>
          </div>
        </Link>
        <Link href="/admin/enterprise-operations" className="no-underline">
          <div className="p-2.5 rounded-xl bg-surface-secondary hover:bg-surface-tertiary transition-colors flex items-center gap-2 cursor-pointer border border-transparent hover:border-border">
            <Building2 className="w-4 h-4 text-accent" />
            <span className="text-xs font-semibold text-foreground truncate">Organizations</span>
          </div>
        </Link>
        <Link href="/admin/ai/repository" className="no-underline">
          <div className="p-2.5 rounded-xl bg-surface-secondary hover:bg-surface-tertiary transition-colors flex items-center gap-2 cursor-pointer border border-transparent hover:border-border">
            <GitBranch className="w-4 h-4 text-accent" />
            <span className="text-xs font-semibold text-foreground truncate">Repo Analysis</span>
          </div>
        </Link>
        <Link href="/admin/ai/cv" className="no-underline">
          <div className="p-2.5 rounded-xl bg-surface-secondary hover:bg-surface-tertiary transition-colors flex items-center gap-2 cursor-pointer border border-transparent hover:border-border">
            <Sparkles className="w-4 h-4 text-accent" />
            <span className="text-xs font-semibold text-foreground truncate">CV Intelligence</span>
          </div>
        </Link>
        <Link href="/admin/system" className="no-underline">
          <div className="p-2.5 rounded-xl bg-surface-secondary hover:bg-surface-tertiary transition-colors flex items-center gap-2 cursor-pointer border border-transparent hover:border-border">
            <Server className="w-4 h-4 text-accent" />
            <span className="text-xs font-semibold text-foreground truncate">AI Telemetry</span>
          </div>
        </Link>
        <Link href="/admin/security" className="no-underline">
          <div className="p-2.5 rounded-xl bg-surface-secondary hover:bg-surface-tertiary transition-colors flex items-center gap-2 cursor-pointer border border-transparent hover:border-border">
            <ShieldAlert className="w-4 h-4 text-danger" />
            <span className="text-xs font-semibold text-foreground truncate">Security Rules</span>
          </div>
        </Link>
      </div>
    </Card>
  );
}
