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
  const subStage = useDemoStore((state) => state.subStage);

  const metadata = DEMO_SECTIONS[currentSectionIndex]?.metadata || DEMO_SECTIONS[0].metadata;
  const phases = metadata.phases || [];
  const hasPrev = subStage > 0 || currentSectionIndex > 0;
  const hasNext = subStage < phases.length - 1 || currentSectionIndex < DEMO_SECTIONS.length - 1;
  const isTransitioning = transitionState === "entering" || transitionState === "exiting";

  // Hide entirely if configured
  if (metadata.showNavigation === false) {
    return null;
  }

  const isBackDisabled = !hasPrev || (subStage === 0 && metadata.allowBack === false) || isTransitioning;
  const isNextDisabled = !hasNext || isTransitioning;

  const isLast = currentSectionIndex === DEMO_SECTIONS.length - 1 && subStage === phases.length - 1;

  return (
    <div className="flex items-center justify-between gap-6 pointer-events-auto select-none">
      <Button
        size="md"
        variant="secondary"
        onPress={prevSection}
        isDisabled={isBackDisabled}
        className="text-xs font-medium cursor-pointer transition-all min-w-[100px]"
      >
        <ChevronLeft className="h-4 w-4 mr-1.5 inline" />
        Previous
      </Button>

      <Button
        size="md"
        variant="primary"
        onPress={nextSection}
        isDisabled={isNextDisabled}
        className="text-xs font-semibold cursor-pointer transition-all min-w-[100px]"
      >
        {isLast ? "Finish" : "Next"}
        {isLast ? (
          <Play className="h-3.5 w-3.5 fill-current ml-1.5 inline" />
        ) : (
          <ChevronRight className="h-4 w-4 ml-1.5 inline" />
        )}
      </Button>
    </div>
  );
}

export default DemoNavigation;
