"use client";

import React from "react";
import { PlaceholderView } from "@/components/ui/placeholder-view";
import { Settings } from "lucide-react";

export default function PortalSettingsPage() {
  return (
    <PlaceholderView
      title="Portal Settings"
      description="Configure global application properties, edit system security thresholds, adjust API rate-limits, and configure notification SMTP servers."
      icon={Settings}
      section="System"
      features={[
        {
          title: "System Properties",
          description: "Adjust platform names, themes, allowed file upload limits, and pagination presets.",
        },
        {
          title: "API Security Thresholds",
          description: "Manage system-wide rate limiting, configure JWT token lifespans, and manage allowed origin CORS configurations.",
        },
        {
          title: "Communications Configuration",
          description: "Configure SMTP mail setups, template layouts, and webhook integration nodes.",
        },
      ]}
    />
  );
}
