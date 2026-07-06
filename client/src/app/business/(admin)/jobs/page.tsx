"use client";

import React from "react";
import { PlaceholderView } from "@/components/ui/placeholder-view";
import { Briefcase } from "lucide-react";

export default function AdminJobsPage() {
  return (
    <PlaceholderView
      title="Job Moderation"
      description="Monitor public job listings, flag inappropriate content, and enforce compliance policies."
      icon={Briefcase}
      section="Company Administration"
      features={[
        {
          title: "Listing Moderation Queue",
          description: "Review and approve newly created job posts before publishing to the public board.",
        },
        {
          title: "Compliance Reports",
          description: "Investigate candidate complaints, flag misleading advertisements, and suspend listings.",
        },
        {
          title: "Job Tagging & Classification",
          description: "Configure tags, categorization taxonomy, and smart recommendation matching settings.",
        },
      ]}
    />
  );
}
