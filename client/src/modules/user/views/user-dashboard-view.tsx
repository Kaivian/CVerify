"use client";

import React from 'react';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PermissionGuard } from '@/features/auth/guards/permission-guard';
import { User, ShieldCheck, Plus, Sparkles, PlaneTakeoff, Compass } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Typography } from '@heroui/react';

export function UserDashboardView() {
  const { user } = useAuth();
  const { t } = useTranslation(['dashboard-user', 'common']);

  return (
    <div className="space-y-6 font-outfit">
      {/* Top Banner Message */}
      <div className="dark flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-linear-to-r from-background via-surface to-surface-secondary text-foreground select-none">
        <div className="space-y-1">
          <Typography type="h2" className="text-xl font-bold flex items-center gap-2 text-foreground">
            {t('dashboard-user:banner.welcome', { name: user?.fullName || 'Traveler' })}{' '}
            <Sparkles size={18} className="text-accent fill-accent" />
          </Typography>
          <Typography type="body-xs" className="text-muted font-light mt-0.5">
            {t('dashboard-user:banner.subtitle')}
          </Typography>
        </div>
        <Button variant="solid" className="w-fit self-start shrink-0 cursor-pointer">
          <PlaneTakeoff size={16} />
          {t('dashboard-user:banner.createPrompt')}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Card 1: Traveler Profile card */}
        <Card className="lg:col-span-1" glow={false}>
          <div className="flex items-center gap-3 mb-6 select-none">
            <div className="w-10 h-10 rounded-full bg-surface-secondary flex items-center justify-center text-foreground">
              <User size={20} />
            </div>
            <div>
              <Typography type="h3" className="font-bold text-foreground">
                {t('dashboard-user:profile.title')}
              </Typography>
              <Typography type="body-xs" className="text-muted">
                {t('dashboard-user:profile.subtitle')}
              </Typography>
            </div>
          </div>

          <div className="space-y-3.5 text-sm select-none font-outfit">
            <div>
              <Typography type="body-xs" className="text-muted uppercase font-extrabold tracking-wider block mb-0.5">
                {t('dashboard-user:profile.fullName')}
              </Typography>
              <Typography type="body-sm" className="font-semibold text-foreground">
                {user?.fullName}
              </Typography>
            </div>
            <div>
              <Typography type="body-xs" className="text-muted uppercase font-extrabold tracking-wider block mb-0.5">
                {t('dashboard-user:profile.email')}
              </Typography>
              <Typography type="body-sm" className="font-semibold text-foreground">
                {user?.email}
              </Typography>
            </div>
            <div>
              <Typography type="body-xs" className="text-muted uppercase font-extrabold tracking-wider block mb-0.5">
                {t('dashboard-user:profile.accountId')}
              </Typography>
              <Typography type="body-sm" className="font-mono text-muted text-xs truncate block">
                {user?.id}
              </Typography>
            </div>
            <div>
              <Typography type="body-xs" className="text-muted uppercase font-extrabold tracking-wider block mb-0.5">
                {t('dashboard-user:profile.status')}
              </Typography>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-success/10 text-success border border-success/20 select-none">
                {user?.isEmailVerified ? t('dashboard-user:profile.verified') : t('dashboard-user:profile.pending')}
              </span>
            </div>
          </div>
        </Card>

        {/* Card 2: Security & Permissions Indicator */}
        <Card className="lg:col-span-1" glow={false}>
          <div className="flex items-center gap-3 mb-6 select-none">
            <div className="w-10 h-10 rounded-full bg-surface-secondary flex items-center justify-center text-foreground">
              <ShieldCheck size={20} />
            </div>
            <div>
              <Typography type="h3" className="font-bold text-foreground">
                {t('dashboard-user:security.title')}
              </Typography>
              <Typography type="body-xs" className="text-muted">
                {t('dashboard-user:security.subtitle')}
              </Typography>
            </div>
          </div>

          <div className="space-y-4 select-none">
            <div>
              <Typography type="body-xs" className="text-muted uppercase font-extrabold tracking-wider block mb-1">
                {t('dashboard-user:security.currentRole')}
              </Typography>
              <span className="inline-flex px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-wider bg-surface-secondary text-foreground">
                {user?.role}
              </span>
            </div>

            <div>
              <Typography type="body-xs" className="text-muted uppercase font-extrabold tracking-wider block mb-2">
                {t('dashboard-user:security.grantedAccess')}
              </Typography>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                {user?.permissions.map((perm) => (
                  <span
                    key={perm}
                    className="px-2 py-1 rounded-lg bg-surface-secondary border border-border text-foreground text-xs font-mono font-medium"
                  >
                    {perm}
                  </span>
                ))}
                {user?.role === 'ADMIN' && (
                  <span className="px-2 py-1 rounded-lg bg-accent/10 border border-accent/20 text-accent text-xs font-mono font-semibold">
                    {t('dashboard-user:security.fullPrivilege')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Card 3: Element Level PermissionGating Showcase */}
        <Card className="lg:col-span-1" glow={false}>
          <div className="flex items-center gap-3 mb-6 select-none">
            <div className="w-10 h-10 rounded-full bg-surface-secondary flex items-center justify-center text-foreground">
              <Compass size={20} />
            </div>
            <div>
              <Typography type="h3" className="font-bold text-foreground">
                {t('dashboard-user:sandbox.title')}
              </Typography>
              <Typography type="body-xs" className="text-muted">
                {t('dashboard-user:sandbox.subtitle')}
              </Typography>
            </div>
          </div>

          <div className="space-y-4">
            {/* Feature gated on 'trips:create' */}
            <PermissionGuard
              permission="trips:create"
              fallback={
                <div className="p-4 rounded-xl border border-dashed border-border text-center select-none font-outfit">
                  <Typography type="body-xs" className="text-muted block mb-1 font-bold">
                    {t('dashboard-user:sandbox.gatedComponent')}
                  </Typography>
                  <Typography type="body-xs" className="text-muted/80 leading-normal">
                    {t('dashboard-user:sandbox.gatedComponentDesc')}
                  </Typography>
                </div>
              }
            >
              <div className="p-4 rounded-xl bg-accent/10 border border-accent/20 space-y-3 font-outfit">
                <div className="flex items-center justify-between text-xs select-none">
                  <Typography type="body-xs" className="font-bold text-accent inline-block">{t('dashboard-user:sandbox.creatorEnabled')}</Typography>
                  <span className="text-[10px] bg-accent text-accent-foreground px-1.5 py-0.5 rounded font-extrabold tracking-wider uppercase">Active</span>
                </div>
                <Typography type="body-xs" className="text-foreground/80 leading-relaxed select-none">
                  {t('dashboard-user:sandbox.creatorEnabledDesc')}
                </Typography>
                <Button size="sm" className="w-full gap-1 cursor-pointer">
                  <Plus size={14} />
                  {t('dashboard-user:sandbox.newItinerary')}
                </Button>
              </div>
            </PermissionGuard>

            {/* Feature gated on 'admin:system:view' */}
            <PermissionGuard
              permission="admin:system:view"
              fallback={
                <div className="p-4 rounded-xl border border-dashed border-border text-center select-none font-outfit">
                  <Typography type="body-xs" className="text-muted block mb-1 font-bold">
                    {t('dashboard-user:sandbox.systemControls')}
                  </Typography>
                  <Typography type="body-xs" className="text-muted/80 leading-normal">
                    {t('dashboard-user:sandbox.systemControlsDesc')}
                  </Typography>
                </div>
              }
            >
              <div className="p-4 rounded-xl bg-success/10 border border-success/20 space-y-2 select-none font-outfit">
                <Typography type="body-xs" className="font-bold text-success block">{t('dashboard-user:sandbox.systemUnlocked')}</Typography>
                <Typography type="body-xs" className="text-muted leading-relaxed">
                  {t('dashboard-user:sandbox.systemUnlockedDesc')}
                </Typography>
              </div>
            </PermissionGuard>
          </div>
        </Card>
      </div>
    </div>
  );
}
