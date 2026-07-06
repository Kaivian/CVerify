"use client";

import React from "react";
import { PlaceholderView } from "@/components/ui/placeholder-view";
import { Inbox } from "lucide-react";

export default function VerificationQueuePage() {
  return (
    <PlaceholderView
      title="Verification Queue"
      description="Monitor and process candidate background check requests, credential validations, and verification workflows."
      icon={Inbox}
      section="Verification"
      features={[
        {
          title: "Verification Queue Management",
          description: "Review submitted verification requests from candidates, assign verifiers, and track status.",
        },
        {
          title: "Verification Request Details",
          description: "Inspect specific verification claims, uploaded proof documents, and third-party integrations.",
        },
        {
          title: "Provider Integrations",
          description: "Configure verification services such as GitHub, academic institutions, and employer APIs.",
        },
      ]}
    />
  );
}
