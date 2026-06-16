"use client";

import React from "react";
import { PlaceholderView } from "@/components/ui/placeholder-view";
import { BarChart3 } from "lucide-react";

export default function AdminCompanyAnalyticsPage() {
  return (
    <PlaceholderView
      title="Company Analytics"
      description="Monitor platform engagement, active organization statistics, and recruitment funnel analytics."
      icon={BarChart3}
      section="Company Administration"
      features={[
        {
          title: "Onboarding Funnel Stats",
          description: "Track conversion rates of company verifications and workspace setup workflows.",
        },
        {
          title: "Hiring Funnel Indicators",
          description: "Monitor job application volumes, interview completion ratios, and active hiring pipelines.",
        },
        {
          title: "Engagement Dashboard",
          description: "Visualize platform traffic trends, API utilization metrics, and overall tenant activities.",
        },
      ]}
    />
  );
}
