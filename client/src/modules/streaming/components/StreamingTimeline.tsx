import React from "react";
import { StreamingStage as StageType } from "../types";
import { StreamingStage } from "./StreamingStage";

interface StreamingTimelineProps {
  stages: StageType[];
  onRetry?: (stageId: string) => void;
  isRetryingStageId?: string | null;
  isJobRunning?: boolean;
}

export function StreamingTimeline({ 
  stages, 
  onRetry,
  isRetryingStageId = null,
  isJobRunning = false
}: StreamingTimelineProps) {
  return (
    <div className="flex flex-col gap-3 select-none font-sans text-left">
      <span className="text-[10px] text-muted uppercase font-bold tracking-wider">
        Execution Stages & Actions
      </span>

      <div className="relative pl-1">
        <div className="absolute left-[13.5px] top-3 bottom-3 w-[1.5px] bg-border/20" />

        <div className="flex flex-col gap-3">
          {stages.map((stage) => (
            <StreamingStage
              key={stage.stageId}
              stage={stage}
              onRetry={onRetry}
              isRetrying={isRetryingStageId === stage.stageId}
              isJobRunning={isJobRunning}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
