import React from "react";
import { SummaryRenderer } from "./SummaryRenderers";
import { type StreamingSession } from "../types";

interface StreamingSummaryProps {
  activeSession: StreamingSession;
  errorMessage: string | null;
}

export function StreamingSummary({
  activeSession,
  errorMessage,
}: StreamingSummaryProps) {
  if (activeSession.status !== "Completed" && activeSession.status !== "Failed") {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 shrink-0">
      <span className="text-[10px] text-muted uppercase font-bold tracking-wider mb-1">
        Execution Summary
      </span>
      <SummaryRenderer
        pipelineId={activeSession.pipelineId}
        summaryData={activeSession.summaryData}
        errorMessage={activeSession.errorMessage ?? errorMessage}
      />
    </div>
  );
}
