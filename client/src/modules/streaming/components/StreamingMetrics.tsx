import React from "react";
import { Clock, Coins, Cpu } from "lucide-react";
import { type StreamingSession } from "../types";

interface StreamingMetricsProps {
  activeSession: StreamingSession;
  elapsedMs: number;
}

export function StreamingMetrics({
  activeSession,
  elapsedMs,
}: StreamingMetricsProps) {
  const formattedTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000) % 60;
    const minutes = Math.floor(ms / 60000) % 60;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  return (
    <div className="px-6 py-2.5 bg-content2/30 border-b border-border/10 flex flex-wrap gap-x-6 gap-y-1.5 text-[10px] text-muted shrink-0">
      <div className="flex items-center gap-1">
        <Clock className="size-3.5" />
        <span className="font-semibold text-foreground/80">Duration:</span>
        <span>{formattedTime(elapsedMs)}</span>
      </div>

      {activeSession.totalCostUsd !== undefined && activeSession.totalCostUsd > 0 && (
        <div className="flex items-center gap-1">
          <Coins className="size-3.5" />
          <span className="font-semibold text-foreground/80">Est. Cost:</span>
          <span>${activeSession.totalCostUsd.toFixed(5)}</span>
        </div>
      )}

      {activeSession.totalInputTokens !== undefined && activeSession.totalInputTokens > 0 && (
        <div className="flex items-center gap-1">
          <Cpu className="size-3.5" />
          <span className="font-semibold text-foreground/80">Tokens:</span>
          <span>
            {((activeSession.totalInputTokens ?? 0) + (activeSession.totalOutputTokens ?? 0)).toLocaleString()} (i: {activeSession.totalInputTokens.toLocaleString()} / o: {activeSession.totalOutputTokens?.toLocaleString()})
          </span>
        </div>
      )}

      {activeSession.modelName && (
        <div className="flex items-center gap-1 ml-auto">
          <span className="font-semibold text-foreground/80">Engine:</span>
          <span className="font-mono bg-content2 px-1.5 py-0.5 rounded border border-border/10">
            {activeSession.modelName} ({activeSession.provider || "AI"})
          </span>
        </div>
      )}
    </div>
  );
}
