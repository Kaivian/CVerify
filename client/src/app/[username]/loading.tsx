import React from 'react';
import { PublicPageShell } from '@/components/ui/public-page-shell';

export default function ProfileLoading() {
  return (
    <PublicPageShell
      guestContainerClassName="relative min-h-screen w-full bg-background text-foreground flex flex-col justify-between overflow-x-hidden antialiased"
      guestBackdrop={<div className="absolute inset-0 bg-[radial-gradient(var(--separator)_1px,transparent_1px)] bg-size-[24px_24px] pointer-events-none opacity-40 animate-pulse" />}
      guestMainClassName="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6"
    >
      {/* Sleek Document Paper Skeleton Container */}
      <div className="w-full bg-surface border border-border rounded-2xl shadow-xs p-6 sm:p-8 flex flex-col gap-8 animate-pulse">
        
        {/* 1. Header Area Skeleton */}
        <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-6 pb-6 border-b border-separator">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 w-full">
            {/* Avatar skeleton */}
            <div className="w-24 h-24 rounded-full bg-default/40 shrink-0" />
            
            {/* Text skeleton */}
            <div className="flex flex-col gap-3 w-full max-w-md">
              <div className="h-8 bg-default/50 rounded-lg w-2/3" />
              <div className="h-4 bg-default/40 rounded w-1/3" />
              <div className="h-4 bg-default/30 rounded w-1/2 mt-1" />
            </div>
          </div>
          
          {/* Badges/Status Block skeleton */}
          <div className="flex gap-2 shrink-0 w-full md:w-auto justify-center md:justify-end">
            <div className="h-6 w-20 bg-default/35 rounded-full" />
            <div className="h-6 w-24 bg-default/35 rounded-full" />
          </div>
        </div>

        {/* 2. Bio Skeleton */}
        <div className="flex flex-col gap-2 pb-6 border-b border-separator">
          <div className="h-4 bg-default/40 rounded w-full" />
          <div className="h-4 bg-default/40 rounded w-11/12" />
          <div className="h-4 bg-default/30 rounded w-2/3" />
        </div>

        {/* 3. Navigation Tabs Skeleton */}
        <div className="flex gap-6 border-b border-border/60 pb-2">
          <div className="h-5 w-36 bg-default/50 rounded" />
          <div className="h-5 w-44 bg-default/30 rounded" />
          <div className="h-5 w-32 bg-default/30 rounded" />
        </div>

        {/* 4. Content Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column (Quick Facts / Stats) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="p-5 border border-border rounded-xl bg-surface-secondary/20 flex flex-col gap-4">
              <div className="h-4 bg-default/50 rounded w-1/2" />
              <div className="flex flex-col gap-3">
                <div className="h-3 bg-default/30 rounded w-full" />
                <div className="h-3 bg-default/30 rounded w-full" />
                <div className="h-3 bg-default/30 rounded w-full" />
              </div>
            </div>
            
            <div className="p-5 border border-border rounded-xl bg-surface-secondary/20 flex flex-col gap-4">
              <div className="h-4 bg-default/50 rounded w-1/3" />
              <div className="flex flex-col gap-2">
                <div className="h-3 bg-default/35 rounded w-full" />
                <div className="h-3 bg-default/35 rounded w-full" />
              </div>
            </div>
          </div>

          {/* Right Column (Overview / Repositories) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {/* Trust score card skeleton */}
            <div className="p-6 border border-border rounded-xl bg-surface-secondary/20 flex flex-col sm:flex-row items-center gap-6 justify-between">
              <div className="flex flex-col gap-3 w-full">
                <div className="h-4 bg-default/50 rounded w-1/4" />
                <div className="h-6 bg-default/45 rounded w-1/2" />
                <div className="h-3 bg-default/30 rounded w-5/6" />
              </div>
              <div className="w-24 h-24 rounded-full bg-default/40 shrink-0" />
            </div>

            {/* Portfolio items skeleton */}
            <div className="flex flex-col gap-4">
              <div className="h-6 bg-default/55 rounded w-1/3" />
              <div className="p-5 border border-border rounded-xl bg-surface-secondary/10 flex flex-col gap-3">
                <div className="h-5 bg-default/45 rounded w-1/4" />
                <div className="h-3 bg-default/30 rounded w-3/4" />
                <div className="h-3 bg-default/25 rounded w-1/2" />
              </div>
              <div className="p-5 border border-border rounded-xl bg-surface-secondary/10 flex flex-col gap-3">
                <div className="h-5 bg-default/45 rounded w-1/3" />
                <div className="h-3 bg-default/30 rounded w-5/6" />
                <div className="h-3 bg-default/25 rounded w-2/3" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicPageShell>
  );
}
