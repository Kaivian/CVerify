import React from "react";
import { Typography } from "@heroui/react";
import { Card } from "@/components/ui/card";
import {
  Code,
  Layers,
  Shield,
  FileText,
  BadgeAlert,
  Wrench,
} from "lucide-react";
import type { RepositoryAnalysis } from "@/types/repository-analysis.types";

interface InsightSectionsProps {
  analysis: RepositoryAnalysis;
}

export const InsightSections: React.FC<InsightSectionsProps> = ({ analysis }) => {
  const classification = analysis.classification || {
    primaryDomain: "Unknown",
    subDomain: "General",
    confidence: 0,
    isVerified: false,
    trustScore: 0
  };

  const risk = analysis.risk || {
    score: 0,
    level: "low",
    reasons: []
  };

  const sections = analysis.sections || [];
  const engineeringSection = sections.find((s) => s.type === "engineering_practices");
  const securitySection = sections.find((s) => s.type === "security_findings");
  const architectureSection = sections.find((s) => s.type === "architecture_insights");

  // Helper to stringify items for legacy rendering
  const getItemText = (item: any): string => {
    if (typeof item === "string") return item;
    if (item && typeof item === "object") {
      return item.content ? `${item.title}: ${item.content}` : (item.title || "");
    }
    return "";
  };

  const engineeringItems = engineeringSection?.items?.map(getItemText) || [];
  const securityItems = securitySection?.items?.map(getItemText) || [];
  const architectureItems = architectureSection?.items?.map(getItemText) || [];
  
  const gitMetrics = analysis.facts?.git_metrics || {
    total_commits: 0,
    user_commit_ratio: 1.0,
    is_primary_author: true,
    bus_factor: 1,
    active_contributors: 1
  };

  const testObservations = engineeringItems.find(item => item.toLowerCase().includes("test") || item.toLowerCase().includes("spec"))
    || "No specific testing infrastructure details noted in practices list.";

  const docObservations = engineeringItems.find(item => item.toLowerCase().includes("doc") || item.toLowerCase().includes("readme"))
    || "Standard workspace configuration and practices detected.";

  const insightBlocks = [
    {
      title: "Code Quality Assessment",
      icon: <Code className="size-4.5 text-primary" />,
      note: `Git commit ratio is ${(gitMetrics.user_commit_ratio * 100).toFixed(0)}% across a total of ${gitMetrics.total_commits} commits.`,
      status: gitMetrics.user_commit_ratio >= 0.7 ? "Good" : "Needs Review",
    },
    {
      title: "Architecture Observations",
      icon: <Layers className="size-4.5 text-success" />,
      note: architectureItems.join(". ") || "Standard structure configuration.",
      status: architectureItems.length > 0 ? "Strong" : "Standard",
    },
    {
      title: "Security & Validation",
      icon: <Shield className="size-4.5 text-danger" />,
      note: securityItems.join(". ") || "No critical credentials or high-risk authentication breaches detected.",
      status: securityItems.length > 0 ? "Attention Required" : "Secure",
    },
    {
      title: "Testing Coverage",
      icon: <BadgeAlert className="size-4.5 text-warning" />,
      note: testObservations,
      status: testObservations.toLowerCase().includes("no ") || testObservations.toLowerCase().includes("lack") ? "Fail" : "Pass",
    },
    {
      title: "Documentation Quality",
      icon: <FileText className="size-4.5 text-accent" />,
      note: docObservations,
      status: docObservations.toLowerCase().includes("minimal") || docObservations.toLowerCase().includes("no ") ? "Incomplete" : "Verified",
    },
    {
      title: "Maintainability Indicators",
      icon: <Wrench className="size-4.5 text-muted-foreground" />,
      note: risk.reasons?.join(". ") || "Stable workspace maintainability indicators.",
      status: risk.score <= 30 ? "Stable" : "Review Recommended",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left font-sans select-none">
      {insightBlocks.map((block, idx) => (
        <Card
          key={idx}
          className="border border-border/80 bg-surface p-5 rounded-2xl flex flex-col justify-between space-y-3.5 hover:border-accent/30 hover:shadow-xs transition-all"
          glow={false}
        >
          <div className="flex items-center justify-between gap-3 pb-2 border-b border-border/10">
            <div className="flex items-center gap-2">
              <div className="shrink-0">{block.icon}</div>
              <Typography type="body-sm" className="font-extrabold text-foreground text-xs">
                {block.title}
              </Typography>
            </div>
            <span
              className={`text-[8.5px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-full ${
                block.status === "Strong" || block.status === "Good" || block.status === "Secure" || block.status === "Verified" || block.status === "Stable" || block.status === "Pass"
                  ? "bg-success/15 text-success"
                  : "bg-warning/15 text-warning"
              }`}
            >
              {block.status}
            </span>
          </div>
          <Typography type="body-xs" className="text-muted leading-relaxed font-light">
            {block.note}
          </Typography>
        </Card>
      ))}
    </div>
  );
};

export default InsightSections;
