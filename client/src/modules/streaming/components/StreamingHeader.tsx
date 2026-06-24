import React from "react";
import { Sparkles, X } from "lucide-react";
import { Button, Chip } from "@heroui/react";
import { type StreamingSession } from "../types";

interface StreamingHeaderProps {
  activeSession: StreamingSession;
  isConnecting: boolean;
  onCancel: () => void;
  onClose: () => void;
}

export function StreamingHeader({
  activeSession,
  isConnecting,
  onCancel,
  onClose,
}: StreamingHeaderProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "Completed": return "success";
      case "Failed": return "danger";
      case "Cancelled": return "default";
      case "Running": return "warning";
      case "Connecting": return "accent";
      default: return "default";
    }
  };

  const displayName = activeSession.pipelineId === "candidate-assessment" 
    ? "Candidate Profile Assessment" 
    : activeSession.pipelineId === "repository-analysis"
      ? "Repository Analysis"
      : activeSession.pipelineId === "jd-generation"
        ? "Job Description Generation"
        : activeSession.pipelineId;

  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-border/10 shrink-0">
      <div className="flex items-center gap-3">
        <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          <Sparkles className="size-4" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-extrabold text-foreground tracking-tight">
              {displayName}
            </h2>
            <Chip
              size="sm"
              color={getStatusColor(activeSession.status)}
              variant="soft"
              className="font-bold"
            >
              {isConnecting ? "Connecting" : activeSession.status}
            </Chip>
          </div>
          <span className="text-[10px] text-muted mt-0.5 font-mono">
            Session ID: {activeSession.id}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {activeSession.status === "Running" && (
          <Button
            size="sm"
            variant="danger-soft"
            className="h-8 text-xs font-black"
            onPress={onCancel}
          >
            Cancel Run
          </Button>
        )}
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          className="rounded-full"
          onPress={onClose}
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
