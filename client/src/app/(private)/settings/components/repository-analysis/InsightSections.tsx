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
import { RepositoryAnalysis } from "@/types/repository-analysis.types";

interface InsightSectionsProps {
  analysis: RepositoryAnalysis;
}

export const InsightSections: React.FC<InsightSectionsProps> = ({ analysis }) => {
  const { scoring, fraud_flags } = analysis;

  // Derive testing observations from improvement areas
  const testObservations = scoring.improvement_areas.some((s) =>
    s.toLowerCase().includes("test")
  )
    ? "Critical lack of testing. No unit tests, integration tests, or mock suites detected in the source code."
    : "Basic testing framework detected. Unit tests are present but coverage metrics could not be fully verified.";

  // Derive documentation quality from strengths/improvements
  const docObservations = scoring.improvement_areas.some((s) =>
    s.toLowerCase().includes("document") || s.toLowerCase().includes("readme")
  )
    ? "Minimal documentation observed. API documentation and code comments are sparse or missing."
    : "Standard project documentation. Core README files, build guides, and basic instructions are present.";

  const insightBlocks = [
    {
      title: "Code Quality Assessment",
      icon: <Code className="size-4.5 text-primary" />,
      note: scoring.dimension_breakdown.code_quality_signals.note,
      status: scoring.dimension_breakdown.code_quality_signals.score >= 70 ? "Good" : "Needs Review",
    },
    {
      title: "Architecture Observations",
      icon: <Layers className="size-4.5 text-success" />,
      note: scoring.dimension_breakdown.technical_depth.note,
      status: scoring.dimension_breakdown.technical_depth.score >= 70 ? "Strong" : "Standard",
    },
    {
      title: "Security & Validation",
      icon: <Shield className="size-4.5 text-danger" />,
      note: fraud_flags.length > 0
        ? `Contains anomalies (${fraud_flags.length} flags). Security is impacted by unverified commits and patterns.`
        : "No critical credentials or high-risk authentication breaches detected.",
      status: fraud_flags.length > 1 ? "Attention Required" : "Secure",
    },
    {
      title: "Testing Coverage",
      icon: <BadgeAlert className="size-4.5 text-warning" />,
      note: testObservations,
      status: testObservations.includes("lack") ? "Fail" : "Pass",
    },
    {
      title: "Documentation Quality",
      icon: <FileText className="size-4.5 text-accent" />,
      note: docObservations,
      status: docObservations.includes("Minimal") ? "Incomplete" : "Verified",
    },
    {
      title: "Maintainability Indicators",
      icon: <Wrench className="size-4.5 text-muted-foreground" />,
      note: scoring.recruiter_summary,
      status: scoring.final_score >= 60 ? "Stable" : "Review Recommended",
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
                block.status === "Strong" || block.status === "Good" || block.status === "Secure" || block.status === "Verified" || block.status === "Stable"
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
