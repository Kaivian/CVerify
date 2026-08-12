'use client';

import React from 'react';
import { Card } from '@heroui/react';
import { Users, Shield, Inbox, GitFork, FileText, Briefcase, Activity, Monitor, Server, Sparkles, Settings, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export function AdministrativeShortcutsWidget() {
  const shortcuts = [
    { title: 'User Management', subtitle: 'Manage accounts & statuses', href: '/admin/users', icon: <Users className="w-4 h-4 text-accent" /> },
    { title: 'Roles & Matrix', subtitle: 'RBAC policies & permissions', href: '/admin/roles', icon: <Shield className="w-4 h-4 text-accent" /> },
    { title: 'Enterprise Operations', subtitle: 'Org verifications & queue', href: '/admin/enterprise-operations', icon: <Inbox className="w-4 h-4 text-accent" /> },
    { title: 'Repository AI', subtitle: 'Code analysis & AST jobs', href: '/admin/ai/repository', icon: <GitFork className="w-4 h-4 text-accent" /> },
    { title: 'CV Intelligence', subtitle: 'Parsing & talent profiles', href: '/admin/ai/cv', icon: <FileText className="w-4 h-4 text-accent" /> },
    { title: 'Job Intelligence', subtitle: 'Requirement blueprints', href: '/admin/ai/job', icon: <Briefcase className="w-4 h-4 text-accent" /> },
    { title: 'Audit Trail', subtitle: 'Immutable administrative logs', href: '/admin/audit-logs', icon: <FileText className="w-4 h-4 text-accent" /> },
    { title: 'Security Center', subtitle: 'Real-time threat mitigation', href: '/admin/security', icon: <Activity className="w-4 h-4 text-danger" /> },
    { title: 'Frontend Observability', subtitle: 'Client-side logs & traces', href: '/admin/observability/frontend-logs', icon: <Monitor className="w-4 h-4 text-accent" /> },
    { title: 'Backend Observability', subtitle: 'API server diagnostics', href: '/admin/observability/backend-logs', icon: <Server className="w-4 h-4 text-accent" /> },
    { title: 'AI Logs & Pipelines', subtitle: 'Microservice execution stream', href: '/admin/observability/ai-logs', icon: <Sparkles className="w-4 h-4 text-accent" /> },
    { title: 'System Overview', subtitle: 'Telemetry & infrastructure', href: '/admin/system', icon: <Settings className="w-4 h-4 text-accent" /> },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 select-none">
      {shortcuts.map((sc) => (
        <Link key={sc.title} href={sc.href} className="no-underline group">
          <div className="p-3.5 bg-surface border border-border hover:border-accent/40 rounded-xl transition-all flex items-center justify-between cursor-pointer group-hover:bg-surface-secondary">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-lg bg-surface-secondary group-hover:bg-surface transition-colors shrink-0">
                {sc.icon}
              </div>
              <div className="truncate">
                <h5 className="text-xs font-bold text-foreground truncate group-hover:text-accent transition-colors">{sc.title}</h5>
                <p className="text-[11px] text-muted truncate">{sc.subtitle}</p>
              </div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1" />
          </div>
        </Link>
      ))}
    </div>
  );
}
