import React from "react";
import { Chip, Typography } from "@heroui/react";
import { Card } from "@/components/ui/card";
import {
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  Percent,
  GitCommit,
  AlertTriangle,
  Fingerprint,
} from "lucide-react";
import type { RepositoryAnalysis } from "@/types/repository-analysis.types";

interface VerificationSignalsProps {
  analysis: RepositoryAnalysis;
}

export const VerificationSignals: React.FC<VerificationSignalsProps> = ({
  analysis,
}) => {
  const {
    trust = { classification: "personal_authentic", confidence: 100, rule_flags: [], ai_findings: [], explanation: "" },
    ownership = { user_commit_ratio: 1, total_commits: 1, is_primary_author: true, architectural_ownership_pct: 100, critical_path_ownership_pct: 100, maintenance_duration_months: 1, explanation: "" },
    narrative = { recruiter_summary: "", top_strengths: [], limitations: [] }
  } = analysis;

  const totalFlagsCount = trust.rule_flags.length + trust.ai_findings.length;

  return (
    <div className="space-y-6 text-left font-sans select-none">
      {/* Top Banner: Verification Verdict */}
      <div
        className={`flex items-start gap-4 p-5 rounded-2xl border ${
          totalFlagsCount > 0
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
        <div className="space-y-1">
          <Typography type="body-sm" className="font-extrabold uppercase tracking-wider text-[10px] text-muted">
            Verification Verdict
          </Typography>
          <Typography type="body-sm" className="font-extrabold text-foreground text-sm capitalize">
            {trust.classification.replace(/_/g, " ")}
          </Typography>
          <Typography type="body-xs" className="text-muted leading-relaxed mt-0.5">
            {narrative?.recruiter_summary || trust.explanation}
          </Typography>
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
              {ownership.is_primary_author ? "Primary Author" : "Collaborator"}
            </Typography>
            <span className="text-[10px] text-muted block mt-0.5">
              Architectural Share: <strong>{ownership.architectural_ownership_pct}%</strong>
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
              {(ownership.user_commit_ratio * 100).toFixed(0)}% User Commits
            </Typography>
            <span className="text-[10px] text-muted block mt-0.5">
              Critical Path Share: <strong>{ownership.critical_path_ownership_pct}%</strong>
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
              {ownership.total_commits} Total Commits
            </Typography>
            <span className="text-[10px] text-muted block mt-0.5">
              Active over <strong>{ownership.maintenance_duration_months}</strong> months
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
              {trust.confidence}% Confidence
            </Typography>
            <span className="text-[10px] text-muted block mt-0.5">
              Status: <strong>{trust.confidence >= 70 ? "Clear Profile" : "Unverified"}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Fraud Indicators List */}
      <Card className="p-5 border border-border/80 bg-surface rounded-2xl" glow={false}>
        <div className="flex items-center gap-2 mb-4 border-b border-border/20 pb-3">
          <AlertTriangle className="size-4 text-warning shrink-0" />
          <Typography type="body-sm" className="font-extrabold text-foreground uppercase tracking-wider text-[10px]">
            Rule-Based & AI Trust Findings ({totalFlagsCount})
          </Typography>
        </div>

        {totalFlagsCount === 0 ? (
          <Typography type="body-xs" className="text-muted italic py-2 text-left">
            No fraud flags, template signatures, or history anomalies detected in this repository.
          </Typography>
        ) : (
          <div className="space-y-4">
            {/* Rule-Based Flags */}
            {trust.rule_flags.length > 0 && (
              <div className="space-y-2 text-left">
                <Typography type="body-xs" className="font-bold text-foreground/80 text-[10px] uppercase tracking-wide">
                  Deterministic Rule Violations
                </Typography>
                <div className="space-y-2">
                  {trust.rule_flags.map((flag, idx) => (
                    <div
                      key={`rule-${idx}`}
                      className="p-3 rounded-xl border border-danger/15 bg-danger/5 flex items-center justify-between text-xs"
                    >
                      <span className="font-medium text-foreground">{flag}</span>
                      <Chip size="sm" color="danger" variant="soft" className="h-4.5 px-1.5 text-[8.5px] font-extrabold uppercase">
                        Failed Rule
                      </Chip>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Trust Findings */}
            {trust.ai_findings.length > 0 && (
              <div className="space-y-2 text-left">
                <Typography type="body-xs" className="font-bold text-foreground/80 text-[10px] uppercase tracking-wide">
                  AI Stylistic Observations & Heuristics
                </Typography>
                <div className="space-y-2">
                  {trust.ai_findings.map((finding, idx) => (
                    <div
                      key={`ai-${idx}`}
                      className="p-3 rounded-xl border border-warning/15 bg-warning/5 flex items-center justify-between text-xs"
                    >
                      <span className="font-medium text-foreground">{finding}</span>
                      <Chip size="sm" color="warning" variant="soft" className="h-4.5 px-1.5 text-[8.5px] font-extrabold uppercase">
                        AI Flag
                      </Chip>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};
export default VerificationSignals;
