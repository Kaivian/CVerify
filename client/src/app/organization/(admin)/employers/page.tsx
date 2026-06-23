"use client";

import React from "react";
import { PlaceholderView } from "@/components/ui/placeholder-view";
import { Users } from "lucide-react";

export default function AdminEmployersPage() {
  return (
    <PlaceholderView
      title="Employer Directory"
      description="Manage company recruiters, administrators, and general team membership permissions."
      icon={Users}
      section="Company Administration"
      features={[
        {
          title: "Membership Approval",
          description: "Moderate employer invitations, verify business emails, and manage user assignments.",
        },
        {
          title: "Role & Permission Auditing",
          description: "Audit organization-level and workspace-level custom roles and access matrices.",
        },
        {
          title: "Activity Tracking",
          description: "Monitor recruiter actions, job post listings, and candidate interaction logs.",
        },
      ]}
    />
  );
}
