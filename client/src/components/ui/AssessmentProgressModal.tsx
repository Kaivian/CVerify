"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle
} from "lucide-react";
import {
  Button,
  Spinner,
  ProgressBar,
  Chip
} from "@heroui/react";
import { useAssessment } from "@/providers/assessment-provider";

export function AssessmentProgressModal() {
  const router = useRouter();
  const {
    isProgressModalOpen,
    setIsProgressModalOpen,
    setHasClosedProgressModal,
    streamStatus,
    streamProgress,
    streamStep,
    streamMessage,
    realtimeScore,
    realtimeLevelLabel,
    realtimeDimensions,
    realtimeSignals,
    realtimeRecommendations,
    latestAssessment,
    stages,
    triggerAssessment,
    disconnectProgressStream
  } = useAssessment();

  if (!isProgressModalOpen) return null;

  // Build timeline stages dynamically with fallback support for unknown step IDs
  const timelineStages = [...stages];
  if (
    streamStep &&
    streamStep !== "Completed" &&
    streamStep !== "Failed" &&
    streamStep !== "Initializing" &&
    !timelineStages.some((s) => s.id === streamStep)
  ) {
    timelineStages.push({
      id: streamStep,
      name: `Stage: ${streamStep}`,
      description: streamMessage || "Executing custom assessment pipeline stage..."
    });
  }

  const getStageStatus = (stageId: string): "Completed" | "Failed" | "Running" | "Queued" => {
    if (streamStatus === "completed") {
      return "Completed";
    }

    const stepIds = timelineStages.map((s) => s.id);
    const activeIndex = stepIds.indexOf(streamStep);
    const stageIndex = stepIds.indexOf(stageId);

    if (streamStatus === "failed") {
      if (stageId === streamStep) {
        return "Failed";
      }
      if (activeIndex !== -1 && stageIndex < activeIndex) {
        return "Completed";
      }
      return "Queued";
    }

    if (stageId === streamStep) {
      return "Running";
    }
    if (activeIndex !== -1 && stageIndex < activeIndex) {
      return "Completed";
    }
    return "Queued";
  };

  const getStatusIcon = (status: "Completed" | "Failed" | "Running" | "Queued") => {
    switch (status) {
      case "Completed":
        return <CheckCircle2 className="size-4 text-success shrink-0" />;
      case "Failed":
        return <XCircle className="size-4 text-danger shrink-0" />;
      case "Running":
        return <Spinner size="sm" color="warning" className="shrink-0" />;
      case "Queued":
      default:
        return <Clock className="size-4 text-muted shrink-0" />;
    }
  };

  const isRunningOrQueued = streamStatus === "connecting" || streamStatus === "streaming";
  const failedStage = streamStep || latestAssessment?.failedStage || "Unknown";
  const failureReason = streamMessage || latestAssessment?.failureReason || "Connection to assessment progress lost.";

  const handleMinimize = () => {
    setIsProgressModalOpen(false);
    setHasClosedProgressModal(true);
  };

  const handleCloseAndCancel = () => {
    setIsProgressModalOpen(false);
    disconnectProgressStream();
  };

  const handleOpenDashboard = () => {
    setIsProgressModalOpen(false);
    router.push("/intelligence/ai-analysis");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-[620px] max-h-[90vh] border border-border/85 bg-surface text-foreground shadow-2xl rounded-2xl flex flex-col overflow-hidden text-left p-6 relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/20 pb-3 shrink-0">
          <span className="font-extrabold text-sm uppercase tracking-wide text-foreground flex items-center gap-2">
            <Sparkles className="size-4 text-accent animate-pulse" />
            AI Profile Evaluation
          </span>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            className="rounded-xl border border-border/30 h-8 w-8 min-w-8"
            onPress={handleMinimize}
            aria-label="Minimize modal"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-4 min-h-0 scrollbar-thin scrollbar-thumb-border">
          <div className="flex flex-col gap-1 text-center py-2 shrink-0">
            <span className="text-sm font-extrabold text-foreground">
              {streamStatus === "connecting"
                ? "Connecting to Evaluation Stream..."
                : streamStatus === "streaming"
                ? "Analyzing Codebase & Calibrating Profile..."
                : streamStatus === "completed"
                ? "Evaluation Completed!"
                : streamStatus === "failed"
                ? "Evaluation Failed"
                : "Idle"}
            </span>
            <span className="text-xs text-muted-foreground line-clamp-2 min-h-[32px]">
              {streamMessage || "Starting background evaluation..."}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-surface-secondary/50 rounded-full h-2.5 overflow-hidden shrink-0">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                streamStatus === "failed"
                  ? "bg-danger"
                  : streamStatus === "completed"
                  ? "bg-success"
                  : "bg-accent"
              }`}
              style={{ width: `${streamProgress}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground shrink-0 font-bold">
            <span>ACTIVE STAGE: {streamStep || "FETCH_ARTIFACTS"}</span>
            <span>{Math.round(streamProgress)}% (Stage Completion)</span>
          </div>
          <span className="text-[9px] text-muted-foreground/80 italic shrink-0 -mt-2">
            *Progress bar represents stage completion milestones. AI processing on active stage may require extra processing time.
          </span>

          {/* Real-Time Live Scorecard Card */}
          {(realtimeScore !== null || realtimeLevelLabel !== null || Object.keys(realtimeDimensions).length > 0) && (
            <div className="p-4 border border-border/80 bg-surface-secondary/30 rounded-2xl flex flex-col gap-3 shrink-0 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground font-black uppercase tracking-wider">Live Evaluation Vector</span>
                {realtimeLevelLabel && (
                  <Chip size="sm" color="accent" variant="soft" className="text-[10px] font-black uppercase px-2 h-5.5 bg-accent/15 text-accent border-none">
                    {realtimeLevelLabel}
                  </Chip>
                )}
              </div>
              <div className="w-full h-px bg-border/5" />
              <div className="flex items-center justify-between gap-4">
                {realtimeScore !== null && (
                  <div className="flex flex-col items-center justify-center p-3 border border-border/45 bg-surface rounded-2xl shrink-0 min-w-[90px]">
                    <span className="text-[9px] text-muted-foreground uppercase font-black tracking-wide">Live Score</span>
                    <span className="text-2xl font-black text-foreground">{Math.round(realtimeScore)}</span>
                  </div>
                )}
                {/* Real-time Dimensions list */}
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(realtimeDimensions).map(([dim, val]) => {
                    const dimLabelMap: Record<string, string> = {
                      skillDepth: "Skill Depth",
                      ownership: "Ownership",
                      architecture: "Architecture",
                      problemSolving: "Problem Solving",
                      impact: "Business Impact"
                    };
                    return (
                      <div key={dim} className="flex flex-col border border-border/20 bg-surface-secondary/20 p-2 rounded-xl text-left">
                        <span className="text-[8px] text-muted-foreground font-extrabold uppercase line-clamp-1">{dimLabelMap[dim] || dim}</span>
                        <span className="text-xs font-black text-foreground">{val}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Real-Time Observations / Gaps */}
              {realtimeSignals.length > 0 && (
                <div className="flex flex-col gap-1.5 mt-1 border-t border-border/5 pt-2">
                  <span className="text-[9px] text-muted-foreground font-black uppercase">Detected Gaps</span>
                  <div className="flex flex-wrap gap-1.5">
                    {realtimeSignals.map((sig, idx) => (
                      <Chip key={idx} size="sm" color="danger" variant="soft" className="text-[8px] font-extrabold uppercase px-1.5 h-4.5 bg-danger/10 text-danger border-none">
                        {sig}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}

              {/* Real-Time Actionable Recommendations */}
              {realtimeRecommendations.length > 0 && (
                <div className="flex flex-col gap-1.5 border-t border-border/5 pt-2">
                  <span className="text-[9px] text-muted-foreground font-black uppercase">Generated Recommendations ({realtimeRecommendations.length})</span>
                  <div className="max-h-[80px] overflow-y-auto flex flex-col gap-1.5 pr-1 scrollbar-thin scrollbar-thumb-border">
                    {realtimeRecommendations.map((rec) => (
                      <div key={rec.id} className="flex items-start gap-2 p-2 border border-border/20 bg-surface rounded-xl text-[10px] leading-relaxed">
                        <Chip size="sm" color={rec.priority === "High" ? "danger" : "warning"} variant="soft" className="text-[8px] font-black uppercase shrink-0 px-1 h-4.5 border-none">
                          {rec.id}
                        </Chip>
                        <span className="font-light text-foreground/80">{rec.action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Detailed Failure Information Card */}
          {streamStatus === "failed" && (
            <div className="p-4 border border-danger/30 bg-danger/5 rounded-xl space-y-3 shrink-0">
              <div className="flex items-center gap-2 text-danger">
                <AlertTriangle className="size-5 shrink-0" />
                <span className="font-extrabold text-sm uppercase tracking-wide">Evaluation Failed</span>
              </div>
              <div className="space-y-2 text-xs leading-relaxed text-foreground/90">
                <p>
                  <strong>Failed Stage:</strong> <span className="font-mono text-danger bg-danger/10 px-1 py-0.5 rounded text-[10px]">{failedStage}</span>
                </p>
                <p>
                  <strong>Error Message:</strong> <span className="text-muted-foreground">{failureReason}</span>
                </p>
                <div className="border-t border-danger/10 pt-2 mt-2 text-muted-foreground">
                  <strong className="text-foreground">Retry Guidance:</strong>
                  <ul className="list-disc pl-4 mt-1 space-y-1 text-[11px]">
                    <li>Ensure your linked source code repositories have completed their initial scanning.</li>
                    <li>Check that your GitHub integration credentials are still valid.</li>
                    <li>Ensure you have a reliable network connection and click "Retry Assessment" below.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Completion Summary Card */}
          {streamStatus === "completed" && latestAssessment && (
            <div className="p-4 border border-success/30 bg-success/5 rounded-xl space-y-3 shrink-0">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="size-5 shrink-0" />
                <span className="font-extrabold text-sm uppercase tracking-wide">Synthesis Complete</span>
              </div>
              <div className="space-y-2 text-xs leading-relaxed text-foreground/90">
                {latestAssessment.careerLevelLabel && latestAssessment.primaryTendency && (
                  <p>
                    <strong>Calibrated Profile:</strong> {latestAssessment.careerLevelLabel} ({latestAssessment.primaryTendency} specialization)
                  </p>
                )}
                {latestAssessment.summaryHeadline && (
                  <p>
                    <strong>Headline:</strong> <span className="text-foreground font-semibold">"{latestAssessment.summaryHeadline}"</span>
                  </p>
                )}
                {latestAssessment.summaryParagraph && (
                  <p className="text-muted-foreground line-clamp-3 italic pt-1 border-t border-success/10">
                    "{latestAssessment.summaryParagraph}"
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Visual Timeline of Stages */}
          <div className="flex flex-col gap-4 border-t border-border/10 pt-4">
            <span className="text-[10px] text-muted uppercase font-bold tracking-wider select-none mb-1">
              Evaluation Timeline
            </span>
            <div className="relative pl-1">
              {/* Vertical line indicator */}
              <div className="absolute left-[13.5px] top-3 bottom-3 w-[1.5px] bg-border/40" />

              <div className="flex flex-col gap-4">
                {timelineStages.map((stage) => {
                  const status = getStageStatus(stage.id);

                  return (
                    <div key={stage.id} className="relative pl-10 min-h-[28px] flex flex-col justify-center">
                      {/* Status Icon Wrapper */}
                      <div className="absolute left-0 top-0 size-7 flex items-center justify-center bg-background rounded-full border border-border/10 shadow-xs z-10">
                        {getStatusIcon(status)}
                      </div>

                      {/* Content Block */}
                      {status === "Running" ? (
                        <div className="p-4 border border-warning/60 bg-warning/5 dark:bg-warning/10 rounded-2xl flex flex-col gap-2 shadow-xs transition-all duration-300">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-extrabold text-xs text-warning">
                              {stage.name}
                            </span>
                            <span className="text-[8px] font-black uppercase text-warning bg-warning/15 px-2 py-0.5 rounded-md tracking-wider animate-pulse">
                              Running
                            </span>
                          </div>
                          <p className="text-[10px] text-foreground/90 leading-relaxed font-light">
                            {stage.description}
                          </p>
                          {streamMessage && (
                            <div className="mt-1 font-mono text-[9px] text-warning/90 bg-warning/10 p-2.5 rounded-xl border border-warning/20 break-all leading-normal">
                              &gt; {streamMessage}
                            </div>
                          )}
                          <div className="w-full mt-1">
                            <ProgressBar
                              aria-label={`${stage.name} progress`}
                              value={streamProgress}
                              color="warning"
                              size="sm"
                              className="w-full"
                            />
                          </div>
                        </div>
                      ) : status === "Failed" ? (
                        <div className="p-4 border border-danger/50 bg-danger/5 dark:bg-danger/10 rounded-2xl flex flex-col gap-2 transition-all duration-300">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-extrabold text-xs text-danger">
                              {stage.name}
                            </span>
                            <span className="text-[8px] font-black uppercase text-danger bg-danger/15 px-2 py-0.5 rounded-md tracking-wider">
                              Failed
                            </span>
                          </div>
                          <p className="text-[10px] text-foreground/90 leading-relaxed font-light">
                            {stage.description}
                          </p>
                          {streamMessage && (
                            <div className="mt-1 font-mono text-[9px] text-danger bg-danger/10 p-2.5 rounded-xl border border-danger/20 break-all leading-normal">
                              {streamMessage}
                            </div>
                          )}
                        </div>
                      ) : status === "Completed" ? (
                        <div className="flex flex-col gap-0.5 min-w-0 pl-1 py-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-xs text-foreground/90">
                              {stage.name}
                            </span>
                            <span className="text-[8px] font-black uppercase text-success bg-success/10 px-1.5 py-0.5 rounded-md tracking-wider">
                              Completed
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground font-light leading-relaxed max-w-[95%]">
                            {stage.description}
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-0.5 min-w-0 pl-1 py-1 opacity-60 hover:opacity-100 transition-opacity duration-150">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-muted-foreground">
                              {stage.name}
                            </span>
                            <span className="text-[8px] font-bold uppercase text-muted bg-surface-secondary px-1.5 py-0.5 rounded-md tracking-wider">
                              Queued
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border/20 pt-4 flex gap-2 justify-end shrink-0">
          {streamStatus === "completed" && (
            <Button
              size="sm"
              className="bg-accent text-accent-foreground font-bold rounded-xl border-none cursor-pointer"
              onPress={handleOpenDashboard}
            >
              Open Dashboard
            </Button>
          )}
          {streamStatus === "failed" && (
            <Button
              size="sm"
              className="bg-accent text-accent-foreground font-bold rounded-xl border-none cursor-pointer"
              onPress={triggerAssessment}
            >
              Retry Assessment
            </Button>
          )}
          {isRunningOrQueued && (
            <Button
              size="sm"
              variant="secondary"
              className="rounded-xl font-bold border-border/30 cursor-pointer animate-pulse"
              onPress={handleMinimize}
            >
              Run in Background
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            className="rounded-xl font-bold border-border/30 cursor-pointer"
            onPress={handleCloseAndCancel}
          >
            Cancel Stream
          </Button>
        </div>
      </div>
    </div>
  );
}
