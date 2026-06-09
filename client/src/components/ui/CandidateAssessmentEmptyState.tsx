"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  AlertCircle,
  Play,
  ArrowRight,
  GitFork,
  CheckCircle2,
  Sparkles
} from "lucide-react";
import { Card, Button, Spinner, Chip } from "@heroui/react";
import { useAssessment } from "@/providers/assessment-provider";
import { RequiredFieldsMissingModal } from "./RequiredFieldsMissingModal";

export function CandidateAssessmentEmptyState() {
  const router = useRouter();
  const {
    readiness,
    isLoadingReadiness,
    triggerAssessment,
    isTriggering,
    error: assessmentError,
    clearError,
    fetchReadiness
  } = useAssessment();
  const [isPrereqModalOpen, setIsPrereqModalOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const activeError = localError || assessmentError;

  if (isLoadingReadiness) {
    return (
      <Card className="flex flex-col items-center justify-center p-16 space-y-4 border border-border/40 bg-surface">
        <Spinner size="lg" color="accent" />
        <p className="text-sm text-muted-foreground font-light">Checking profile readiness status...</p>
      </Card>
    );
  }

  if (activeError && !readiness) {
    return (
      <Card className="flex flex-col items-center justify-center p-16 text-center space-y-6 max-w-2xl mx-auto border border-danger/35 bg-danger/5 text-danger rounded-2xl shadow-xs font-sans select-none">
        <div className="p-4 rounded-full bg-danger/10 text-danger shrink-0">
          <AlertCircle size={36} />
        </div>
        <div className="space-y-2 max-w-md">
          <h3 className="text-lg font-bold text-foreground tracking-tight">Failed to Load Profile Readiness</h3>
          <p className="text-xs md:text-sm text-muted-foreground font-light leading-relaxed">
            {activeError}
          </p>
        </div>
        <Button
          className="bg-accent text-accent-foreground font-bold rounded-xl border-none cursor-pointer px-6 h-10 w-fit"
          onPress={() => {
            setLocalError(null);
            clearError();
            fetchReadiness();
          }}
        >
          Retry Connection
        </Button>
      </Card>
    );
  }

  if (!readiness) {
    return (
      <Card className="flex flex-col items-center justify-center p-16 space-y-4 border border-border/40 bg-surface">
        <Spinner size="lg" color="accent" />
        <p className="text-sm text-muted-foreground font-light">Checking profile readiness status...</p>
      </Card>
    );
  }

  const triggerVettingEngine = async () => {
    setLocalError(null);
    clearError();
    try {
      await triggerAssessment();
    } catch (err: any) {
      setLocalError(err.message || "Failed to start assessment. Please ensure you have connected and analyzed at least one repository.");
    }
  };

  const handleStartVetting = async () => {
    if (readiness && readiness.missingFields.length > 0) {
      setIsPrereqModalOpen(true);
      return;
    }
    await triggerVettingEngine();
  };

  const requiredFields = readiness.missingFields.filter(f => f.isRequired);
  const optionalFields = readiness.missingFields.filter(f => !f.isRequired);

  // Case 1: Profile is Incomplete (Required fields missing)
  if (!readiness.isReady) {
    return (
      <Card className="flex flex-col items-center justify-center p-10 md:p-16 text-center space-y-6 max-w-2xl mx-auto border border-border/50 bg-surface rounded-2xl shadow-xs font-sans select-none">
        <div className="p-4 rounded-full bg-surface-secondary text-danger shrink-0 border border-danger/10">
          <AlertCircle size={36} />
        </div>
        <div className="space-y-2 max-w-md">
          <h3 className="text-lg font-bold text-foreground tracking-tight">AI Vetting Prerequisites Required</h3>
          <p className="text-xs md:text-sm text-muted-foreground font-light leading-relaxed">
            CVerify AI calibration requires at least one completed code repository analysis to run engineering telemetry assessments.
          </p>
        </div>

        {/* Missing Fields list */}
        <div className="w-full max-w-md p-4 bg-surface-secondary/40 border border-border/30 rounded-xl space-y-2.5 text-left">
          <span className="text-[10px] font-black uppercase text-danger tracking-wider block">
            Required Missing Prerequisites:
          </span>
          <div className="flex flex-col gap-3">
            {requiredFields.map((field) => (
              <div key={field.fieldKey} className="flex gap-2.5 items-start text-xs">
                <AlertCircle size={14} className="text-danger shrink-0 mt-0.5" />
                <div className="flex flex-col">
                  <span className="font-bold text-foreground">{field.displayLabel}</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{field.recommendationMessage}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Button
          className="bg-accent text-accent-foreground font-bold rounded-xl border-none cursor-pointer px-6 h-10 w-fit flex items-center gap-1.5"
          onPress={() => router.push("/settings/source-code-providers")}
        >
          <span>Connect & Analyze Repository</span>
          <ArrowRight size={15} />
        </Button>
      </Card>
    );
  }

  // Case 2: Profile is Complete, Ready to Trigger Assessment
  return (
    <>
      <Card className="flex flex-col items-center justify-center p-10 md:p-16 text-center space-y-6 max-w-2xl mx-auto border border-border/50 bg-surface rounded-2xl shadow-xs font-sans select-none">
        <div className="p-4 rounded-full bg-accent/10 text-accent shrink-0 relative">
          <GitFork size={36} className="animate-pulse" />
          <CheckCircle2 size={16} className="absolute bottom-3 right-3 text-success bg-surface rounded-full" />
        </div>
        <div className="space-y-2 max-w-md">
          <h3 className="text-lg font-bold text-foreground tracking-tight">Vetting Assessment Ready</h3>
          <p className="text-xs md:text-sm text-muted-foreground font-light leading-relaxed">
            Your CV profile and connected code repositories are consolidated. Launch the CVerify AI Vetting Engine to compile your Skill Tree, calibrate your Trust Score, and generate your Professional Evaluation.
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

      <RequiredFieldsMissingModal
        isOpen={isPrereqModalOpen}
        onOpenChange={setIsPrereqModalOpen}
        missingFields={readiness.missingFields}
        onProceedAnyway={triggerVettingEngine}
        isProceeding={isTriggering}
      />
    </>
  );
}
