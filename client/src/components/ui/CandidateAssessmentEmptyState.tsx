"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  AlertCircle,
  Play,
  ArrowRight,
  GitFork,
  CheckCircle2
} from "lucide-react";
import { Card, Button, Spinner, Chip } from "@heroui/react";
import { useAssessment } from "@/providers/assessment-provider";

export function CandidateAssessmentEmptyState() {
  const router = useRouter();
  const {
    readiness,
    isLoadingReadiness,
    triggerAssessment,
    isTriggering,
    error: assessmentError,
    clearError
  } = useAssessment();
  const [localError, setLocalError] = useState<string | null>(null);

  if (isLoadingReadiness || !readiness) {
    return (
      <Card className="flex flex-col items-center justify-center p-16 space-y-4 border border-border/40 bg-surface">
        <Spinner size="lg" color="accent" />
        <p className="text-sm text-muted-foreground font-light">Checking profile readiness status...</p>
      </Card>
    );
  }

  const handleStartVetting = async () => {
    setLocalError(null);
    clearError();
    try {
      await triggerAssessment();
    } catch (err: any) {
      setLocalError(err.message || "Failed to start assessment. Please ensure you have connected and analyzed at least one repository.");
    }
  };

  const getMissingFieldLabel = (field: string) => {
    switch (field.toLowerCase()) {
      case "headline":
        return "Professional Headline";
      case "bio":
        return "Biography / About Me";
      case "skills":
        return "Target Technical Skills";
      case "education":
        return "Education History";
      case "experiences":
        return "Work Experience History";
      default:
        return field;
    }
  };

  const activeError = localError || assessmentError;

  // Case 1: Profile is Incomplete
  if (!readiness.isReady) {
    return (
      <Card className="flex flex-col items-center justify-center p-10 md:p-16 text-center space-y-6 max-w-2xl mx-auto border border-border/50 bg-surface rounded-2xl shadow-xs font-sans">
        <div className="p-4 rounded-full bg-surface-secondary text-muted shrink-0">
          <FileText size={36} />
        </div>
        <div className="space-y-2 max-w-md">
          <h3 className="text-lg font-bold text-foreground tracking-tight">Complete Your CV Profile</h3>
          <p className="text-xs md:text-sm text-muted-foreground font-light leading-relaxed">
            CVerify AI Intelligence requires a completed professional profile to run capability evaluations, score breakdowns, and trust calibrations.
          </p>
        </div>

        {/* Missing Fields list */}
        <div className="w-full max-w-md p-4 bg-surface-secondary/40 border border-border/30 rounded-xl space-y-2.5 text-left">
          <span className="text-[10px] font-black uppercase text-foreground tracking-wider block">
            Required Missing Profile Sections:
          </span>
          <div className="flex flex-col gap-2">
            {readiness.missingFields.map((field) => (
              <div key={field} className="flex items-center gap-2 text-xs text-foreground/90">
                <AlertCircle size={14} className="text-warning shrink-0" />
                <span className="font-medium">{getMissingFieldLabel(field)}</span>
              </div>
            ))}
          </div>
        </div>

        <Button
          className="bg-accent text-accent-foreground font-bold rounded-xl border-none cursor-pointer px-6 h-10 w-fit flex items-center gap-1.5"
          onPress={() => router.push("/cv")}
        >
          <span>Complete Your CV</span>
          <ArrowRight size={15} />
        </Button>
      </Card>
    );
  }

  // Case 2: Profile is Complete, Ready to Trigger Assessment
  return (
    <Card className="flex flex-col items-center justify-center p-10 md:p-16 text-center space-y-6 max-w-2xl mx-auto border border-border/50 bg-surface rounded-2xl shadow-xs font-sans">
      <div className="p-4 rounded-full bg-accent/10 text-accent shrink-0 relative">
        <GitFork size={36} className="animate-pulse" />
        <CheckCircle2 size={16} className="absolute bottom-3 right-3 text-success bg-surface rounded-full" />
      </div>
      <div className="space-y-2 max-w-md">
        <h3 className="text-lg font-bold text-foreground tracking-tight">Vetting Assessment Ready</h3>
        <p className="text-xs md:text-sm text-muted-foreground font-light leading-relaxed">
          Your CV and connected code repositories are consolidated. Launch the CVerify AI Vetting Engine to compile your Skill Tree, calibrate your Trust Score, and generate your Professional Evaluation.
        </p>
      </div>

      {activeError && (
        <div className="w-full max-w-md p-4 bg-danger/5 border border-danger/20 text-danger rounded-xl text-xs text-left leading-relaxed">
          <strong>Vetting Trigger Issue:</strong> {activeError}
        </div>
      )}

      <Button
        className="bg-accent text-accent-foreground font-bold rounded-xl border-none cursor-pointer px-6 h-10 w-fit flex items-center gap-1.5"
        onPress={handleStartVetting}
        isDisabled={isTriggering}
      >
        {isTriggering ? (
          <Spinner size="sm" color="current" className="shrink-0" />
        ) : (
          <Play size={14} className="shrink-0" />
        )}
        <span>{isTriggering ? "Initializing AI Pipeline..." : "Trigger Vetting Assessment"}</span>
      </Button>
    </Card>
  );
}
