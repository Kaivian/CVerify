"use client";

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, TrendingUp, HandCoins, Globe, Plus, Settings } from 'lucide-react';
import { Typography } from '@heroui/react';
import { TableActionDropdown } from '@/components/ui/table-action-dropdown';

export function BusinessDashboardView() {
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
