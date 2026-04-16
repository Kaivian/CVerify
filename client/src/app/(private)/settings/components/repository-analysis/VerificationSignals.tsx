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
import { RepositoryAnalysis } from "@/types/repository-analysis.types";

interface VerificationSignalsProps {
  analysis: RepositoryAnalysis;
}

export const VerificationSignals: React.FC<VerificationSignalsProps> = ({
  analysis,
}) => {
  const {
    source_classification,
    contribution_stats,
    fraud_flags,
    fraud_multiplier,
    scoring,
  } = analysis;

  // Determine indicator color based on severity
  const getSeverityColor = (severity: "high" | "medium" | "low") => {
    switch (severity) {
      case "high":
        return "danger";
      case "medium":
        return "warning";
      case "low":
        return "default";
      default:
        return "default";
    }
  };

  return (
    <div className="space-y-6 text-left font-sans select-none">
      {/* Top Banner: Verification Verdict */}
      <div
        className={`flex items-start gap-4 p-5 rounded-2xl border ${
          fraud_flags.length > 0
            ? "bg-warning/5 border-warning/20 text-warning"
            : "bg-success/5 border-success/20 text-success"
        }`}
      >
        <div className="p-2 rounded-xl bg-background border border-current/10 shrink-0">
          {fraud_flags.length > 0 ? (
            <ShieldAlert className="size-6 text-warning" />
          ) : (
            <ShieldCheck className="size-6 text-success" />
          )}
        </div>
        <div className="space-y-1">
          <Typography type="body-sm" className="font-extrabold uppercase tracking-wider text-[10px] text-muted">
            Verification Verdict
          </Typography>
          <Typography type="body-sm" className="font-extrabold text-foreground text-sm">
            {scoring.verdict}
          </Typography>
          <Typography type="body-xs" className="text-muted leading-relaxed mt-0.5">
            {scoring.recruiter_summary}
          </Typography>
        </div>
      </div>

      {/* Grid of Trust Signals */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Ownership Verification */}
        <div className="p-4 rounded-xl border border-border bg-surface flex flex-col justify-between h-28">
          <div className="flex items-center justify-between text-muted">
            <Typography type="body-xs" className="font-bold text-[9px] uppercase tracking-wider">
              Ownership Classification
            </Typography>
            <UserCheck className="size-4 text-accent" />
          </div>
          <div className="mt-2 text-left">
            <Typography className="text-sm font-extrabold text-foreground capitalize">
              {source_classification.case.replace("_", " ")}
            </Typography>
            <span className="text-[10px] text-muted block mt-0.5">
              Confidence: <strong>{(source_classification.confidence_base * 100).toFixed(0)}%</strong>
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
              {contribution_stats.user_commit_pct}% User Commits
            </Typography>
            <span className="text-[10px] text-muted block mt-0.5">
              Owns <strong>{contribution_stats.user_commits}</strong> of <strong>{contribution_stats.total_commits}</strong> commits
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
              {contribution_stats.total_commits} Total Commits
            </Typography>
            <span className="text-[10px] text-muted block mt-0.5">
              Across <strong>{contribution_stats.branches_count}</strong> active branches
            </span>
          </div>
        </div>

        {/* Identity Confidence */}
        <div className="p-4 rounded-xl border border-border bg-surface flex flex-col justify-between h-28">
          <div className="flex items-center justify-between text-muted">
            <Typography type="body-xs" className="font-bold text-[9px] uppercase tracking-wider">
              Trust Multiplier
            </Typography>
            <Fingerprint className="size-4 text-accent" />
          </div>
          <div className="mt-2 text-left">
            <Typography className="text-sm font-extrabold text-foreground">
              {(fraud_multiplier * 100).toFixed(0)}% Integrity
            </Typography>
            <span className="text-[10px] text-muted block mt-0.5">
              Score reduced by <strong>{((1 - fraud_multiplier) * 100).toFixed(0)}%</strong> penalty
            </span>
          </div>
        </div>
      </div>

      {/* Fraud Indicators List */}
      <Card className="p-5 border border-border/80 bg-surface rounded-2xl" glow={false}>
        <div className="flex items-center gap-2 mb-4 border-b border-border/20 pb-3">
          <AlertTriangle className="size-4 text-warning shrink-0" />
          <Typography type="body-sm" className="font-extrabold text-foreground uppercase tracking-wider text-[10px]">
            AI Trust Flags & Anomalies ({fraud_flags.length})
          </Typography>
        </div>

        {fraud_flags.length === 0 ? (
          <Typography type="body-xs" className="text-muted italic py-2">
            No fraud flags or pattern anomalies detected in this repository.
          </Typography>
        ) : (
          <div className="space-y-3.5">
            {fraud_flags.map((flag, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between gap-4 p-3 rounded-xl border border-border/60 bg-surface-secondary/40"
              >
                <div className="space-y-1.5 text-left">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-extrabold text-foreground font-mono">
                      {flag.type.replace(/_/g, " ")}
                    </span>
                    <Chip
                      size="sm"
                      variant="soft"
                      color={getSeverityColor(flag.severity)}
                      className="h-4.5 px-1 text-[8.5px] uppercase font-extrabold"
                    >
                      {flag.severity}
                    </Chip>
                  </div>
                  <Typography type="body-xs" className="text-muted leading-relaxed font-light">
                    {flag.detail}
                  </Typography>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[8px] text-muted block uppercase tracking-wider">Penalty</span>
                  <span className="text-xs text-danger font-extrabold font-mono">
                    -{((1 - flag.confidence_penalty) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
export default VerificationSignals;
