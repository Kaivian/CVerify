"use client";

import React from 'react';
import { useParams } from 'next/navigation';
import { useWorkspaceStore } from '@/features/workspace/store/use-workspace-store';
import { CreateWorkspaceModal } from '@/features/workspace/components/create-workspace-modal';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, TrendingUp, HandCoins, Globe, Plus, Settings } from 'lucide-react';
import { Typography, Spinner } from '@heroui/react';
import { TableActionDropdown } from '@/components/ui/table-action-dropdown';

export function BusinessDashboardView() {
  const params = useParams();
  const organizationSlug = typeof params?.organizationSlug === 'string' ? params.organizationSlug : '';

  const fetchWorkspace = useWorkspaceStore((s) => s.fetchWorkspace);
  const workspaceDetails = useWorkspaceStore((s) => s.workspaces[organizationSlug]);
  const isDetailsLoading = useWorkspaceStore((s) => s.loading[organizationSlug]);

  const [isCreateWorkspaceModalOpen, setIsCreateWorkspaceModalOpen] = React.useState(false);

  React.useEffect(() => {
    if (organizationSlug) {
      fetchWorkspace(organizationSlug);
    }
  }, [organizationSlug, fetchWorkspace]);

  const workspaces = workspaceDetails?.workspaces || [];

  if (isDetailsLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto p-4 font-outfit text-foreground select-none">
        <div className="h-10 w-48 bg-separator/50 animate-pulse rounded-lg mb-4" />
        <Card className="p-8 border border-border bg-surface text-center">
          <Spinner size="lg" color="current" />
        </Card>
      </div>
    );
  }

  if (workspaceDetails && workspaces.length === 0) {
    return (
      <div className="space-y-6 font-outfit max-w-xl mx-auto py-20 text-foreground select-none">
        <Card className="p-8 border border-border bg-surface text-center">
          <div className="size-16 rounded-2xl bg-accent/10 flex items-center justify-center border border-accent/20 mx-auto mb-5 text-accent">
            <Building2 size={28} />
          </div>
          <Typography type="h4" className="font-bold text-foreground mb-2">
            Welcome to CVerify
          </Typography>
          <Typography type="body-xs" className="text-muted leading-relaxed mb-6 font-medium">
            To begin posting job listings, screening developers, and using intake tools, you must first create an operational environment.
          </Typography>
          <Button
            onClick={() => setIsCreateWorkspaceModalOpen(true)}
            className="bg-foreground text-background font-semibold rounded-xl px-6 py-2.5 cursor-pointer border-none"
          >
            Create First Workspace
          </Button>

          <CreateWorkspaceModal
            isOpen={isCreateWorkspaceModalOpen}
            onOpenChange={setIsCreateWorkspaceModalOpen}
            organizationSlug={organizationSlug}
            onSuccess={() => {
              fetchWorkspace(organizationSlug);
            }}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-outfit">
      
      {/* Header Banner */}
      <div className="dark flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-background border border-border text-foreground select-none">
        <div className="space-y-1">
          <Typography type="h2" className="text-xl font-bold flex items-center gap-2 text-foreground">
            Partner Console{' '}
            <Building2 size={20} className="text-accent" />
          </Typography>
          <Typography type="body-xs" className="text-muted font-light mt-0.5">
            Monitor your listings, partner revenues, and bookings dynamically.
          </Typography>
        </div>
        <div className="flex gap-2.5">
          <Button variant="solid" className="w-fit self-start bg-accent hover:bg-accent/90 border-none shrink-0 cursor-pointer" size="sm">
            <Plus size={14} />
            Add Listing
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* KPI 1: Active Listings */}
        <Card glow={false}>
          <div className="flex justify-between items-start mb-4 select-none">
            <div>
              <Typography type="body-xs" className="text-muted uppercase font-extrabold block mb-1 tracking-wider">
                Active Listings
              </Typography>
              <Typography type="h2" className="text-3xl font-extrabold tracking-tight tabular-nums text-foreground">
                14
              </Typography>
            </div>
            <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
              <Globe size={18} />
            </div>
          </div>
          <Typography type="body-xs" className="text-muted">
            Active packages and services
          </Typography>
        </Card>

        {/* KPI 2: Bookings index */}
        <Card glow={false}>
          <div className="flex justify-between items-start mb-4 select-none">
            <div>
              <Typography type="body-xs" className="text-muted uppercase font-extrabold block mb-1 tracking-wider">
                Total Bookings
              </Typography>
              <Typography type="h2" className="text-3xl font-extrabold tracking-tight tabular-nums text-foreground">
                2,840
              </Typography>
            </div>
            <div className="w-10 h-10 rounded-xl bg-success/10 text-success flex items-center justify-center">
              <TrendingUp size={18} />
            </div>
          </div>
          <Typography type="body-xs" className="text-muted font-medium">
            Overall completed bookings
          </Typography>
        </Card>

        {/* KPI 3: Commissions rate */}
        <Card glow={false}>
          <div className="flex justify-between items-start mb-4 select-none">
            <div>
              <Typography type="body-xs" className="text-muted uppercase font-extrabold block mb-1 tracking-wider">
                Estimated Revenue
              </Typography>
              <Typography type="h2" className="text-3xl font-extrabold tracking-tight tabular-nums text-foreground">
                $48,250
              </Typography>
            </div>
            <div className="w-10 h-10 rounded-xl bg-warning/10 text-warning flex items-center justify-center">
              <HandCoins size={18} />
            </div>
          </div>
          <Typography type="body-xs" className="text-muted">
            Generated revenue (past 14 days)
          </Typography>
        </Card>
      </div>

      {/* Listing Management Demonstration Layout */}
      <Card glow={false}>
        <div className="flex justify-between items-center mb-6 select-none">
          <div>
            <Typography type="h3" className="font-bold text-foreground">
              Service Offerings
            </Typography>
            <Typography type="body-xs" className="text-muted">
              Manage active packages and pricing configurations
            </Typography>
          </div>
          <Button variant="bordered" size="sm" className="cursor-pointer">
            <Settings size={14} className="mr-1" />
            Listing Settings
          </Button>
        </div>

        <div className="overflow-x-auto w-full select-none">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="border-b border-separator text-muted text-xs font-bold font-outfit uppercase tracking-wider">
                <th className="py-3 px-4">Title</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Price</th>
                <th className="py-3 px-4">Volume</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-separator text-foreground/90 font-medium">
              <tr>
                <td className="py-3 px-4 font-semibold text-foreground">Indochina Beach Retreat</td>
                <td className="py-3 px-4">Hotel Package</td>
                <td className="py-3 px-4 font-mono font-medium">$240/night</td>
                <td className="py-3 px-4">84% Occupancy</td>
                <td className="py-3 px-4 text-right">
                  <TableActionDropdown
                    actions={[
                      {
                        id: 'edit',
                        label: 'Edit',
                        icon: Settings,
                        onSelect: () => console.log('Edit listing Indochina Beach Retreat'),
                      }
                    ]}
                  />
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-foreground">Majestic Sapa trekking bundle</td>
                <td className="py-3 px-4">Itinerary Guide</td>
                <td className="py-3 px-4 font-mono font-medium">$45/person</td>
                <td className="py-3 px-4">120 Bookings</td>
                <td className="py-3 px-4 text-right">
                  <TableActionDropdown
                    actions={[
                      {
                        id: 'edit',
                        label: 'Edit',
                        icon: Settings,
                        onSelect: () => console.log('Edit listing Majestic Sapa trekking bundle'),
                      }
                    ]}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
