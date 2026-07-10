import React from "react";
import { ProgressBar } from "@heroui/react";
import { type StreamingSession } from "../types";

interface StreamingProgressProps {
  activeSession: StreamingSession;
}

export function StreamingProgress({ activeSession }: StreamingProgressProps) {
  if (activeSession.status !== "Running") return null;

  return (
    <ProgressBar
      aria-label="Overall execution progress"
      value={activeSession.progress}
      color="accent"
      size="sm"
      className="w-full shrink-0"
    />
  );
}
