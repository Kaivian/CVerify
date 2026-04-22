import React from "react";
import { Button, Chip, Spinner, ProgressBar } from "@heroui/react";
import { CheckCircle2, XCircle, Clock, AlertTriangle, RefreshCw, Cpu } from "lucide-react";
import type { AnalysisTask } from "@/types/repository-analysis.types";

interface AnalysisTaskTimelineProps {
  tasks: AnalysisTask[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onRetryTask: (taskId: string) => Promise<void>;
  isRetryingTaskId: string | null;
  isJobRunning: boolean;
}

const FRIENDLY_NAMES: Record<string, string> = {
  RepoStructure: "Workspace Setup & Classification",
  CommitIntelligence: "Commit Ownership & Git Trust",
  SkillExtraction: "Technical Skills Scan",
  ArchitectureAnalysis: "Architecture Design Pattern Scan",
  CodeQuality: "Code Quality & Styling Inspection",
  SecurityAnalysis: "Vulnerability & Security Audit",
  RepositorySummary: "Recruiter Summary & Narrative",
};

const FRIENDLY_DESCRIPTIONS: Record<string, string> = {
  RepoStructure: "Clones the repository branch and runs pre-pipeline repository classification.",
  CommitIntelligence: "Analyzes git commit history, user contributions, and file path ownership ratio.",
  SkillExtraction: "Performs technical skills extraction and technical stack discovery.",
  ArchitectureAnalysis: "Extracts architectural design patterns and software architectural structure.",
  CodeQuality: "Inspects testing frameworks, code practices, observability, and CI/CD pipelines.",
  SecurityAnalysis: "Audits for sensitive credentials, secrets leaks, and known security risks.",
  RepositorySummary: "Constructs the final narrative portfolio summary and career benchmarking statistics.",
};

export const AnalysisTaskTimeline: React.FC<AnalysisTaskTimelineProps> = ({
  tasks,
  selectedTaskId,
  onSelectTask,
  onRetryTask,
  isRetryingTaskId,
  isJobRunning,
}) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Completed":
        return <CheckCircle2 className="size-5 text-success shrink-0" />;
      case "Failed":
        return <XCircle className="size-5 text-danger shrink-0" />;
      case "Running":
      case "Retrying":
        return <Spinner size="sm" color="warning" className="shrink-0" />;
      case "Queued":
      default:
        return <Clock className="size-5 text-muted shrink-0" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Completed":
        return "success" as const;
      case "Failed":
        return "danger" as const;
      case "Running":
      case "Retrying":
        return "warning" as const;
      case "Queued":
      default:
        return "default" as const;
    }
  };

  const formatDuration = (ms?: number) => {
    if (ms === undefined || ms === null) return null;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatCost = (cost?: number) => {
    if (cost === undefined || cost === null || cost === 0) return null;
    return `$${cost.toFixed(4)}`;
  };

  return (
    <div className="flex flex-col gap-6 text-left select-none font-sans">
      <div className="relative border-l border-border/60 pl-6 space-y-8 ml-3 py-1">
        {tasks.map((task) => {
          const isSelected = selectedTaskId === task.id;
          const friendlyName = FRIENDLY_NAMES[task.taskType] || task.taskType;
          const friendlyDesc = FRIENDLY_DESCRIPTIONS[task.taskType] || "";

          return (
            <div key={task.id} className="relative group">
              {/* Vertical line indicator bubble */}
              <div className="absolute left-[-37px] top-1.5 bg-background p-1.5 rounded-full z-10">
                {getStatusIcon(task.status)}
              </div>

              {/* Card body */}
              <div
                onClick={() => onSelectTask(task.id)}
                className={`p-4 border rounded-xl bg-surface-secondary/20 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 select-none ${isSelected
                    ? "border-accent/80 bg-accent/5 shadow-sm"
                    : "border-border/60 hover:bg-surface-secondary/40"
                  }`}
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-foreground">
                      {friendlyName}
                    </span>
                    <Chip
                      size="sm"
                      color={getStatusColor(task.status)}
                      variant="soft"
                      className="text-[9px] font-extrabold uppercase px-1.5 h-4.5"
                    >
                      {task.status}
                    </Chip>
                    {task.retryCount > 0 && (
                      <Chip
                        size="sm"
                        color="default"
                        variant="soft"
                        className="text-[9px] font-bold h-4.5 px-1"
                      >
                        Retry #{task.retryCount}
                      </Chip>
                    )}
                  </div>

                  <p className="text-xs text-muted leading-relaxed font-light">
                    {friendlyDesc}
                  </p>

                  {/* Task specific progress bar */}
                  {task.status === "Running" && (
                    <div className="w-full max-w-xs mt-2">
                      <ProgressBar
                        aria-label={`${task.taskType} progress`}
                        value={task.progress}
                        color="warning"
                        size="sm"
                        className="w-full"
                      >
                        <ProgressBar.Track>
                          <ProgressBar.Fill />
                        </ProgressBar.Track>
                      </ProgressBar>
                    </div>
                  )}

                  {/* Completed Telemetry */}
                  {task.status === "Completed" && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[10px] text-muted font-mono">
                      {task.durationMs && (
                        <span>Duration: <strong>{formatDuration(task.durationMs)}</strong></span>
                      )}
                      {task.promptTokens !== undefined && task.promptTokens !== null && (
                        <span>Tokens: <strong>{task.promptTokens + (task.completionTokens || 0)}</strong></span>
                      )}
                      {task.estimatedCostUsd !== undefined && task.estimatedCostUsd !== null && (
                        <span className="flex items-center gap-0.5">
                          Cost: <strong className="text-success">{formatCost(task.estimatedCostUsd)}</strong>
                        </span>
                      )}
                      {task.modelName && (
                        <span className="flex items-center gap-1 text-[9px] uppercase border border-border/30 px-1 rounded-sm bg-surface-secondary font-sans">
                          <Cpu className="size-2.5 text-accent" />
                          {task.modelName.replace("claude-3-", "")}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Right actions (Retry button or details indicator) */}
                <div className="flex items-center gap-2 self-start md:self-auto" onClick={(e) => e.stopPropagation()}>
                  {task.status === "Failed" && !isJobRunning && (
                    <Button
                      size="sm"
                      className="rounded-lg text-[10px] font-black uppercase tracking-wider h-8 flex items-center gap-1 text-danger bg-danger/10 hover:bg-danger/20 border border-danger/25 cursor-pointer"
                      onClick={() => onRetryTask(task.id)}
                      isDisabled={isRetryingTaskId === task.id}
                    >
                      {isRetryingTaskId === task.id ? (
                        <Spinner size="sm" color="current" />
                      ) : (
                        <RefreshCw size={11} className="shrink-0" />
                      )}
                      <span>Retry Step</span>
                    </Button>
                  )}

                  {task.status === "Failed" && task.errorMessage && (
                    <div className="flex items-center gap-1 text-danger font-bold text-xs max-w-[200px] truncate bg-danger/5 border border-danger/20 p-1 rounded-md">
                      <AlertTriangle className="size-3 shrink-0" />
                      <span className="text-[10px] truncate">{task.errorMessage}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default AnalysisTaskTimeline;
