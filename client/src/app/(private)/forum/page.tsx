"use client";

import React from "react";
import { MessageSquare } from "lucide-react";
import { PlaceholderView } from "@/components/ui/placeholder-view";

export default function ForumPage() {
  const features = [
    {
      title: "Verified Threads",
      description: "Participate in discussion rooms restricted to verified capability levels.",
    },
    {
      title: "Knowledge Base",
      description: "Access documentation, tutorials, and community guides on the trust graph.",
    },
  ];

  return (
    <PlaceholderView
      title="Forum"
      section="GENERAL"
      description="Join technical debates, open-source discussions, and verification-related threads."
      icon={MessageSquare}
      features={features}
    />
  );
}
