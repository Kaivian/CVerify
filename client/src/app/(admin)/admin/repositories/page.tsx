"use client";

import React from "react";
import { PlaceholderView } from "@/components/ui/placeholder-view";
import { GitFork } from "lucide-react";

export default function RepositoryIndexPage() {
  return (
    <PlaceholderView
      title="Repository Index"
      description="Access and index linked GitHub and GitLab code repositories. Review repository vetting requests, trust scores, and sync statuses."
      icon={GitFork}
      section="Verification"
      features={[
        {
          title: "Vetted Repositories",
          description: "Browse repositories linked by candidates and review code authorship verification status.",
        },
        {
          title: "Sync Telemetry",
          description: "Check analysis history, lines-of-code counts, language distributions, and commit authorship audits.",
        },
        {
          title: "Webhooks Audit",
          description: "Configure webhook triggers for Git push events, triggering automatic incremental re-vettings.",
        },
      ]}
    />
  );
}
