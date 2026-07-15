"use client";

import React from "react";
import { Tooltip } from "@heroui/react";
import { useDemoStore } from "../stores/use-demo-store";
import { DEMO_SECTIONS } from "../config";
import { cn } from "@/lib/utils";

export function DemoProgress() {
  const currentSectionIndex = useDemoStore((state) => state.currentSectionIndex);
  const transitionState = useDemoStore((state) => state.transitionState);
  const setSectionIndex = useDemoStore((state) => state.setSectionIndex);
  const getCurrentMetadata = useDemoStore((state) => state.getCurrentMetadata);
  const subStage = useDemoStore((state) => state.subStage);
  const totalSubStages = useDemoStore((state) => state.totalSubStages);
  const setSubStage = useDemoStore((state) => state.setSubStage);

  const metadata = getCurrentMetadata();
  const isTransitioning = transitionState === "entering" || transitionState === "exiting";

  if (metadata.showProgress === false) {
    return null;
  }

  const total = totalSubStages > 1 ? totalSubStages : DEMO_SECTIONS.length;
  const currentIndex = totalSubStages > 1 ? subStage : currentSectionIndex;
  const progressPercent = ((currentIndex + 1) / total) * 100;

  return (
    <div className="flex flex-col gap-4 w-full max-w-xl mx-auto pointer-events-auto select-none">
      {/* Visual Progress bar line */}
      <div className="w-full h-1 bg-border rounded-full overflow-hidden relative">
        <div
          className="h-full bg-accent transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Pagination indicators with tooltips */}
      <div className="flex items-center justify-center gap-3">
        {Array.from({ length: total }).map((_, idx) => {
          const isActive = idx === currentIndex;
          const isPast = idx < currentIndex;

          const handleDotClick = () => {
            if (isTransitioning) return;
            if (totalSubStages > 1) {
              setSubStage(idx);
            } else {
              if (isPast && metadata.allowBack === false) return;
              setSectionIndex(idx);
            }
          };

          const sectionId = totalSubStages > 1 ? `substage-${idx}` : DEMO_SECTIONS[idx].metadata.id;
          const title = totalSubStages > 1
            ? idx === 0
              ? "Opening Brand Reveal"
              : idx === 1
              ? "GitHub Commit Verification"
              : "Simulated Google SSO"
            : DEMO_SECTIONS[idx].metadata.title;

          return (
            <Tooltip key={sectionId}>
              <Tooltip.Trigger>
                <button
                  type="button"
                  onClick={handleDotClick}
                  disabled={isTransitioning || (totalSubStages <= 1 && isPast && metadata.allowBack === false)}
                  className={cn(
                    "h-2 rounded-full cursor-pointer transition-all duration-300",
                    isActive
                      ? "w-6 bg-accent"
                      : "w-2 bg-muted/40 hover:bg-accent/40",
                    isTransitioning && "cursor-not-allowed opacity-50"
                  )}
                  aria-label={totalSubStages > 1 ? `Go to step ${idx + 1}: ${title}` : `Go to slide ${idx + 1}: ${title}`}
                />
              </Tooltip.Trigger>
              <Tooltip.Content
                placement="top"
                className="text-xs py-1 px-2.5 rounded-md border border-border bg-surface text-foreground shadow-lg font-sans"
              >
                {title}
              </Tooltip.Content>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

export default DemoProgress;
