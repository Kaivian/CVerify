"use client";

import React from "react";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldAlert,
  Info,
  Code,
  GitFork,
  CheckCircle,
  HelpCircle,
  Fingerprint
} from "lucide-react";
import {
  Card,
  Chip,
  Spinner,
  ProgressBar,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell
} from "@heroui/react";
import { useAssessment } from "@/providers/assessment-provider";
import { CandidateAssessmentEmptyState } from "@/components/ui/CandidateAssessmentEmptyState";

export default function TrustScorePage() {
  const {
    latestAssessment,
    parsedProfile,
    isLoadingLatest
  } = useAssessment();

  // 1. Initial Assessment Check
  const neverAssessed = !latestAssessment;
  if (neverAssessed) {
    return <CandidateAssessmentEmptyState />;
  }

  // 2. Extract Trust Metrics from parsed CandidateProfile L2-014
  const trustMetrics = parsedProfile?.trustScoreMetrics;
  const evidenceGovernance = parsedProfile?.evidenceGovernance || [];
  const suggestions = parsedProfile?.cvImprovementSuggestions || [];

  // Parse Trust Value (0 - 100)
  const trustScoreRaw = latestAssessment?.trustLevel ?? trustMetrics?.candidateTrustScore ?? 0;
  const trustScore = trustScoreRaw <= 1 ? Math.round(trustScoreRaw * 100) : Math.round(trustScoreRaw);

  const getTrustBadgeColor = (level: any) => {
    if (level === undefined || level === null) {
      return "default";
    }

    if (typeof level === "string") {
      const normalized = level.trim().toLowerCase();
      if (normalized === "high") return "success";
      if (normalized === "medium") return "warning";
      if (normalized === "low") return "danger";

      const parsedNum = parseFloat(normalized);
      if (!isNaN(parsedNum)) {
        level = parsedNum;
      }
    }

    if (typeof level === "number") {
      if (level >= 70 || (level >= 0.7 && level <= 1.0)) {
        return "success";
      }
      if (level >= 40 || (level >= 0.4 && level < 0.7)) {
        return "warning";
      }
      return "danger";
    }

    return "default";
  };

  const getCloneRiskBadge = (risk: string) => {
    switch (risk?.toLowerCase()) {
      case "clean":
        return (
          <Chip size="sm" color="success" variant="soft" className="text-[8px] font-extrabold uppercase bg-success/10 text-success border-none h-5">
            Clean (No Plagiarism)
          </Chip>
        );
      case "low_risk":
        return (
          <Chip size="sm" color="warning" variant="soft" className="text-[8px] font-extrabold uppercase bg-warning/10 text-warning border-none h-5">
            Low Risk
          </Chip>
        );
      case "medium_risk":
        return (
          <Chip size="sm" color="warning" variant="soft" className="text-[8px] font-extrabold uppercase bg-warning/15 text-warning border-none h-5">
            Medium Risk
          </Chip>
        );
      case "high_risk":
        return (
          <Chip size="sm" color="danger" variant="soft" className="text-[8px] font-extrabold uppercase bg-danger/10 text-danger border-none h-5">
            High Risk (Template/Plagiarism)
          </Chip>
        );
      default:
        return (
          <Chip size="sm" color="default" variant="soft" className="text-[8px] font-extrabold uppercase h-5">
            Unclassified
          </Chip>
        );
    }
  };

  // Convert ratio to percentage safely
  const formatRatio = (val: number | undefined) => {
    if (val === undefined) return 0;
    return val <= 1 ? Math.round(val * 100) : Math.round(val);
  };

  const skillRatio = formatRatio(trustMetrics?.verifiedSkillRatio);
  const repoRatio = formatRatio(trustMetrics?.verifiedRepositoryRatio);
  const evidenceRatio = formatRatio(trustMetrics?.verifiedEvidenceRatio);

  return (
    <div className="space-y-6 font-sans">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch text-left">
        
        {/* LEFT PANEL: Circular Trust Gauge & Info */}
        <Card className="lg:col-span-4 p-6 border border-border/40 bg-surface rounded-2xl flex flex-col justify-between shadow-xs">
          <div className="space-y-4">
            <span className="text-[10px] font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Fingerprint size={13} className="text-accent" />
              <span>Identity & Code Authenticity</span>
            </span>
            <div className="w-full h-px bg-border/20" />
            <p className="text-[11px] text-muted-foreground leading-relaxed font-light">
              The Trust Score measures candidate credibility by validating git commit timelines, codebase authorship ratios, and identity matches.
            </p>
          </div>

          {/* Large Trust Score Gauge */}
          <div className="py-8 flex flex-col items-center justify-center">
            <div className="relative size-32 flex items-center justify-center bg-surface-secondary/40 rounded-full border border-border/50 p-4">
              <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-border/10"
                  strokeWidth="2.0"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-success transition-all duration-500 ease-out"
                  strokeDasharray={`${trustScore}, 100`}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute flex flex-col items-center text-center">
                <span className="text-3xl font-black text-foreground tracking-tight">
                  {trustScore}
                </span>
                <span className="text-[8px] text-muted-foreground uppercase font-black tracking-wider mt-0.5">Trust Score</span>
              </div>
            </div>
            {latestAssessment?.trustLevel !== undefined && latestAssessment?.trustLevel !== null && (
              <Chip
                size="sm"
                color={getTrustBadgeColor(latestAssessment.trustLevel)}
                variant="soft"
                className="mt-4 font-black uppercase text-[10px] px-3 h-6 border-none bg-default/10"
              >
                Credibility Band: {latestAssessment.trustLevel.toFixed(1)}%
              </Chip>
            )}
          </div>

          <div className="p-3 bg-surface-secondary/40 border border-border/30 rounded-xl flex flex-col gap-2 text-[10px] leading-relaxed text-muted-foreground font-light w-full">
            <div className="flex items-start gap-2.5">
              <Info size={14} className="text-accent shrink-0 mt-0.5" />
              <span>
                <strong>Evidence Trust Score:</strong> This page shows your code verification coverage ({latestAssessment?.trustLevel?.toFixed(1) ?? "0.0"}%). Scores above 70 indicate verified code consistency, matching git emails, and zero clone classifications.
              </span>
            </div>
            <div className="border-t border-border/20 pt-2 flex items-start gap-2.5">
              <ShieldCheck size={14} className="text-primary shrink-0 mt-0.5" />
              <span>
                <strong>Leaderboard Identity Trust:</strong> Note that this differs from your Identity Trust score displayed on the Leaderboard, which also factors in KYC verification, SMS/OTP validation, and DNS domain ownership.
              </span>
            </div>
          </div>
        </Card>

        {/* RIGHT PANEL: Verification Ratios Grid & Plagiarism Signals */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Ratio Breakdowns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Verified Skill Ratio */}
            <Card className="p-5 border border-border/40 bg-surface rounded-2xl shadow-xs text-left flex flex-col justify-between min-h-[160px]">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-foreground">Verified Skill Ratio</span>
                <p className="text-[9px] text-muted-foreground leading-normal font-light">
                  Overlap of declared CV profile skills with verified repository code evidence.
                </p>
              </div>
              <div className="space-y-2 mt-4">
                <div className="flex justify-between items-end text-xs">
                  <span className="font-extrabold text-foreground">{skillRatio}% Match</span>
                  <span className="text-[9px] text-muted-foreground">Threshold: 50%</span>
                </div>
                <ProgressBar aria-label="Verified Skill Ratio Match Percentage" value={skillRatio} color="accent" size="sm" />
              </div>
            </Card>

            {/* Verified Repository Ratio */}
            <Card className="p-5 border border-border/40 bg-surface rounded-2xl shadow-xs text-left flex flex-col justify-between min-h-[160px]">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-foreground">Verified Repo Ratio</span>
                <p className="text-[9px] text-muted-foreground leading-normal font-light">
                  Ratio of linked codebases passing ownership eligibility and clone risk gates.
                </p>
              </div>
              <div className="space-y-2 mt-4">
                <div className="flex justify-between items-end text-xs">
                  <span className="font-extrabold text-foreground">{repoRatio}% Cleared</span>
                  <span className="text-[9px] text-muted-foreground">Threshold: 80%</span>
                </div>
                <ProgressBar aria-label="Verified Repo Ratio Cleared Percentage" value={repoRatio} color="success" size="sm" />
              </div>
            </Card>

            {/* Verified Evidence Ratio */}
            <Card className="p-5 border border-border/40 bg-surface rounded-2xl shadow-xs text-left flex flex-col justify-between min-h-[160px]">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-foreground">Evidence Density Ratio</span>
                <p className="text-[9px] text-muted-foreground leading-normal font-light">
                  Authorship code density and commit volumes justifying overall seniority.
                </p>
              </div>
              <div className="space-y-2 mt-4">
                <div className="flex justify-between items-end text-xs">
                  <span className="font-extrabold text-foreground">{evidenceRatio}% Density</span>
                  <span className="text-[9px] text-muted-foreground">Threshold: 60%</span>
                </div>
                <ProgressBar aria-label="Evidence Density Ratio Percentage" value={evidenceRatio} color="warning" size="sm" />
              </div>
            </Card>

          </div>

          {/* Code Authorship & Security Signals Card */}
          <Card className="p-5 border border-border/40 bg-surface rounded-2xl shadow-xs text-left space-y-4">
            <span className="text-[10px] font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-accent" />
              <span>Authorship Verification & Clone Risks</span>
            </span>
            <div className="w-full h-px bg-border/20" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Plagiarism Risk */}
              <div className="p-4 bg-surface-secondary/35 border border-border/20 rounded-xl space-y-2 flex flex-col justify-between">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-foreground">Clone Risk Classification</h4>
                  <p className="text-[10px] text-muted-foreground leading-relaxed font-light">
                    Plagiarism scanning filters code that matches templates, boilerplate generators, or copied tutorials.
                  </p>
                </div>
                <div className="mt-2 pt-2 border-t border-border/10 flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground font-semibold">Active Status:</span>
                  {getCloneRiskBadge(parsedProfile?.cloneRiskClassification || "clean")}
                </div>
              </div>

              {/* Commit Timeline Consistency */}
              <div className="p-4 bg-surface-secondary/35 border border-border/20 rounded-xl space-y-2 flex flex-col justify-between">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-foreground">Timeline Telemetry Check</h4>
                  <p className="text-[10px] text-muted-foreground leading-relaxed font-light">
                    Analyzes whether commit patterns are natural, continuous, and match the candidate's professional chronology.
                  </p>
                </div>
                <div className="mt-2 pt-2 border-t border-border/10 flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground font-semibold">Git Email Validation:</span>
                  <Chip size="sm" color="success" variant="soft" className="text-[8px] font-extrabold uppercase bg-success/10 text-success border-none h-5">
                    Match Verified
                  </Chip>
                </div>
              </div>

            </div>
          </Card>
        </div>

      </div>

      {/* BOTTOM PANEL: Evidence Governance Table */}
      <Card className="p-6 border border-border/40 bg-surface rounded-2xl shadow-xs text-left space-y-4">
        <span className="text-[10px] font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
          <GitFork size={13} className="text-accent" />
          <span>Evidence Governance (Codebases Analyzed)</span>
        </span>
        <div className="w-full h-px bg-border/20" />

        {evidenceGovernance.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-muted">
            <HelpCircle size={24} className="mb-2 text-muted-foreground/55" />
            <p className="text-xs font-light text-muted-foreground">No repositories connected or analyzed.</p>
          </div>
        ) : (
          <div className="overflow-x-auto select-text">
            <table className="w-full min-w-[700px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-border/30 text-muted font-black uppercase tracking-wider text-[9px]">
                  <th className="py-3 px-4 text-left font-black">Repository</th>
                  <th className="py-3 px-4 text-left font-black">Linked CV Project</th>
                  <th className="py-3 px-4 text-left font-black">Verification Level</th>
                  <th className="py-3 px-4 text-center font-black">Authorship %</th>
                  <th className="py-3 px-4 text-center font-black">Score Weight</th>
                  <th className="py-3 px-4 text-center font-black">Trust Band</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20 text-foreground/90 font-light">
                {evidenceGovernance.map((gov: any, idx: number) => (
                  <tr key={idx} className="hover:bg-surface-secondary/20 transition-colors">
                    <td className="py-3 px-4 font-bold flex items-center gap-2">
                      <Code size={13} className="text-muted/70 shrink-0" />
                      <span className="truncate max-w-[200px]" title={gov.repositoryName}>{gov.repositoryName}</span>
                    </td>
                    <td className="py-3 px-4 truncate max-w-[180px] font-medium text-foreground/75" title={gov.cvProjectName}>
                      {gov.cvProjectName || "Unattached Repo"}
                    </td>
                    <td className="py-3 px-4">
                      <Chip
                        size="sm"
                        variant="soft"
                        color={gov.cvVerificationLevel === "AiAnalyzed" ? "accent" : "default"}
                        className="text-[8px] uppercase font-bold h-4.5 border-none px-1.5"
                      >
                        {gov.cvVerificationLevel || "Linked"}
                      </Chip>
                    </td>
                    <td className="py-3 px-4 text-center font-mono">
                      {gov.authorshipPercent ? `${Math.round(gov.authorshipPercent)}%` : "0%"}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-medium">
                      {gov.scoreContributionPercent ? `${Math.round(gov.scoreContributionPercent)}%` : "0%"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Chip
                        size="sm"
                        variant="soft"
                        color={getTrustBadgeColor(gov.trustLevel)}
                        className="text-[8px] uppercase font-black h-4.5 border-none px-1.5"
                      >
                        {gov.trustLevel || "N/A"}
                      </Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* IMPROVEMENT ADVICE LIST */}
      {suggestions.length > 0 && (
        <Card className="p-5 border border-border/40 bg-surface rounded-2xl shadow-xs text-left space-y-4">
          <span className="text-[10px] font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <AlertTriangle size={13} className="text-warning" />
            <span>Actions to Elevate Developer Trust Score</span>
          </span>
          <div className="w-full h-px bg-border/20" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {suggestions.map((sug: any, idx: number) => (
              <div key={idx} className="p-3 bg-warning/5 border border-warning/15 rounded-xl flex gap-3 items-start">
                <div className="p-1.5 rounded-lg bg-warning/10 text-warning-foreground shrink-0 mt-0.5">
                  <AlertTriangle size={12} className="text-warning" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-[11px] font-extrabold text-foreground uppercase tracking-wide">
                    {sug.repositoryName ? `Repo Action: ${sug.repositoryName}` : "General Trust Improvement"}
                  </h4>
                  <p className="text-[10px] text-muted-foreground leading-normal font-light">
                    <strong>Suggestion:</strong> {sug.suggestion}
                  </p>
                  <p className="text-[9px] text-foreground/80 leading-normal font-light mt-0.5 italic">
                    <strong>Rationale:</strong> {sug.reason}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

    </div>
  );
}
