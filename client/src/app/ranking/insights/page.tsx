"use client";

import React, { Suspense } from "react";
import { PublicPageShell } from "@/components/ui/public-page-shell";
import { InsightsView } from "./InsightsView";

export default function InsightsPage() {
  return (
    <PublicPageShell
      guestContainerClassName="min-h-screen bg-background text-foreground flex flex-col font-sans select-none pb-12"
      guestMainClassName="max-w-7xl mx-auto w-full px-6 md:px-12 mt-8 flex flex-col gap-6"
    >
      <Suspense fallback={
        <div className="flex flex-col items-center justify-center py-20 bg-surface border border-border/40 rounded-xl">
          <span className="text-muted text-xs font-semibold">Preparing Market Insights...</span>
        </div>
      }>
        <InsightsView />
      </Suspense>
    </PublicPageShell>
  );
}
