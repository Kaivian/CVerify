import React from "react";
import { CheckCircle2, XCircle, RefreshCw, Clock, Cpu, AlertTriangle } from "lucide-react";
import { Spinner, Button, ProgressBar, Chip } from "@heroui/react";
import { StreamingStage as StageType } from "../types";

interface StreamingStageProps {
  stage: StageType;
  onRetry?: (stageId: string) => void;
  isRetrying?: boolean;
  isJobRunning?: boolean;
}

export function StreamingStage({ 
  stage, 
  onRetry,
  isRetrying = false,
  isJobRunning = false
}: StreamingStageProps) {
  const isStageRunning = stage.status === "Running";
  const isStageCompleted = stage.status === "Completed";
  const isStageFailed = stage.status === "Failed";

  const formattedTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000) % 60;
    const minutes = Math.floor(ms / 60000) % 60;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  // Parse telemetry metrics from JSON details
  let promptTokens = 0;
  let completionTokens = 0;
  let estimatedCostUsd = 0;
  let modelName = "";
  let errorMessage = stage.details && stage.status === "Failed" ? stage.details : "";

  try {
    if (stage.details) {
      const parsed = JSON.parse(stage.details);
      promptTokens = parsed.promptTokens ?? parsed.inputTokens ?? parsed.prompt_tokens ?? 0;
      completionTokens = parsed.completionTokens ?? parsed.outputTokens ?? parsed.completion_tokens ?? 0;
      estimatedCostUsd = parsed.estimatedCostUsd ?? parsed.costUsd ?? parsed.estimated_cost_usd ?? 0;
      modelName = parsed.modelName ?? parsed.model ?? "";
      if (parsed.errorMessage || parsed.message) {
        errorMessage = parsed.errorMessage || parsed.message;
      }
    }
  } catch (e) {
    // Stage details is not JSON, might be raw error
  }

  const getStatusIcon = () => {
    if (isStageRunning) return <Spinner size="sm" color="warning" className="shrink-0" />;
    if (isStageCompleted) return <CheckCircle2 className="size-5 text-success shrink-0" />;
    if (isStageFailed) return <XCircle className="size-5 text-danger shrink-0" />;
    return <Clock className="size-5 text-muted shrink-0 animate-pulse" />;
  };

  const getStatusColor = () => {
    if (isStageCompleted) return "success" as const;
    if (isStageFailed) return "danger" as const;
    if (isStageRunning) return "warning" as const;
    return "default" as const;
  };

  return (
    <div className="relative pl-12 min-h-[48px] flex flex-col justify-center py-2 group select-none">
      {/* Circle badge identifier */}
      <div className="absolute left-0 top-2.5 bg-background p-1 rounded-full z-10">
        {getStatusIcon()}
      </div>

      <div className={`p-4 border rounded-xl bg-surface-secondary/20 flex flex-col md:flex-row md:items-center justify-between gap-4 select-none border-border/60 hover:bg-surface-secondary/40`}>
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`font-bold text-sm text-foreground`}>
              {stage.stageName}
            </span>
            <Chip
              size="sm"
              color={getStatusColor()}
              variant="soft"
              className="text-[9px] font-extrabold uppercase px-1.5 h-4.5"
            >
              {stage.status}
            </Chip>
            {stage.retryCount > 0 && (
              <Chip
                size="sm"
                color="default"
                variant="soft"
                className="text-[9px] font-bold h-4.5 px-1"
              >
                Retry #{stage.retryCount}
              </Chip>
            )}
          </div>

          <p className="text-xs text-muted leading-relaxed font-light">
            {stage.description}
          </p>

          {/* Running progress bar */}
          {isStageRunning && (
            <div className="w-full max-w-xs mt-2">
              <ProgressBar
                aria-label={`${stage.stageId} progress`}
                value={stage.progress}
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

          {/* Stage Telemetry Details */}
          {(isStageCompleted || isStageFailed) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[10px] text-muted font-mono">
              {stage.durationMs !== undefined && stage.durationMs > 0 && (
                <span>Duration: <strong>{formattedTime(stage.durationMs)}</strong></span>
              )}
              {promptTokens + completionTokens > 0 && (
                <span>Tokens: <strong>{promptTokens + completionTokens}</strong></span>
              )}
              {estimatedCostUsd > 0 && (
                <span className="flex items-center gap-0.5">
                  Cost: <strong className="text-success">${estimatedCostUsd.toFixed(5)}</strong>
                </span>
              )}
              {modelName && (
                <span className="flex items-center gap-1 text-[9px] uppercase border border-border/30 px-1 rounded-sm bg-surface-secondary font-sans">
                  <Cpu className="size-2.5 text-accent" />
                  {modelName.replace("claude-3-", "")}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Action / Error Indicators */}
        <div className="flex items-center gap-2 self-start md:self-auto" onClick={(e) => e.stopPropagation()}>
          {isStageFailed && !isJobRunning && onRetry && (
            <Button
              size="sm"
              className="rounded-lg text-[10px] font-black uppercase tracking-wider h-8 flex items-center gap-1 text-danger bg-danger/10 hover:bg-danger/20 border border-danger/25 cursor-pointer"
              onClick={() => onRetry(stage.stageId)}
              isDisabled={isRetrying}
            >
              {isRetrying ? (
                <Spinner size="sm" color="current" />
              ) : (
                <RefreshCw size={11} className="shrink-0 animate-spin-reverse" />
              )}
              <span>Retry Step</span>
            </Button>
          )}

          {isStageFailed && errorMessage && (
            <div className="flex items-center gap-1 text-danger font-bold text-xs max-w-[200px] truncate bg-danger/5 border border-danger/20 p-1 rounded-md">
              <AlertTriangle className="size-3 shrink-0" />
              <span className="text-[10px] truncate">{errorMessage}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
