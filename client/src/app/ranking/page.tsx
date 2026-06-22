"use client";

import React, { Suspense } from "react";
import { PublicPageShell } from "@/components/ui/public-page-shell";
import { RankingView } from "./RankingView";

export default function RankingPage() {
  return (
    <PublicPageShell
      guestContainerClassName="min-h-screen bg-background text-foreground flex flex-col font-sans select-none pb-12"
      guestMainClassName="max-w-7xl mx-auto w-full px-6 md:px-12 mt-8 flex flex-col gap-6"
    >
      <Suspense fallback={
        <div className="flex flex-col items-center justify-center py-20 bg-surface border border-border/40 rounded-xl">
          <div className="animate-pulse flex space-x-4">
            <div className="flex-1 space-y-6 py-1">
              <div className="h-2 bg-slate-700 rounded"></div>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-4">
                  <div className="h-2 bg-slate-700 rounded col-span-2"></div>
                  <div className="h-2 bg-slate-700 rounded col-span-1"></div>
                </div>
                <div className="h-2 bg-slate-700 rounded"></div>
              </div>
            </div>
          </div>
          <span className="text-muted text-xs mt-3 font-semibold">Preparing Leaderboard...</span>
        </div>
      }>
        <RankingView />
      </Suspense>
    </PublicPageShell>
  );
}
