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

  const metadata = getCurrentMetadata();
  const isTransitioning = transitionState === "entering" || transitionState === "exiting";

  if (metadata.showProgress === false) {
    return null;
  }

  const total = DEMO_SECTIONS.length;
  const progressPercent = ((currentSectionIndex + 1) / total) * 100;

  return (
    <div className="flex flex-col gap-4 w-full max-w-xl mx-auto pointer-events-auto select-none">
      {/* Visual Progress bar line */}
      <div className="w-full h-1 bg-border rounded-full overflow-hidden relative">
        <div
          className="h-full bg-foreground transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Pagination indicators with tooltips */}
      <div className="flex items-center justify-center gap-3">
        {DEMO_SECTIONS.map((section, idx) => {
          const isActive = idx === currentSectionIndex;
          const isPast = idx < currentSectionIndex;

          const handleDotClick = () => {
            if (isTransitioning) return;
            // Respect allowBack: if clicking backward and allowBack is false, block it
            if (isPast && metadata.allowBack === false) return;
            setSectionIndex(idx);
          };

          return (
            <Tooltip key={section.metadata.id}>
              <Tooltip.Trigger>
                <button
                  type="button"
                  onClick={handleDotClick}
                  disabled={isTransitioning || (isPast && metadata.allowBack === false)}
                  className={cn(
                    "h-2 rounded-full cursor-pointer transition-all duration-300",
                    isActive
                      ? "w-6 bg-foreground"
                      : "w-2 bg-muted/40 hover:bg-muted/70",
                    isTransitioning && "cursor-not-allowed opacity-50"
                  )}
                  aria-label={`Go to slide ${idx + 1}: ${section.metadata.title}`}
                />
              </Tooltip.Trigger>
              <Tooltip.Content
                placement="top"
                className="text-xs py-1 px-2.5 rounded-md border border-border bg-surface text-foreground shadow-lg font-sans"
              >
                {section.metadata.title}
              </Tooltip.Content>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

export default DemoProgress;
