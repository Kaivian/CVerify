"use client";

import React from "react";
import { Sparkles, Maximize2 } from "lucide-react";
import { Button, Spinner } from "@heroui/react";
import { useAssessment } from "@/providers/assessment-provider";
import { useStreamingStore } from "@/modules/streaming";

export function AssessmentMiniWidget() {
  const {
    connectProgressStream,
    streamStatus,
    streamProgress,
    streamStep,
    latestAssessment
  } = useAssessment();

  const { isModalOpen } = useStreamingStore();

  // Show only if modal is minimized and stream is actively running/queued
  const isRunning =
    (latestAssessment?.status === "Running" || latestAssessment?.status === "Queued") &&
    (streamStatus === "streaming" || streamStatus === "connecting");

  if (isModalOpen || !isRunning) return null;

  const handleRestore = () => {
    connectProgressStream();
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 p-4 border border-border bg-surface text-foreground shadow-xl rounded-2xl flex items-center gap-4 max-w-[320px] transition-all duration-300 font-sans select-none animate-bounce-subtle">
      <div className="relative flex items-center justify-center">
        <Spinner size="sm" color="warning" />
        <Sparkles size={12} className="absolute text-accent animate-pulse" />
      </div>
      <div className="flex flex-col min-w-0 flex-1 text-left">
        <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">AI Vetting Active</span>
        <span className="text-xs font-bold truncate text-foreground leading-normal" title={streamStep || "Analyzing"}>
          {streamStep || "FETCH_ARTIFACTS"}
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <div className="w-20 bg-surface-secondary/50 rounded-full h-1 overflow-hidden">
            <div className="bg-accent h-full rounded-full" style={{ width: `${streamProgress}%` }} />
          </div>
          <span className="text-[9px] font-extrabold text-accent">{Math.round(streamProgress)}%</span>
        </div>
      </div>
      <Button
        isIconOnly
        size="sm"
        variant="secondary"
        className="rounded-xl border border-border/30 h-7 w-7 min-w-7 cursor-pointer hover:bg-surface-secondary"
        onPress={handleRestore}
        aria-label="Expand progress modal"
      >
        <Maximize2 size={12} />
      </Button>
    </div>
  );
}
