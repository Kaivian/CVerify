"use client";

import React, { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemoStore } from "../stores/use-demo-store";
import { DEMO_SECTIONS } from "../config";
import { DemoTransition } from "./DemoTransition";
import { SceneErrorBoundary } from "./SceneErrorBoundary";
import { DemoProgress } from "./DemoProgress";
import { DemoNavigation } from "./DemoNavigation";
import { cn } from "@/lib/utils";

export function DemoContainer() {
  const router = useRouter();
  const currentSectionIndex = useDemoStore((state) => state.currentSectionIndex);
  const transitionState = useDemoStore((state) => state.transitionState);
  const nextSection = useDemoStore((state) => state.nextSection);
  const prevSection = useDemoStore((state) => state.prevSection);
  const syncFromUrl = useDemoStore((state) => state.syncFromUrl);
  const getCurrentMetadata = useDemoStore((state) => state.getCurrentMetadata);

  const containerRef = useRef<HTMLDivElement>(null);
  const metadata = getCurrentMetadata();
  const hasNext = currentSectionIndex < DEMO_SECTIONS.length - 1;

  // Initialize store state from URL on mount
  useEffect(() => {
    syncFromUrl();
  }, [syncFromUrl]);

  // Focus container for keyboard accessibility on mount & scene change
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, [currentSectionIndex]);

  // Keyboard navigation & Escape bypass hook
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      switch (e.key) {
        case "ArrowRight":
        case " ":
          e.preventDefault();
          nextSection();
          break;
        case "ArrowLeft":
          e.preventDefault();
          prevSection();
          break;
        case "Escape":
          e.preventDefault();
          router.push("/");
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextSection, prevSection, router]);

  const ActiveSceneComponent = DEMO_SECTIONS[currentSectionIndex]?.component;

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      className={cn(
        "w-screen h-dvh overflow-hidden select-none flex flex-col relative focus:outline-none transition-colors duration-500",
        metadata.background || "bg-background",
        metadata.theme || "dark"
      )}
      data-theme={metadata.theme || "dark"}
    >
      {/* Screen Reader ARIA Live Region for accessibility announcements */}
      <div aria-live="polite" className="sr-only">
        Scene {currentSectionIndex + 1} of {DEMO_SECTIONS.length}: {metadata.title}. {metadata.description || ""}
      </div>

      {/* Floating Header */}
      <header className="w-full px-8 h-20 flex items-center justify-between border-b border-border/20 z-30 pointer-events-none absolute top-0 left-0 bg-linear-to-b from-background via-background/60 to-transparent">
        <div className="flex items-center gap-3 pointer-events-auto select-none">
          <Link href="/" className="rounded-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={metadata.theme === "light" ? "/brand/logo&name-black.png" : "/brand/logo&name-white.png"}
              alt="CVerify Logo"
              className="h-8 w-auto cursor-pointer"
            />
          </Link>
          <span className="text-muted font-normal text-xs border-l border-border/20 pl-3 hidden sm:inline">
            Interactive Product Reveal
          </span>
        </div>

        <Button
          isIconOnly
          size="sm"
          variant="light"
          onPress={() => router.push("/")}
          className="rounded-full hover:bg-surface-secondary/50 pointer-events-auto cursor-pointer"
          aria-label="Exit Demo"
        >
          <X className="h-4 w-4 text-foreground" />
        </Button>
      </header>

      {/* Dynamic Animated Scene Region */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 flex items-center justify-center relative z-10 pt-20 pb-28">
        <AnimatePresence mode="wait">
          {ActiveSceneComponent && (
            <DemoTransition key={metadata.id} transitionType={metadata.transition || "fade"}>
              <SceneErrorBoundary sceneId={metadata.id} onSkip={hasNext ? nextSection : undefined}>
                <ActiveSceneComponent
                  lifecycleState={transitionState}
                  onStateComplete={(state: string) => {
                    console.log(`[Demo Engine] Scene "${metadata.id}" confirmed state: ${state}`);
                  }}
                />
              </SceneErrorBoundary>
            </DemoTransition>
          )}
        </AnimatePresence>
      </main>

      {/* Floating Control Footer */}
      <footer className="w-full px-8 py-6 border-t border-border/20 z-30 pointer-events-none absolute bottom-0 left-0 bg-linear-to-t from-background via-background/60 to-transparent flex flex-col gap-6">
        <div className="max-w-7xl mx-auto w-full flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="w-full md:flex-1">
            <DemoProgress />
          </div>
          <div className="w-full md:w-auto">
            <DemoNavigation />
          </div>
        </div>
      </footer>
    </div>
  );
}

export default DemoContainer;
