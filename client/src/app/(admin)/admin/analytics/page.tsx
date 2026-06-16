"use client";

import React from "react";
import { PlaceholderView } from "@/components/ui/placeholder-view";
import { BarChart3 } from "lucide-react";

export default function AnalyticsPage() {
  return (
    <PlaceholderView
      title="Analytics Dashboard"
      description="View real-time candidate verification telemetry, verification volume trends, trust score distributions, and provider performance metrics."
      icon={BarChart3}
      section="Analytics"
      features={[
        {
          title: "Telemetry & Usage",
          description: "Daily and monthly verification metrics, registration growth charts, and assessment activity.",
        },
        {
          title: "Trust Analytics",
          description: "Aggregated candidate trust score metrics, domain trust analytics, and outlier detections.",
        },
        {
          title: "Performance Reports",
          description: "Assess API latency from verification providers and integration sync runtimes.",
        },
      ]}
    />
  );
}
