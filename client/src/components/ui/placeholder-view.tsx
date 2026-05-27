"use client";

import React from "react";
import { Typography, Separator, Chip } from "@heroui/react";
import { Card } from "@/components/ui/card";
import { type LucideIcon, Sparkles } from "lucide-react";

interface FeatureItem {
  title: string;
  description: string;
}

interface PlaceholderViewProps {
  title: string;
  description: string;
  icon: LucideIcon;
  section: string;
  features: FeatureItem[];
}

export const PlaceholderView: React.FC<PlaceholderViewProps> = ({
  title,
  description,
  icon: Icon,
  section,
  features,
}) => {
  return (
    <div className="flex flex-col h-full w-full text-left relative overflow-hidden select-none font-sans">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-1">
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-2 mb-1.5">
            <Chip
              size="sm"
              variant="soft"
              className="text-[10px] font-bold bg-accent/10 text-accent uppercase tracking-wider h-5 rounded-md"
            >
              {section}
            </Chip>
            <Chip
              size="sm"
              variant="soft"
              className="text-[10px] font-bold bg-muted/10 text-muted uppercase tracking-wider flex items-center gap-1 h-5 rounded-md"
            >
              <Sparkles size={10} className="inline mr-1" /> Prototype
            </Chip>
          </div>
          <Typography.Heading level={2} className="font-extrabold flex items-center gap-3 text-foreground">
            {Icon && <Icon size={28} className="text-accent shrink-0" />}
            <span>{title}</span>
          </Typography.Heading>
          <Typography type="body-sm" className="text-muted mt-2 max-w-2xl leading-relaxed">
            {description}
          </Typography>
        </div>
      </div>

      <Separator variant="tertiary" className="my-6" />

      {/* Main content area */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 bg-surface text-foreground" glow={true}>
          <Typography type="h4" className="font-bold text-foreground mb-4">
            Module Information
          </Typography>
          <Typography type="body-sm" className="text-muted leading-relaxed mb-6">
            This module is part of the CVerify Talent Intelligence platform's frontend navigation extension. 
            Once backend APIs are available, this view will show dynamic real-time candidate verification feeds, 
            analytics, and trust profiles.
          </Typography>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {features.map((feat, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-border/40 bg-surface-secondary/40 flex flex-col gap-1 text-left"
              >
                <span className="text-xs font-bold text-foreground">{feat.title}</span>
                <span className="text-[11px] text-muted leading-relaxed">{feat.description}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="bg-surface text-foreground h-fit" glow={true}>
          <Typography type="h4" className="font-bold text-foreground mb-4">
            Verification Protocol
          </Typography>
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="size-6 rounded-md bg-success/10 border border-success/20 flex items-center justify-center text-success shrink-0 mt-0.5 text-xs font-bold">
                ✓
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold text-foreground">Active Integration Ready</span>
                <span className="text-[10px] text-muted">Frontend structure matches target schema.</span>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="size-6 rounded-md bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0 mt-0.5 text-xs font-bold">
                i
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold text-foreground">Next phase development</span>
                <span className="text-[10px] text-muted">Backend microservices connection.</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default PlaceholderView;
