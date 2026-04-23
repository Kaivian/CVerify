import React from "react";
import { Chip, Typography, Accordion } from "@heroui/react";
import { Card } from "@/components/ui/card";
import {
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  Percent,
  GitCommit,
  AlertTriangle,
  Fingerprint,
  Sparkles,
} from "lucide-react";
import type { RepositoryAnalysis } from "@/types/repository-analysis.types";
import { parseAndSanitizeMarkdown } from "@/lib/markdown";

interface VerificationSignalsProps {
  analysis: RepositoryAnalysis;
}

export const VerificationSignals: React.FC<VerificationSignalsProps> = ({
  analysis,
}) => {
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

  const gitMetrics = analysis.facts?.git_metrics || {
    total_commits: 0,
    user_commit_ratio: 1.0,
    is_primary_author: true,
    bus_factor: 1,
    active_contributors: 1
  };

  const narrative = analysis.narrative || { recruiter_summary: "", top_strengths: [], limitations: [] };

  const getClassificationBadge = (repoType?: string) => {
    if (!repoType) return null;
    switch (repoType) {
      case "ORIGINAL_WORK":
        return <Chip size="sm" color="success" variant="soft" className="h-5 px-2 text-[8px] font-extrabold uppercase tracking-wider">Original Work</Chip>;
      case "FORK_NO_CONTRIBUTION":
        return <Chip size="sm" color="default" variant="soft" className="h-5 px-2 text-[8px] font-extrabold uppercase tracking-wider">Ecosystem Familiarity</Chip>;
      case "FORK_UPSTREAM_CONTRIBUTION":
        return <Chip size="sm" color="success" variant="soft" className="h-5 px-2 text-[8px] font-extrabold uppercase tracking-wider">Open Source Contributor</Chip>;
      case "POSSIBLE_CLONE":
        return <Chip size="sm" color="danger" variant="soft" className="h-5 px-2 text-[8px] font-extrabold uppercase tracking-wider">⚠ Suspicious Clone</Chip>;
      case "ORG_PUBLIC":
        return <Chip size="sm" color="accent" variant="soft" className="h-5 px-2 text-[8px] font-extrabold uppercase tracking-wider">Org Public</Chip>;
      case "ORG_PRIVATE_SELF_DECLARE":
        return <Chip size="sm" color="warning" variant="soft" className="h-5 px-2 text-[8px] font-extrabold uppercase tracking-wider">Self-Declared</Chip>;
      default:
        return null;
    }
  };

  const totalFlagsCount = risk.reasons.length;

  return (
    <div className="space-y-6 text-left font-sans select-none">
      {/* Top Banner: Verification Verdict */}
      <div
        className={`flex items-start gap-4 p-5 rounded-2xl border ${totalFlagsCount > 0
          ? "bg-warning/5 border-warning/20 text-warning"
          : "bg-success/5 border-success/20 text-success"
          }`}
      >
        <div className="p-2 rounded-xl bg-background border border-current/10 shrink-0">
          {totalFlagsCount > 0 ? (
            <ShieldAlert className="size-6 text-warning" />
          ) : (
            <ShieldCheck className="size-6 text-success" />
          )}
        </div>
        <div className="space-y-1 flex-1">
          <Typography type="body-sm" className="font-extrabold uppercase tracking-wider text-[10px] text-muted">
            Verification Verdict
          </Typography>
          <div className="flex flex-wrap items-center gap-2">
            <Typography type="body-sm" className="font-extrabold text-foreground text-sm capitalize">
              {classification.primaryDomain.replace(/_/g, " ")}
            </Typography>
            {getClassificationBadge(analysis.repo.repo_type)}
          </div>
          <Accordion className="w-full mt-2" variant="surface">
            <Accordion.Item key="ai-summary" id="ai-summary" aria-label="AI Summary">
              <Accordion.Heading>
                <Accordion.Trigger className="text-[10.5px] font-bold text-foreground flex items-center justify-between w-full py-1.5 px-1 cursor-pointer select-none">
                  <span className="flex items-center gap-2">
                    <Sparkles className="size-3.5 text-accent shrink-0" />
                    AI Detailed Report
                  </span>
                  <Accordion.Indicator />
                </Accordion.Trigger>
              </Accordion.Heading>
              <Accordion.Panel>
                <Accordion.Body className="text-xs text-muted-foreground leading-relaxed pl-5.5 font-light pt-2 pb-3 select-text markdown-summary">
                  <div dangerouslySetInnerHTML={{ __html: parseAndSanitizeMarkdown(narrative?.recruiter_summary || (risk.reasons.length > 0 ? risk.reasons.join(". ") : "No anomalies detected.")) }} />
                </Accordion.Body>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </div>
      </div>

      {/* Grid of Trust Signals */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Ownership Verification */}
        <div className="p-4 rounded-xl border border-border bg-surface flex flex-col justify-between h-28">
          <div className="flex items-center justify-between text-muted">
            <Typography type="body-xs" className="font-bold text-[9px] uppercase tracking-wider">
              Ownership Model
            </Typography>
            <UserCheck className="size-4 text-accent" />
          </div>
          <div className="mt-2 text-left">
            <Typography className="text-sm font-extrabold text-foreground capitalize">
              {gitMetrics.is_primary_author ? "Primary Author" : "Collaborator"}
            </Typography>
            <span className="text-[10px] text-muted block mt-0.5">
              Bus Factor: <strong>{gitMetrics.bus_factor}</strong>
            </span>
          </div>
        </div>

        {/* Contribution Authenticity */}
        <div className="p-4 rounded-xl border border-border bg-surface flex flex-col justify-between h-28">
          <div className="flex items-center justify-between text-muted">
            <Typography type="body-xs" className="font-bold text-[9px] uppercase tracking-wider">
              Contribution Share
            </Typography>
            <Percent className="size-4 text-accent" />
          </div>
          <div className="mt-2 text-left">
            <Typography className="text-sm font-extrabold text-foreground">
              {(gitMetrics.user_commit_ratio * 100).toFixed(0)}% User Commits
            </Typography>
            <span className="text-[10px] text-muted block mt-0.5">
              Active Contributors: <strong>{gitMetrics.active_contributors}</strong>
            </span>
          </div>
        </div>

        {/* Commit Density */}
        <div className="p-4 rounded-xl border border-border bg-surface flex flex-col justify-between h-28">
          <div className="flex items-center justify-between text-muted">
            <Typography type="body-xs" className="font-bold text-[9px] uppercase tracking-wider">
              Commit Density
            </Typography>
            <GitCommit className="size-4 text-accent" />
          </div>
          <div className="mt-2 text-left">
            <Typography className="text-sm font-extrabold text-foreground">
              {gitMetrics.total_commits} Total Commits
            </Typography>
            <span className="text-[10px] text-muted block mt-0.5">
              Author Ratio: <strong>{(gitMetrics.user_commit_ratio * 100).toFixed(1)}%</strong>
            </span>
          </div>
        </div>

        {/* Identity Confidence */}
        <div className="p-4 rounded-xl border border-border bg-surface flex flex-col justify-between h-28">
          <div className="flex items-center justify-between text-muted">
            <Typography type="body-xs" className="font-bold text-[9px] uppercase tracking-wider">
              Trust Level
            </Typography>
            <Fingerprint className="size-4 text-accent" />
          </div>
          <div className="mt-2 text-left">
            <Typography className="text-sm font-extrabold text-foreground">
              {Math.round(classification.confidence * 100)}% Confidence
            </Typography>
            <span className="text-[10px] text-muted block mt-0.5">
              Status: <strong>{classification.isVerified ? "Verified Profile" : "Unverified"}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Fraud Indicators List */}
      <Card className="p-5 border border-border/80 bg-surface rounded-2xl" glow={false}>
        <div className="flex items-center gap-2 mb-4 border-b border-border/20 pb-3">
          <AlertTriangle className="size-4 text-warning shrink-0" />
          <Typography type="body-sm" className="font-extrabold text-foreground uppercase tracking-wider text-[10px]">
            AI Trust Findings & Gaps ({totalFlagsCount})
          </Typography>
        </div>

        {totalFlagsCount === 0 ? (
          <Typography type="body-xs" className="text-muted italic py-2 text-left">
            No fraud flags, template signatures, or history anomalies detected in this repository.
          </Typography>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2 text-left">
              <Typography type="body-xs" className="font-bold text-foreground/80 text-[10px] uppercase tracking-wide">
                Detected Flags & Risk Reasons
              </Typography>
              <div className="space-y-2">
                {risk.reasons.map((reason, idx) => (
                  <div
                    key={`risk-reason-${idx}`}
                    className="p-3 rounded-xl border border-warning/15 bg-warning/5 flex items-center justify-between text-xs"
                  >
                    <span className="font-medium text-foreground">{reason}</span>
                    <Chip size="sm" color="warning" variant="soft" className="h-4.5 px-1.5 text-[8.5px] font-extrabold uppercase">
                      Risk Flag
                    </Chip>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default VerificationSignals;
