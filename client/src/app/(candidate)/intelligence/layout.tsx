"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Award,
  Sparkles,
  GitFork,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  RotateCw,
  Clock
} from "lucide-react";
import { Button, Spinner, Chip } from "@heroui/react";
import { useAssessment } from "@/providers/assessment-provider";
import { RequiredFieldsMissingModal } from "@/components/ui/RequiredFieldsMissingModal";

export default function IntelligenceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    latestAssessment,
    readiness,
    isLoadingLatest,
    isLoadingReadiness,
    triggerAssessment,
    isTriggering,
    streamStatus
  } = useAssessment();

  const [isPrereqModalOpen, setIsPrereqModalOpen] = React.useState(false);

  // 1. Loading Skeleton / Spinner
  if (isLoadingLatest && !latestAssessment) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Spinner size="lg" color="accent" />
        <p className="text-sm text-muted-foreground font-light">Loading intelligence metrics...</p>
      </div>
    );
  }

  // 2. Unassessed candidates do not render the layout header/tabs, they just render the empty state directly
  if (!latestAssessment) {
    return <div className="w-full">{children}</div>;
  }

  const activeTab = pathname || "/intelligence/skill-tree";

  const tabs = [
    { id: "/intelligence/skill-tree", label: "Skill Tree", icon: GitFork },
    { id: "/intelligence/trust-score", label: "Trust Score", icon: ShieldCheck },
    { id: "/intelligence/ai-analysis", label: "AI Analysis", icon: Sparkles },
    { id: "/settings/source-code-providers", label: "Repositories", icon: GitFork },
  ];

  const handleReassess = async () => {
    if (readiness && readiness.missingFields && readiness.missingFields.length > 0) {
      setIsPrereqModalOpen(true);
      return;
    }
    await handleForceReassess();
  };

  const handleForceReassess = async () => {
    try {
      await triggerAssessment();
    } catch (err) {
      console.error("Failed to re-run assessment:", err);
    }
  };

  // Determine current lifecycle state
  const isRunning =
    latestAssessment.status === "Running" ||
    latestAssessment.status === "Queued" ||
    streamStatus === "streaming" ||
    streamStatus === "connecting";

  const isFailed = latestAssessment.status === "Failed";
  const isOutdated = readiness?.requiresReassessment && latestAssessment.status === "Completed";
  const isReady = latestAssessment.status === "Completed" && !readiness?.requiresReassessment;

  const getStatusBadge = () => {
    if (isRunning) {
      return (
        <Chip
          size="sm"
          color="warning"
          variant="soft"
          className="text-[10px] font-black uppercase tracking-wider px-2.5 h-6 animate-pulse"
        >
          Analyzing Profile
        </Chip>
      );
    }
    if (isFailed) {
      return (
        <Chip
          size="sm"
          color="danger"
          variant="soft"
          className="text-[10px] font-black uppercase tracking-wider px-2.5 h-6"
        >
          Vetting Failed
        </Chip>
      );
    }
    if (isOutdated) {
      return (
        <Chip
          size="sm"
          color="warning"
          variant="soft"
          className="text-[10px] font-black uppercase tracking-wider px-2.5 h-6 border border-warning/30"
        >
          Outdated (Updates Detected)
        </Chip>
      );
    }
    return (
      <Chip
        size="sm"
        color="success"
        variant="soft"
        className="text-[10px] font-black uppercase tracking-wider px-2.5 h-6 border border-success/30 text-success"
      >
        Verified & Up-to-date
      </Chip>
    );
  };

  // Format date
  const lastAssessedDate = latestAssessment.completedAtUtc
    ? new Date(latestAssessment.completedAtUtc).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-6 font-sans select-none">
      {/* 1. Shared Summary Banner Header */}
      <div className="p-6 md:p-8 border border-border/50 bg-surface rounded-2xl flex flex-col md:flex-row gap-6 items-center shadow-xs relative overflow-hidden text-left">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-linear-to-r from-accent/10 via-accent/30 to-accent/10" />

        {/* Circular Dial Overall Score */}
        <div className="relative size-24 flex items-center justify-center shrink-0 bg-surface-secondary/40 rounded-full border border-border/50 p-3">
          <svg className="size-full -rotate-90" viewBox="0 0 36 36">
            <path
              className="text-border/10"
              strokeWidth="2.5"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className="text-accent transition-all duration-500 ease-out"
              strokeDasharray={`${latestAssessment.overallScore || 0}, 100`}
              strokeWidth="3.0"
              strokeLinecap="round"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <div className="absolute flex flex-col items-center text-center">
            <span className="text-xl font-black text-foreground tracking-tight">
              {Math.round(latestAssessment.overallScore || 0)}
            </span>
            <span className="text-[7px] text-muted-foreground uppercase font-extrabold tracking-wider mt-0.5">Calibrated</span>
          </div>
        </div>

        {/* Info Fields */}
        <div className="flex-1 flex flex-col gap-2 min-w-0 text-center md:text-left">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
            <h2 className="text-xl font-extrabold text-foreground tracking-tight">AI Candidate Intelligence</h2>
            {getStatusBadge()}
          </div>
          <p className="text-xs text-muted-foreground font-light leading-relaxed max-w-2xl">
            {latestAssessment.summaryHeadline || "AI calibrated software engineer intelligence profile verified through commit telemetry proof."}
          </p>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-1.5 text-[10px] text-muted-foreground font-semibold">
            {latestAssessment.careerLevelLabel && (
              <span className="flex items-center gap-1.5">
                <Award size={12} className="text-accent" />
                <span>Level: {latestAssessment.careerLevelLabel}</span>
              </span>
            )}
            {latestAssessment.primaryTendency && (
              <span className="flex items-center gap-1.5">
                <TrendingUp size={12} className="text-accent" />
                <span>Affinity: {latestAssessment.primaryTendency}</span>
              </span>
            )}
            {lastAssessedDate && (
              <span className="flex items-center gap-1.5">
                <Clock size={12} className="text-accent" />
                <span>Evaluated: {lastAssessedDate}</span>
              </span>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="shrink-0 self-center md:self-auto">
          <Button
            size="sm"
            variant="secondary"
            className="rounded-xl font-bold text-xs border border-border/30 hover:bg-surface-secondary h-9 w-fit flex items-center gap-1.5 cursor-pointer"
            onPress={handleReassess}
            isDisabled={isRunning || isTriggering}
          >
            {isTriggering ? (
              <Spinner size="sm" color="current" className="shrink-0" />
            ) : (
              <RotateCw size={13} className="shrink-0" />
            )}
            <span>{isTriggering ? "Initializing..." : isOutdated ? "Update Assessment" : "Re-run Vetting"}</span>
          </Button>
        </div>
      </div>

      {/* Outdated Alert Banner */}
      {isOutdated && (
        <div className="p-3 bg-warning/5 border border-warning/20 rounded-xl flex items-center gap-2 text-xs text-warning-foreground font-medium text-left">
          <AlertTriangle size={15} className="text-warning shrink-0" />
          <span>Profile changes detected (CV updates or repository scans completed). Click "Update Assessment" above to recalculate your vetting metrics.</span>
        </div>
      )}

      {/* 2. Subpage Tab Navigation */}
      <div className="flex border-b border-border/30 bg-background/50 backdrop-blur-xs gap-1.5 pb-0.5 overflow-x-auto select-none scrollbar-none shrink-0 text-left">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id || (tab.id !== "/settings/source-code-providers" && activeTab.startsWith(tab.id));
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => router.push(tab.id)}
              className={`px-4 py-2 border-b-2 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer bg-transparent ${
                isActive
                  ? "border-accent text-accent font-extrabold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <TabIcon size={13} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Render page children */}
      <div className="w-full min-h-[400px]">{children}</div>

      {readiness && (
        <RequiredFieldsMissingModal
          isOpen={isPrereqModalOpen}
          onOpenChange={setIsPrereqModalOpen}
          missingFields={readiness.missingFields}
          onProceedAnyway={handleForceReassess}
          isProceeding={isTriggering}
        />
      )}
    </div>
  );
}
