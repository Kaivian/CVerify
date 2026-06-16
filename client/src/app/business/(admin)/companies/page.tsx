"use client";

import React from "react";
import { PlaceholderView } from "@/components/ui/placeholder-view";
import { Building2 } from "lucide-react";

export default function AdminCompaniesPage() {
  return (
    <PlaceholderView
      title="Company Directory"
      description="Manage registered companies, organization details, and access control settings."
      icon={Building2}
      section="Company Administration"
      features={[
        {
          title: "Organization Verification",
          description: "Review and approve company onboarding verification claims, business documents, and certificates.",
        },
        {
          title: "Workspace Control",
          description: "Manage global workspaces, transfer ownerships, and archive inactive organizations.",
        },
        {
          title: "Access Policies",
          description: "Configure system access rules, domain verifications, and onboarding settings.",
        },
      ]}
    />
  );
}
