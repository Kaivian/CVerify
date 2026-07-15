"use client";

import React from "react";
import { Tooltip } from "@heroui/react";
import { Loader2 } from "lucide-react";
import { useDemoStore } from "../stores/use-demo-store";
import { DEMO_SECTIONS } from "../config";
import { cn } from "@/lib/utils";

export function DemoProgress() {
  const currentSectionIndex = useDemoStore((state) => state.currentSectionIndex);
  const transitionState = useDemoStore((state) => state.transitionState);
  const setSectionIndex = useDemoStore((state) => state.setSectionIndex);
  const subStage = useDemoStore((state) => state.subStage);
  const statusMessage = useDemoStore((state) => state.statusMessage);

  const metadata = DEMO_SECTIONS[currentSectionIndex]?.metadata || DEMO_SECTIONS[0].metadata;
  const phases = metadata.phases || [];
  const totalSubStages = phases.length || 1;
  const isTransitioning = transitionState === "entering" || transitionState === "exiting";

  if (metadata.showProgress === false) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3.5 w-full max-w-xl mx-auto pointer-events-auto select-none">
      {/* Visual Header displaying current step info & status */}
      <div className="flex items-center justify-between gap-4 w-full text-xs">
        <div className="flex items-center gap-2 text-foreground min-w-0">
          <span className="font-semibold text-[10px] tracking-wider uppercase text-accent bg-accent/10 px-2 py-0.5 rounded-full whitespace-nowrap">
            Step {currentSectionIndex + 1} of {DEMO_SECTIONS.length}
          </span>
          <span className="font-bold truncate">
            {metadata.title}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-muted min-w-0">
          {(isTransitioning || statusMessage) && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-accent shrink-0" />
          )}
          <span className="truncate italic">
            {statusMessage || metadata.description || "Initializing..."}
          </span>
        </div>
      </div>

      {/* Segmented Progress Bar */}
      <div className="flex items-center gap-2.5 w-full">
        {DEMO_SECTIONS.map((section, idx) => {
          const sectionPhases = section.metadata.phases || [];
          const sectionTotalSubStages = sectionPhases.length || 1;
          const isCompleted = idx < currentSectionIndex;
          const isActive = idx === currentSectionIndex;

          let fillPercent = 0;
          if (isCompleted) {
            fillPercent = 100;
          } else if (isActive) {
            fillPercent = (subStage / sectionTotalSubStages) * 100;
          }

          const handleSegmentClick = () => {
            if (isTransitioning) return;
            if (idx < currentSectionIndex && metadata.allowBack === false) return;
            useDemoStore.setState({ isPlaying: true });
            setSectionIndex(idx);
          };

          return (
            <Tooltip key={section.metadata.id}>
              <Tooltip.Trigger className="w-full">
                <button
                  type="button"
                  onClick={handleSegmentClick}
                  disabled={isTransitioning || (idx < currentSectionIndex && metadata.allowBack === false)}
                  className="w-full text-left focus:outline-hidden group"
                  aria-label={`Go to section ${idx + 1}: ${section.metadata.title}`}
                >
                  <div
                    className={cn(
                      "h-1.5 w-full rounded-full overflow-hidden transition-all duration-300 relative",
                      isActive ? "bg-muted/20" : isCompleted ? "bg-accent/20" : "bg-muted/10",
                      isTransitioning ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                    )}
                  >
                    <div
                      className={cn(
                        "h-full bg-accent transition-all duration-500 ease-out",
                        isActive && isTransitioning && "animate-pulse"
                      )}
                      style={{ width: `${fillPercent}%` }}
                    />
                  </div>
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content
                placement="top"
                className="text-xs py-1.5 px-3 rounded-md border border-border bg-surface text-foreground shadow-lg font-sans flex flex-col gap-0.5"
              >
                <div className="font-bold text-foreground">{section.metadata.title}</div>
                <div className="text-[10px] text-muted">
                  {isActive
                    ? `Step ${subStage + 1} of ${sectionTotalSubStages}`
                    : isCompleted
                      ? "Completed"
                      : "Pending"}
                </div>
              </Tooltip.Content>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

export default DemoProgress;
