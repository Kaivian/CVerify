"use client";

import React from "react";
import { PlaceholderView } from "@/components/ui/placeholder-view";
import { ShieldAlert } from "lucide-react";

export default function SecurityCenterPage() {
  return (
    <PlaceholderView
      title="Security Events"
      description="Monitor and track platform-wide security signals, threat warnings, login logs, and credential health audits."
      icon={ShieldAlert}
      section="Security"
      features={[
        {
          title: "Intrusion Detection",
          description: "Real-time auditing of suspicious login attempts, brute-force anomalies, and geographic velocity alerts.",
        },
        {
          title: "Session Auditing",
          description: "Inspect active administrator and candidate sessions and trigger mass invalidation when needed.",
        },
        {
          title: "Threat Alerts",
          description: "System alerts relating to API token leaks, unauthorized repo linkage attempts, and key rotation notifications.",
        },
      ]}
    />
  );
}
