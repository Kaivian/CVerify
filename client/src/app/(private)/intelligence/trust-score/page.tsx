"use client";

import React from "react";
import { ShieldCheck } from "lucide-react";
import { PlaceholderView } from "@/components/ui/placeholder-view";

export default function TrustScorePage() {
  const features = [
    {
      title: "Authorship Proof",
      description: "Evaluation of commits to confirm authentic work and history.",
    },
    {
      title: "Verification Status",
      description: "Audit status of connected third-party providers (GitHub, GitLab, etc.).",
    },
  ];

  return (
    <PlaceholderView
      title="Trust Score"
      section="INTELLIGENCE"
      description="CVerify developer credibility and safety indicator built using code authorship proofs."
      icon={ShieldCheck}
      features={features}
    />
  );
}
