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
  const {
    profile = {
      technologies: [],
      skills: {},
      architecture: { patterns: [], explanation: "" },
      engineering_practices: {
        testing: { frameworks: [], has_tests: false, detail: "" },
        observability: { logging_configured: false, metrics_configured: false, detail: "" },
        cicd: { configured: false, providers: [] }
      }
    },
    trust = { classification: "personal_authentic", confidence: 100, rule_flags: [], ai_findings: [], explanation: "" },
    ownership = { user_commit_ratio: 1, total_commits: 1, is_primary_author: true, architectural_ownership_pct: 100, critical_path_ownership_pct: 100, maintenance_duration_months: 1, explanation: "" }
  } = analysis;

  const testObservations = profile.engineering_practices.testing.has_tests
    ? `Testing framework detected: ${profile.engineering_practices.testing.frameworks.join(", ") || "Yes"}. ${profile.engineering_practices.testing.detail}`
    : "Critical lack of testing. No unit tests, integration tests, or mock suites detected in the source code.";

  const docObservations = profile.engineering_practices.observability.detail || "Standard project documentation. Core README files, build guides, and basic instructions are present.";

  const insightBlocks = [
    {
      title: "Code Quality Assessment",
      icon: <Code className="size-4.5 text-primary" />,
      note: ownership.explanation,
      status: ownership.user_commit_ratio >= 0.7 ? "Good" : "Needs Review",
    },
    {
      title: "Architecture Observations",
      icon: <Layers className="size-4.5 text-success" />,
      note: profile.architecture.explanation,
      status: profile.architecture.patterns.length > 0 ? "Strong" : "Standard",
    },
    {
      title: "Security & Validation",
      icon: <Shield className="size-4.5 text-danger" />,
      note: trust.rule_flags.length > 0
        ? `Contains anomalies (${trust.rule_flags.length} flags). Security is impacted by unverified commits and patterns.`
        : "No critical credentials or high-risk authentication breaches detected.",
      status: trust.rule_flags.length > 1 ? "Attention Required" : "Secure",
    },
    {
      title: "Testing Coverage",
      icon: <BadgeAlert className="size-4.5 text-warning" />,
      note: testObservations,
      status: profile.engineering_practices.testing.has_tests ? "Pass" : "Fail",
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
      note: ownership.explanation,
      status: trust.confidence >= 60 ? "Stable" : "Review Recommended",
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
