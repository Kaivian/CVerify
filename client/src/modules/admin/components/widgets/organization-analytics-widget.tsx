'use client';

import React from 'react';
import { Card, Chip } from '@heroui/react';
import { Building2, CheckCircle2, Award, Briefcase, Users } from 'lucide-react';
import { type OrganizationAnalyticsWidget as OrganizationAnalyticsData } from '../../services/admin-dashboard.service';

export interface OrganizationAnalyticsWidgetProps {
  data?: OrganizationAnalyticsData | null;
  isLoading?: boolean;
}

export function OrganizationAnalyticsWidget({ data, isLoading }: OrganizationAnalyticsWidgetProps) {
  if (isLoading || !data) {
    return (
      <div className="p-6 bg-surface border border-border rounded-2xl animate-pulse space-y-4">
        <div className="h-6 w-1/3 bg-surface-secondary rounded" />
        <div className="h-24 bg-surface-secondary rounded-xl" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      <div className="p-4 bg-surface border border-border rounded-xl space-y-1">
        <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center mb-2">
          <Building2 className="w-4 h-4" />
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">Total Orgs</span>
        <div className="text-xl font-extrabold text-foreground tabular-nums">{data.totalOrganizations}</div>
        <p className="text-[11px] text-muted">Registered accounts</p>
      </div>

      <div className="p-4 bg-surface border border-border rounded-xl space-y-1">
        <div className="w-8 h-8 rounded-lg bg-success/10 text-success flex items-center justify-center mb-2">
          <CheckCircle2 className="w-4 h-4" />
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">Verified Orgs</span>
        <div className="text-xl font-extrabold text-success tabular-nums">{data.activeOrganizations}</div>
        <p className="text-[11px] text-muted">KYB Verified</p>
      </div>

      <div className="p-4 bg-surface border border-border rounded-xl space-y-1">
        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2">
          <Award className="w-4 h-4" />
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">Premium Tier</span>
        <div className="text-xl font-extrabold text-primary tabular-nums">{data.premiumOrganizations}</div>
        <p className="text-[11px] text-muted">Enterprise subscription</p>
      </div>

      <div className="p-4 bg-surface border border-border rounded-xl space-y-1">
        <div className="w-8 h-8 rounded-lg bg-warning/10 text-warning flex items-center justify-center mb-2">
          <Briefcase className="w-4 h-4" />
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">Open Vacancies</span>
        <div className="text-xl font-extrabold text-foreground tabular-nums">{data.openJobVacancies}</div>
        <p className="text-[11px] text-muted">Active job postings</p>
      </div>

      <div className="p-4 bg-surface border border-border rounded-xl space-y-1">
        <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center mb-2">
          <Users className="w-4 h-4" />
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">Active Recruiters</span>
        <div className="text-xl font-extrabold text-foreground tabular-nums">{data.activeRecruiters}</div>
        <p className="text-[11px] text-muted">Assigned HR members</p>
      </div>
    </div>
  );
}
