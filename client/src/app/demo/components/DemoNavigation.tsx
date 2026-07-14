"use client";

import React from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemoStore } from "../stores/use-demo-store";
import { DEMO_SECTIONS } from "../config";

export function DemoNavigation() {
  const currentSectionIndex = useDemoStore((state) => state.currentSectionIndex);
  const transitionState = useDemoStore((state) => state.transitionState);
  const nextSection = useDemoStore((state) => state.nextSection);
  const prevSection = useDemoStore((state) => state.prevSection);
  const getCurrentMetadata = useDemoStore((state) => state.getCurrentMetadata);

  const metadata = getCurrentMetadata();
  const hasPrev = currentSectionIndex > 0;
  const hasNext = currentSectionIndex < DEMO_SECTIONS.length - 1;
  const isTransitioning = transitionState === "entering" || transitionState === "exiting";

  // Hide entirely if configured
  if (metadata.showNavigation === false) {
    return null;
  }

  const isBackDisabled = !hasPrev || metadata.allowBack === false || isTransitioning;
  const isNextDisabled = !hasNext || isTransitioning;

  return (
    <div className="flex items-center justify-between gap-6 pointer-events-auto select-none">
      <Button
        size="md"
        variant="light"
        onPress={prevSection}
        isDisabled={isBackDisabled}
        className="text-xs font-medium text-muted hover:text-foreground hover:bg-surface-secondary/50 cursor-pointer transition-all min-w-[100px]"
      >
        <ChevronLeft className="h-4 w-4 mr-1.5 inline" />
        Previous
      </Button>

      <Button
        size="md"
        variant="solid"
        onPress={nextSection}
        isDisabled={isNextDisabled}
        className="text-xs font-semibold bg-foreground text-background hover:opacity-90 cursor-pointer transition-all min-w-[100px]"
      >
        {currentSectionIndex === DEMO_SECTIONS.length - 1 ? "Finish" : "Next"}
        {currentSectionIndex === DEMO_SECTIONS.length - 1 ? (
          <Play className="h-3.5 w-3.5 fill-current ml-1.5 inline" />
        ) : (
          <ChevronRight className="h-4 w-4 ml-1.5 inline" />
        )}
      </Button>
    </div>
  );
}

export default DemoNavigation;
