"use client";

import React, { Suspense } from "react";
import { InsightsView } from "../../../../ranking/insights/InsightsView";
import { Card } from "@/components/ui/card";
import { Typography, Spinner } from "@heroui/react";
import { BarChart3 } from "lucide-react";

export default function CompanyInsightsPage() {
  return (
    <div className="space-y-6 font-outfit max-w-7xl mx-auto text-foreground p-4">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-surface border border-border text-foreground select-none">
        <div className="space-y-1">
          <Typography type="h2" className="text-2xl font-bold flex items-center gap-2 text-foreground font-outfit">
            <BarChart3 size={24} className="text-accent" />
            Talent Market Insights
          </Typography>
          <Typography type="body-xs" className="text-muted font-medium mt-0.5 font-outfit">
            Ecosystem intelligence, technology adoption trends, and regional talent demand analysis.
          </Typography>
        </div>
      </div>

      <Suspense fallback={
        <Card className="p-12 text-center border border-border bg-surface">
          <Spinner size="lg" className="mx-auto" color="current" />
          <span className="text-muted text-xs mt-3 block font-semibold">Preparing Market Insights...</span>
        </Card>
      }>
        <InsightsView />
      </Suspense>
    </div>
  );
}
