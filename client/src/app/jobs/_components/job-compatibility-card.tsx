"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import {
  CheckCircle2,
  XCircle,
  Bookmark,
  AlertTriangle,
  ShieldCheck,
  TrendingUp,
  Info,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import {
  Button,
  Chip,
  Spinner
} from "@heroui/react";
import type { ExplainableMatchReportDto, PublicJobDto } from "@/services/jobs.service";
import { useSavedJobsStore } from "@/stores/use-saved-jobs-store";

interface JobCompatibilityCardProps {
  id: string;
  job?: PublicJobDto;
  isAuthenticated: boolean;
  report: ExplainableMatchReportDto | null;
  applied: boolean;
  applying: boolean;
  applyError: string | null;
  isSaved?: boolean;
  onApply: () => void;
  onToggleSave?: () => void;
  onRedirectToLogin: () => void;
  onViewDetails: () => void;
}

export function JobCompatibilityCard({
  id,
  job,
  isAuthenticated,
  report,
  applied,
  applying,
  applyError,
  isSaved: passedIsSaved,
  onApply,
  onToggleSave,
  onRedirectToLogin,
  onViewDetails
}: JobCompatibilityCardProps) {
  const [showExplanation, setShowExplanation] = useState(false);

  // Read saved status and toggle function from Zustand store
  const savedJobIds = useSavedJobsStore((state) => state.savedJobIds);
  const toggleSaveJobStore = useSavedJobsStore((state) => state.toggleSaveJob);

  const isSaved = passedIsSaved !== undefined ? passedIsSaved : savedJobIds.has(id);

  const handleToggleSave = () => {
    if (!isAuthenticated) {
      onRedirectToLogin();
      return;
    }
    if (onToggleSave) {
      onToggleSave();
    } else {
      toggleSaveJobStore(id, job);
    }
  };

  if (!isAuthenticated) {
    return (
      <Card glow={true} className="border border-border/60 bg-surface rounded-xl p-6 flex flex-col gap-6 relative overflow-hidden">
        <div className="flex items-center gap-3 mb-2 select-none">
          <div className="w-10 h-10 rounded-full bg-surface-secondary flex items-center justify-center text-foreground">
            <ShieldCheck size={20} className="text-muted" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Match Compatibility Analysis</h2>
            <p className="text-xs text-muted">Verify eligibility and unlock application checklist</p>
          </div>
        </div>

        <p className="text-xs text-muted leading-relaxed">
          Sign in to analyze your connected repository metadata, check job eligibility benchmarks, and apply with real-world verification credentials.
        </p>

        <div className="flex flex-col gap-3 mt-4">
          <Button
            className="bg-accent text-accent-foreground font-bold w-full rounded-xl h-11 text-xs cursor-pointer hover:opacity-90 transition-all"
            onClick={onRedirectToLogin}
          >
            Sign In to Verify & Apply
          </Button>

          <Button
            variant="outline"
            className="font-bold text-foreground w-full border border-border/60 rounded-xl h-11 text-xs cursor-pointer hover:bg-surface-secondary/45 transition-all"
            onClick={onViewDetails}
          >
            Xem chi tiết JD
          </Button>
        </div>
      </Card>
    );
  }

  if (!report) {
    return (
      <Card glow={true} className="border border-border/60 bg-surface rounded-xl p-6 flex flex-col items-center justify-center py-12 select-none">
        <Spinner size="sm" color="warning" />
        <span className="text-muted text-xs mt-2 font-medium">Generating compatibility report...</span>
      </Card>
    );
  }

  const isEligible = report.isEligible;
  const isPartiallyEligible = report.isPartiallyEligible;

  // Group checks into Core Verification vs Capability checks
  const coreChecks = report.checks.filter(c => !c.name.startsWith("Capability-"));
  const capabilityChecks = report.checks.filter(c => c.name.startsWith("Capability-"));
  const failedChecks = report.checks.filter(c => !c.passed);

  // Dynamic stroke color for progress circle matching the eligibility status
  const strokeColorClass = isEligible
    ? 'stroke-success'
    : isPartiallyEligible
      ? 'stroke-warning'
      : 'stroke-danger';

  // Helper to generate missing badges
  const getMissingBadges = () => {
    const badges: string[] = [];
    failedChecks.forEach(c => {
      if (c.name === "IdentityVerification") {
        badges.push("KYC Verification");
        badges.push("OTP Verification");
      } else if (c.name === "TrustScore") {
        badges.push("DNS Match Verification");
      } else if (c.name === "PortfolioRepositories") {
        badges.push("Verified Repositories");
      } else if (c.name === "VerifiedProfile") {
        badges.push("Technical Assessment");
      } else if (c.name === "ProfileCompleteness") {
        badges.push("80% Profile Completeness");
      } else if (c.name.startsWith("Capability-")) {
        badges.push(c.name.replace(/^Capability-/, ""));
      }
    });
    return Array.from(new Set(badges)); // Deduplicate
  };

  const missingBadges = getMissingBadges();

  return (
    <Card glow={true} className="border border-border/60 bg-surface rounded-xl flex flex-col relative overflow-hidden p-6 gap-0">

      {/* Decorative top ambient indicator */}
      <div className={`absolute top-0 left-0 right-0 h-1 transition-all ${isEligible
        ? "bg-success"
        : isPartiallyEligible
          ? "bg-warning"
          : "bg-danger"
        }`} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-surface-secondary flex items-center justify-center text-foreground">
            <TrendingUp size={20} className="text-accent" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">CVerify Match Analytics</h2>
            <p className="text-xs text-muted">Mathematical verification index</p>
          </div>
        </div>

        {/* Circular Progress & Percentage */}
        <div className="flex items-center gap-3 bg-surface-secondary/40 px-3 py-1.5 rounded-xl border border-border/40 w-fit">
          <div className="relative w-8 h-8 flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle
                cx="16"
                cy="16"
                r="14"
                className="stroke-border/20 fill-none"
                strokeWidth="2.5"
              />
              <circle
                cx="16"
                cy="16"
                r="14"
                className={`transition-all duration-500 fill-none ${strokeColorClass}`}
                strokeWidth="2.5"
                strokeDasharray="88"
                strokeDashoffset={88 - (88 * Math.min(report.aggregateScore, 100)) / 100}
              />
            </svg>
            <span className="text-[10px] font-extrabold font-mono text-foreground">
              {report.aggregateScore}%
            </span>
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[10px] font-bold text-foreground leading-tight">Compatibility Score</span>
            <span className="text-[9px] text-muted font-medium">{report.confidenceLevel} confidence</span>
          </div>
        </div>
      </div>

      <div className="h-px bg-border/40 mt-6 mb-2" />

      {/* Status Box */}
      <div className="mt-4">
        <div className={`p-4 rounded-xl border-l-4 flex gap-3 select-none ${isEligible
          ? "bg-success/5 border-success/20 border-l-success text-success"
          : isPartiallyEligible
            ? "bg-warning/5 border-warning/20 border-l-warning text-warning"
            : "bg-danger/5 border-danger/20 border-l-danger text-danger"
          }`}>
          <div className={`p-1.5 rounded-lg shrink-0 ${isEligible
            ? "bg-success/10 text-success"
            : isPartiallyEligible
              ? "bg-warning/10 text-warning"
              : "bg-danger/10 text-danger"
            }`}>
            {isEligible ? (
              <CheckCircle2 size={16} />
            ) : (
              <AlertTriangle size={16} />
            )}
          </div>
          <div className="flex flex-col text-left justify-center">
            <span className="text-xs font-bold text-foreground">
              {isEligible
                ? "Eligible to Apply"
                : isPartiallyEligible
                  ? "Eligible with Gaps"
                  : "Ineligible"}
            </span>
            <span className="text-[11px] text-muted leading-relaxed mt-1">
              {report.explanation}
            </span>
          </div>
        </div>
      </div>

      {/* Missing Requirement Badges (Highlighted) */}
      {missingBadges.length > 0 && (
        <div className="flex flex-col gap-2.5 text-left mt-6">
          <span className="text-[10px] font-bold uppercase tracking-wider text-danger">Unmet Requirements</span>
          <div className="flex flex-wrap gap-1.5">
            {missingBadges.map((badge, idx) => (
              <Chip
                key={idx}
                size="sm"
                variant="soft"
                className="text-[10px] font-bold bg-danger/10 text-danger border border-danger/20 animate-none"
              >
                {badge}
              </Chip>
            ))}
          </div>
        </div>
      )}

      <div className="h-px bg-border/40 mt-6 mb-2" />

      {/* Requirement Checklist */}
      <div className="flex flex-col gap-6 text-left mt-4">
        <span className="text-xs font-bold text-foreground select-none uppercase tracking-wider">Requirement Checklist</span>

        {/* Core Verification */}
        {coreChecks.length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="text-[10px] font-extrabold text-muted uppercase tracking-widest">Core Verification</h3>
            <div className="bg-field-background border border-border/50 rounded-xl divide-y divide-border/20 overflow-hidden shadow-xs">
              {coreChecks.map((check, idx) => {
                const passed = check.passed;
                return (
                  <div
                    key={idx}
                    className={`flex items-start justify-between gap-4 text-xs py-3.5 px-4 transition-colors ${
                      passed ? "" : "bg-danger/5"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {passed ? (
                        <CheckCircle2 size={15} className="text-success shrink-0 mt-0.5" />
                      ) : (
                        <XCircle size={15} className="text-danger shrink-0 mt-0.5" />
                      )}
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground">{check.name}</span>
                        <span className="text-[10px] text-muted leading-normal mt-0.5">{check.description}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0 select-none">
                      <span className="text-[9px] text-muted font-medium">Req: {check.requiredValue}</span>
                      <span className={`text-[10px] font-bold font-mono mt-0.5 ${passed ? "text-success" : "text-danger"}`}>
                        Got: {check.actualValue}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Technical Capabilities */}
        {capabilityChecks.length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="text-[10px] font-extrabold text-muted uppercase tracking-widest">Technical Capabilities</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {capabilityChecks.map((check, idx) => {
                const displayName = check.name.replace(/^Capability-/, "");
                const passed = check.passed;
                return (
                  <div
                    key={idx}
                    className={`flex items-center justify-between py-2.5 px-3.5 rounded-xl border text-xs transition-colors ${
                      passed
                        ? "bg-success/5 border-success/15"
                        : "bg-danger/5 border-danger/15"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {passed ? (
                        <CheckCircle2 size={13} className="text-success shrink-0" />
                      ) : (
                        <XCircle size={13} className="text-danger shrink-0" />
                      )}
                      <span className="font-semibold text-foreground truncate" title={displayName}>
                        {displayName}
                      </span>
                    </div>
                    <span className={`text-[9px] font-bold font-mono shrink-0 ml-2 ${passed ? "text-success" : "text-danger"}`}>
                      {passed ? "Verified" : "Missing"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Matched Capabilities */}
      {report.capabilityFit?.matchedCapabilities?.length > 0 && (
        <>
          <div className="h-px bg-border/40 mt-4 mb-2" />
          <div className="flex flex-col gap-2 text-left select-none mt-2">
            <span className="text-xs font-bold text-foreground">Matched Catalog Capabilities</span>
            <div className="flex flex-wrap gap-1.5">
              {report.capabilityFit.matchedCapabilities.map((cap, index) => (
                <Chip key={index} size="sm" variant="soft" className="text-[10px] font-semibold bg-success/15 text-success border border-success/20">
                  {cap}
                </Chip>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="h-px bg-border/40 mt-6 mb-2" />

      {/* Collapsible Explainability Section: "Why this score?" */}
      <div className="flex flex-col gap-3 mt-4">
        <Button
          variant="ghost"
          size="sm"
          className="w-full flex items-center justify-between font-semibold text-xs text-muted hover:text-foreground hover:bg-surface-secondary/40 rounded-lg cursor-pointer h-9 px-3"
          onClick={() => setShowExplanation(!showExplanation)}
        >
          <span>Why this score?</span>
          {showExplanation ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </Button>

        {showExplanation && (
          <div className="bg-surface-secondary/30 border border-border/50 rounded-xl p-4 flex flex-col gap-3.5 text-left text-xs text-foreground select-text">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted">Capability Fit</span>
                <span className="font-bold text-sm text-foreground">{report.capabilityFit.score}%</span>
                <span className="text-[11px] text-muted leading-relaxed mt-0.5">{report.capabilityFit.explanation}</span>
              </div>
              <div className="flex flex-col gap-1 border-l border-border/40 pl-4">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted">Trust Fit</span>
                <span className="font-bold text-sm text-foreground">{report.trustFit.score}%</span>
                <span className="text-[11px] text-muted leading-relaxed mt-0.5">{report.trustFit.explanation}</span>
              </div>
            </div>
            <div className="h-px bg-border/20 w-full" />
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted">Overall Compatibility</span>
              <p className="text-[11px] text-muted leading-relaxed mt-0.5">{report.explanation}</p>
            </div>
          </div>
        )}
      </div>

      <div className="h-px bg-border/40 mt-6 mb-2" />

      {/* CTA Buttons */}
      <div className="mt-4">
        {applied ? (
          <div className="flex flex-col gap-3">
            <Button size="md" className="bg-success text-white font-bold w-full rounded-xl h-11 text-xs select-none" isDisabled>
              Applied Successfully
            </Button>
            <Button
              variant="outline"
              className="font-bold text-foreground w-full border border-border/60 rounded-xl h-11 text-xs cursor-pointer hover:bg-surface-secondary/40 transition-all"
              onClick={onViewDetails}
            >
              Xem chi tiết JD
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {applyError && (
              <span className="text-[11px] text-danger font-semibold bg-danger-foreground/20 p-2.5 rounded-lg border border-danger/25 text-left">
                {applyError}
              </span>
            )}
            
            {/* Warning Copy for Apply with Gaps */}
            {!isEligible && (
              <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 text-left flex gap-2.5 select-none mb-1">
                <AlertTriangle size={16} className="text-warning shrink-0 mt-0.5" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-bold text-warning">Apply with Requirement Gaps</span>
                  <span className="text-[10px] text-muted leading-normal">
                    You do not meet all criteria. You can still apply, but missing requirements will be flagged.
                  </span>
                </div>
              </div>
            )}

            <Button
              className="bg-accent text-accent-foreground font-bold w-full rounded-xl h-11 text-xs cursor-pointer hover:opacity-90 transition-all"
              isDisabled={applying}
              onClick={onApply}
            >
              {applying && <Spinner size="sm" color="current" className="mr-1.5 size-3.5" />}
              Submit Application with Verified Profile
            </Button>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="font-bold text-foreground flex-1 border border-border/60 rounded-xl h-11 text-xs cursor-pointer hover:bg-surface-secondary/40 transition-all"
                onClick={onViewDetails}
              >
                Xem chi tiết JD
              </Button>

              <Button
                variant="ghost"
                className="font-bold text-foreground flex-1 rounded-xl h-11 text-xs cursor-pointer hover:bg-surface-secondary/40 transition-all animate-none"
                onClick={handleToggleSave}
              >
                <Bookmark size={14} className={`mr-1 ${isSaved ? "fill-foreground" : ""}`} />
                {isSaved ? "Saved" : "Bookmark"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Info Notice */}
      <div className="bg-surface-secondary/30 border border-border/30 rounded-xl px-4 py-3 -mx-2 mt-6">
        <div className="flex gap-2.5 text-left select-none">
          <Info size={14} className="text-muted shrink-0 mt-0.5" />
          <p className="text-[10px] text-muted leading-relaxed">
            Eligibility scores calculate complete profile weight (80%+ target), active AST node structures, and verified timeline integrity. Connect platforms in settings to update.
          </p>
        </div>
      </div>

    </Card>
  );
}

export default JobCompatibilityCard;
