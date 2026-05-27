"use client";

import React from "react";
import { Orbit } from "lucide-react";
import { PlaceholderView } from "@/components/ui/placeholder-view";

export default function CapabilityGraphPage() {
  const features = [
    {
      title: "Skill Clustering",
      description: "AI-driven grouping of development proficiencies based on actual commits.",
    },
    {
      title: "Contribution Density",
      description: "Visual heatmap showcasing development activity across verified repositories.",
    },
  ];

  return (
    <PlaceholderView
      title="Capability Graph"
      section="INTELLIGENCE"
      description="Visual network of verified programming capabilities, repository contributions, and developer signals."
      icon={Orbit}
      features={features}
    />
  );
}
