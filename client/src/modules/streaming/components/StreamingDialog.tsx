import React, { useMemo, useEffect, useState } from "react";
import { Modal, Button, Spinner, ProgressBar } from "@heroui/react";
import {
  X,
  XCircle,
  AlertCircle,
  AlertTriangle,
  LayoutDashboard,
  Share2,
  Terminal as TerminalIcon,
  Coins,
  Sparkles,
  Clock,
  Activity,
  CheckCircle2,
  Cpu
} from "lucide-react";
import { useStreamingStore } from "../use-streaming-store";
import { pipelineRegistry } from "../registry";
import { BentoGridDashboard } from "./BentoGridDashboard";
import { TrustGraphView } from "./TrustGraphView";
import { CvSummaryView } from "./CvSummaryView";
import { CostObservability } from "./CostObservability";
import { StreamingTimeline } from "./StreamingTimeline";
import { StreamingLogConsole } from "./StreamingLogConsole";

export function StreamingDialog() {
  const {
    isModalOpen,
    closeModal,
    activeSession,
    stages,
    logs,
    elapsedMs,
    isConnecting,
    logsSearchQuery,
    logsLevelFilter,
    autoScroll,
    errorMessage,
    validationError,
    partialSnapshot,
    costs,
    isRetryingTaskId,
    viewMode,
    setLogsSearchQuery,
    setLogsLevelFilter,
    setAutoScroll,
    disconnect,
    retryStage,
    setViewMode,
    triggerReanalyze,
  } = useStreamingStore();

  const [localClock, setLocalClock] = useState("00:00");

  const registryDef = useMemo(() => {
    if (!activeSession) return null;
    return pipelineRegistry.get(activeSession.pipelineId);
  }, [activeSession?.pipelineId]);

  const report = useMemo(() => {
    if (!activeSession?.summaryData) return partialSnapshot || null;
    try {
      return typeof activeSession.summaryData === "string" 
        ? JSON.parse(activeSession.summaryData) 
        : activeSession.summaryData;
    } catch (e) {
      console.warn("Failed to parse summaryData in dialog:", e);
      return partialSnapshot || null;
    }
  }, [activeSession?.summaryData, partialSnapshot]);

  // Live Runtime Clock
  const formatDuration = (ms: number): string => {
    if (ms < 0) ms = 0;
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, "0")}m ${secs.toString().padStart(2, "0")}s`;
  };

  useEffect(() => {
    if (!activeSession || activeSession.status !== "Running") return;
    const interval = setInterval(() => {
      const start = activeSession.startedAt
        ? new Date(activeSession.startedAt).getTime()
        : new Date(activeSession.createdAtUtc || Date.now()).getTime();
      setLocalClock(formatDuration(Date.now() - start));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeSession?.status, activeSession?.startedAt, activeSession?.createdAtUtc]);

  const displayElapsedTime = useMemo(() => {
    if (activeSession && activeSession.status !== "Running") {
      if (activeSession.startedAt && activeSession.completedAt) {
        const diff = new Date(activeSession.completedAt).getTime() - new Date(activeSession.startedAt).getTime();
        return formatDuration(diff);
      }
      const totalMs = stages.reduce((sum, s) => sum + (s.durationMs || 0), 0);
      if (totalMs > 0) return formatDuration(totalMs);
    }
    return formatDuration(elapsedMs) !== "00m 00s" ? formatDuration(elapsedMs) : localClock;
  }, [activeSession, elapsedMs, localClock, stages]);

  const handleDownloadLogs = () => {
    if (!activeSession) return;
    const logText = logs
      .map(l => `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.component || "SYS"}] [${l.logLevel.toUpperCase()}] ${l.message}`)
      .join("\n");

    const blob = new Blob([logText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeSession.pipelineId}_session_${activeSession.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyLogs = () => {
    const logText = logs
      .map(l => `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.component || "SYS"}] [${l.logLevel.toUpperCase()}] ${l.message}`)
      .join("\n");
    navigator.clipboard.writeText(logText);
  };

  if (!isModalOpen || !activeSession) return null;

  const enabledTabs = registryDef?.enabledTabs || ["dashboard", "logs", "costs"];
  const isTerminal = ["Completed", "Failed", "Cancelled"].includes(activeSession.status);
  const showTabs = isTerminal || report;

  // Telemetry Variables
  const commitsCount = report?.facts?.git_metrics?.total_commits ?? 0;
  const contributorsCount = report?.facts?.git_metrics?.active_contributors ?? 1;
  const totalCost = activeSession.totalCostUsd || 0;
  const totalTokens = (activeSession.totalInputTokens || 0) + (activeSession.totalOutputTokens || 0);

  return (
    <Modal.Backdrop
      isOpen={isModalOpen}
      onOpenChange={(open) => { if (!open) closeModal(); }}
      className="bg-overlay/5 backdrop-blur-md animate-in fade-in duration-200 z-100"
    >
      <Modal.Container placement="center" scroll="inside">
        <Modal.Dialog 
          aria-label="AI Pipeline Execution Monitoring"
          className="w-full max-w-6xl bg-overlay border border-border rounded-2xl shadow-modal p-6 text-left relative focus-visible:outline-hidden focus:outline-hidden max-h-[95vh] flex flex-col justify-between animate-in zoom-in-95 duration-200"
        >
          {/* Close Trigger */}
          <Modal.CloseTrigger
            aria-label="Close dialog"
            className="absolute right-6 top-6 p-1.5 rounded-full hover:bg-surface-secondary text-muted hover:text-foreground cursor-pointer transition-colors z-10"
            onPress={closeModal}
          >
            <X size={16} />
          </Modal.CloseTrigger>

          {/* Modal Header */}
          <div className="pr-10 flex flex-col gap-3 border-b border-border/20 pb-4 shrink-0">
            <div className="outline-hidden text-left w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] text-accent uppercase font-extrabold tracking-wider block mb-1">
                  AI Pipeline Execution Monitor
                </span>
                <span className="font-extrabold text-foreground font-display select-all text-xl block">
                  {registryDef?.displayName || activeSession.pipelineId}
                </span>
              </div>

              {/* View Mode Tabs */}
              {showTabs && (
                <div className="flex gap-1 bg-surface-secondary border border-border/80 rounded-xl p-1 shrink-0 font-sans">
                  {enabledTabs.includes("dashboard") && (
                    <Button
                      size="sm"
                      onClick={() => setViewMode("report")}
                      className={`rounded-lg px-3.5 py-1 text-xs font-bold ${viewMode === "report"
                        ? "bg-background text-foreground shadow-sm"
                        : "bg-transparent text-muted hover:text-foreground"
                      }`}
                    >
                      <LayoutDashboard size={13} className="mr-1" />
                      Dashboard
                    </Button>
                  )}
                  {enabledTabs.includes("graph") && (
                    <Button
                      size="sm"
                      onClick={() => setViewMode("graph")}
                      className={`rounded-lg px-3.5 py-1 text-xs font-bold ${viewMode === "graph"
                        ? "bg-background text-foreground shadow-sm"
                        : "bg-transparent text-muted hover:text-foreground"
                      }`}
                    >
                      <Share2 size={13} className="mr-1" />
                      Trust Graph
                    </Button>
                  )}
                  {enabledTabs.includes("logs") && (
                    <Button
                      size="sm"
                      onClick={() => setViewMode("logs")}
                      className={`rounded-lg px-3.5 py-1 text-xs font-bold ${viewMode === "logs"
                        ? "bg-background text-foreground shadow-sm"
                        : "bg-transparent text-muted hover:text-foreground"
                      }`}
                    >
                      <TerminalIcon size={13} className="mr-1" />
                      Traces & Logs
                    </Button>
                  )}
                  {enabledTabs.includes("costs") && (
                    <Button
                      size="sm"
                      onClick={() => setViewMode("costs")}
                      className={`rounded-lg px-3.5 py-1 text-xs font-bold ${viewMode === "costs"
                        ? "bg-background text-foreground shadow-sm"
                        : "bg-transparent text-muted hover:text-foreground"
                      }`}
                    >
                      <Coins size={13} className="mr-1" />
                      Cost Metrics
                    </Button>
                  )}
                  {enabledTabs.includes("cv") && report?.cvSynthesis && (
                    <Button
                      size="sm"
                      onClick={() => setViewMode("cv")}
                      className={`rounded-lg px-3.5 py-1 text-xs font-bold ${viewMode === "cv"
                        ? "bg-background text-foreground shadow-sm"
                        : "bg-transparent text-muted hover:text-foreground"
                      }`}
                    >
                      <Sparkles size={13} className="mr-1" />
                      CV Summary
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Top Telemetry Summary Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 w-full bg-surface-secondary/40 border border-border/40 rounded-2xl p-3 text-[11px] font-mono text-muted-foreground">
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] text-muted font-bold uppercase tracking-wider font-sans">
                  Status
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {activeSession.status === "Pending" ? (
                    <>
                      <Spinner size="sm" color="warning" className="scale-65 shrink-0" />
                      <span className="text-warning font-extrabold capitalize text-[10px]">Queued</span>
                    </>
                  ) : activeSession.status === "Connecting" ? (
                    <>
                      <Spinner size="sm" color="current" className="scale-65 shrink-0" />
                      <span className="text-muted font-extrabold capitalize text-[10px]">Connecting</span>
                    </>
                  ) : activeSession.status === "Running" ? (
                    <>
                      <Spinner size="sm" color="warning" className="scale-65 shrink-0" />
                      <span className="text-warning font-extrabold capitalize text-[10px]">Running</span>
                    </>
                  ) : activeSession.status === "Completed" ? (
                    <>
                      <CheckCircle2 size={12} className="text-success shrink-0" />
                      <span className="text-success font-extrabold capitalize text-[10px]">Complete</span>
                    </>
                  ) : activeSession.status === "Failed" ? (
                    <>
                      <AlertTriangle size={12} className="text-danger shrink-0" />
                      <span className="text-danger font-extrabold capitalize text-[10px]">Failed</span>
                    </>
                  ) : activeSession.status === "Cancelled" ? (
                    <>
                      <AlertCircle size={12} className="text-muted shrink-0" />
                      <span className="text-muted-foreground font-bold capitalize text-[10px]">Cancelled</span>
                    </>
                  ) : (
                    <span className="text-foreground/80 font-bold capitalize text-[10px]">
                      {activeSession.status}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] text-muted font-bold uppercase tracking-wider font-sans">
                  Current Stage
                </span>
                <span className="text-foreground font-bold truncate block mt-0.5 text-[10px]">
                  {activeSession.status === "Running"
                    ? (registryDef?.stages.find(s => s.id === activeSession.currentStep)?.name || activeSession.currentStep || "Executing")
                    : isTerminal
                      ? "Execution Finished"
                      : "Idle"}
                </span>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] text-muted font-bold uppercase tracking-wider font-sans">
                  Elapsed Time
                </span>
                <div className="flex items-center gap-1 mt-0.5 text-foreground font-bold text-[10px]">
                  <Clock size={11} className="text-muted shrink-0" />
                  <span>{displayElapsedTime}</span>
                </div>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] text-muted font-bold uppercase tracking-wider font-sans">
                  Git Metrics
                </span>
                <span className="text-foreground font-bold mt-0.5 text-[10px]">
                  {registryDef?.gitMetricsSupported && report ? `${commitsCount} commits / ${contributorsCount} auths` : "N/A"}
                </span>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] text-muted font-bold uppercase tracking-wider font-sans">
                  Total Cost
                </span>
                <div className="flex items-center gap-1 mt-0.5 text-success font-bold text-[10px]">
                  <Coins size={11} className="text-success shrink-0" />
                  <span>${totalCost.toFixed(5)}</span>
                </div>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] text-muted font-bold uppercase tracking-wider font-sans">
                  Total Tokens
                </span>
                <span className="text-foreground font-bold mt-0.5 text-[10px]">
                  {totalTokens.toLocaleString()}
                </span>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] text-muted font-bold uppercase tracking-wider font-sans">
                  AI Model
                </span>
                <span className="text-foreground font-bold truncate block mt-0.5 text-[10px] capitalize">
                  {activeSession.modelName ? activeSession.modelName.replace("claude-3-", "") : "Claude Sonnet"}
                </span>
              </div>
            </div>

            {/* Overall Job Progress Ticker */}
            {!isTerminal && (
              <div className="w-full space-y-1 mt-1 font-mono text-[10px] text-muted-foreground">
                <div className="flex justify-between items-center">
                  <span>Pipeline Execution Progress</span>
                  <div className="flex items-center gap-2">
                    <span className="text-accent font-bold">{Math.round(activeSession.progress)}%</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[10px] font-extrabold uppercase rounded-lg border-danger/30 hover:bg-danger/10 text-danger cursor-pointer"
                      onClick={disconnect}
                    >
                      <XCircle size={10} className="shrink-0" />
                      <span>Stop Analysis</span>
                    </Button>
                  </div>
                </div>
                <ProgressBar
                  aria-label="Overall execution progress"
                  value={activeSession.progress}
                  color="accent"
                  size="sm"
                  className="w-full"
                >
                  <ProgressBar.Track>
                    <ProgressBar.Fill />
                  </ProgressBar.Track>
                </ProgressBar>
              </div>
            )}
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto space-y-6 select-text max-h-[60vh] py-2">
            {viewMode === "report" && validationError ? (
              <div className="flex flex-col items-center justify-center p-8 border border-danger/20 bg-danger/5 rounded-2xl text-left select-text min-h-[350px]">
                <AlertTriangle className="size-12 text-danger mb-4 shrink-0 animate-bounce" />
                <h3 className="text-lg font-extrabold text-foreground mb-2">Repository Intelligence Diagnostic Failure</h3>
                <p className="text-xs text-muted-foreground mb-6 max-w-lg leading-relaxed text-center font-sans">
                  The AI analysis response failed to validate against the strict schema contract. This safety boundary prevents rendering corrupted or partial data in the UI.
                </p>
                <div className="flex gap-3 mb-6">
                  {registryDef?.reanalyzeSupported && (
                    <Button
                      size="sm"
                      variant="danger"
                      className="rounded-xl font-bold px-4 text-xs"
                      onClick={triggerReanalyze}
                    >
                      Reanalyze Repository
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl font-bold px-4 text-xs border-border/40"
                    onClick={closeModal}
                  >
                    Dismiss
                  </Button>
                </div>
                <details className="w-full bg-background border border-border rounded-2xl p-4 overflow-hidden">
                  <summary className="text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer">
                    View Debug Diagnostics & Schema Errors
                  </summary>
                  <div className="mt-3 font-mono text-[10px] text-danger max-h-[220px] overflow-y-auto whitespace-pre-wrap select-all">
                    {validationError}
                  </div>
                </details>
              </div>
            ) : isConnecting && !report && stages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[300px] gap-4">
                <Spinner size="lg" />
                <span className="text-muted text-xs font-sans">
                  Initializing execution progress monitor...
                </span>
              </div>
            ) : viewMode === "report" && report ? (
              registryDef?.renderers?.Dashboard ? (
                <registryDef.renderers.Dashboard report={report} isLive={!isTerminal} />
              ) : (
                <BentoGridDashboard report={report} />
              )
            ) : viewMode === "graph" && report ? (
              registryDef?.renderers?.TrustGraph ? (
                <registryDef.renderers.TrustGraph report={report} />
              ) : (
                <TrustGraphView report={report} />
              )
            ) : viewMode === "costs" ? (
              <CostObservability
                activeSession={activeSession}
                stages={stages}
                costs={costs}
                isLoading={costs === null && registryDef?.actions?.fetchCosts !== undefined}
              />
            ) : viewMode === "cv" && report ? (
              registryDef?.renderers?.CvSummary ? (
                <registryDef.renderers.CvSummary report={report} />
              ) : (
                <CvSummaryView report={report} />
              )
            ) : (
              /* Traces & Logs View */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[450px]">
                {/* Left stages timeline */}
                <div className="lg:col-span-5 space-y-4">
                  <StreamingTimeline
                    stages={stages}
                    onRetry={retryStage}
                    isRetryingStageId={isRetryingTaskId}
                    isJobRunning={!isTerminal}
                  />
                </div>

                {/* Right streaming logs console */}
                <div className="lg:col-span-7 flex flex-col min-h-[450px] h-full">
                  <StreamingLogConsole
                    logs={logs}
                    logsSearchQuery={logsSearchQuery}
                    logsLevelFilter={logsLevelFilter}
                    autoScroll={autoScroll}
                    onSearchChange={setLogsSearchQuery}
                    onLevelFilterChange={setLogsLevelFilter}
                    onAutoScrollChange={setAutoScroll}
                    onCopyLogs={handleCopyLogs}
                    onDownloadLogs={handleDownloadLogs}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t border-separator shrink-0">
            <Button
              onClick={closeModal}
              className="rounded-xl text-xs font-semibold px-4 h-9"
            >
              Close
            </Button>
          </div>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
