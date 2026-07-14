"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  LayoutDashboard,
  User,
  Briefcase,
  MessageSquare,
  Settings,
  Bell,
  Check,
  Sparkles,
} from "lucide-react";
import { Github, Gitlab } from "@thesvg/react";
import { Card, Chip, toast } from "@heroui/react";
import { Button } from "@/components/ui/button";
import { useDemoStore } from "../stores/use-demo-store";
import { cn } from "@/lib/utils";

interface Section02Props {
  lifecycleState: string;
  onStateComplete: (state: string) => void;
}

// Shared cubic-bezier easing used across Section01 for consistency
const EASE_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function Section02({ lifecycleState, onStateComplete }: Section02Props) {
  const prefersReducedMotion = useReducedMotion();
  const subStage = useDemoStore((state) => state.subStage);
  const setSubStage = useDemoStore((state) => state.setSubStage);
  const nextSection = useDemoStore((state) => state.nextSection);

  // Animation Phase states
  const [shellVisible, setShellVisible] = useState(false);
  const [card1Visible, setCard1Visible] = useState(false);
  const [card2Visible, setCard2Visible] = useState(false);
  const [card3Visible, setCard3Visible] = useState(false);
  const [showCursor, setShowCursor] = useState(false);
  const [cursorReached, setCursorReached] = useState(false);
  const [connectionStep, setConnectionStep] = useState<"idle" | "connecting" | "done">("idle");

  // Sync internal subStages with store
  useEffect(() => {
    if (lifecycleState === "active") {
      Promise.resolve().then(() => {
        setSubStage(0, 2);
      });
    }
  }, [lifecycleState, setSubStage]);

  // Handle animation timeline sequence
  useEffect(() => {
    if (lifecycleState === "active") {
      // Phase 1: Reveal the shell (sidebar + header)
      const tShell = setTimeout(() => setShellVisible(true), 200);

      // Phase 2: Cascade content cards with stagger
      const tCard1 = setTimeout(() => setCard1Visible(true), 700);
      const tCard3 = setTimeout(() => setCard3Visible(true), 900);
      const tCard2 = setTimeout(() => setCard2Visible(true), 1100);

      // Phase 3: Virtual pointer sweeps toward the "Link Account" button
      const tCursor = setTimeout(() => setShowCursor(true), 2400);
      const tRipple = setTimeout(() => setCursorReached(true), 3500);

      // Confirm scene is active
      onStateComplete("active");

      return () => {
        clearTimeout(tShell);
        clearTimeout(tCard1);
        clearTimeout(tCard2);
        clearTimeout(tCard3);
        clearTimeout(tCursor);
        clearTimeout(tRipple);
      };
    }
  }, [lifecycleState, onStateComplete]);

  // Phase 4a: Start connecting when user clicks "Link Account"
  useEffect(() => {
    if (subStage === 1 && connectionStep === "idle") {
      setConnectionStep("connecting");
      toast.success("Demo Mode: Initiating GitHub OAuth flow...");
    }
  }, [subStage, connectionStep]);

  // Phase 4b: Connecting (1s) → Done (0.5s) → Section 3
  useEffect(() => {
    if (connectionStep !== "connecting") return;

    const tDone = setTimeout(() => {
      setConnectionStep("done");
      toast.success("Demo Mode: GitHub account linked successfully!");
    }, 1000);

    return () => clearTimeout(tDone);
  }, [connectionStep]);

  useEffect(() => {
    if (connectionStep !== "done") return;

    const tTransition = setTimeout(() => {
      nextSection();
    }, 500);

    return () => clearTimeout(tTransition);
  }, [connectionStep, nextSection]);

  const handleLinkGithub = () => {
    if (connectionStep !== "idle") return;
    setSubStage(1);
  };

  // --- Motion Variants ---

  // Card slide-up with per-card custom delay
  const cardSlideUp = {
    hidden: {
      opacity: 0,
      y: prefersReducedMotion ? 0 : 24,
      scale: prefersReducedMotion ? 1 : 0.97,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.7, ease: EASE_EXPO },
    },
  };

  // Sidebar reveal — slides in from left
  const sidebarVariants = {
    hidden: {
      opacity: 0,
      x: prefersReducedMotion ? 0 : -20,
    },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.6, ease: EASE_EXPO },
    },
  };

  // Header reveal — fades down from top
  const headerVariants = {
    hidden: {
      opacity: 0,
      y: prefersReducedMotion ? 0 : -12,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: EASE_EXPO, delay: 0.15 },
    },
  };

  // Banner reveal
  const bannerVariants = {
    hidden: {
      opacity: 0,
      y: prefersReducedMotion ? 0 : 10,
      scale: prefersReducedMotion ? 1 : 0.98,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.6, ease: EASE_EXPO, delay: 0.25 },
    },
  };

  return (
    <div className="w-full max-w-5xl h-[520px] border-2 border-border/80 rounded-2xl overflow-hidden bg-background shadow-2xl flex text-foreground font-sans relative">
      {/* 1. MOCK SIDEBAR (Left Column) */}
      <motion.aside
        variants={sidebarVariants}
        initial="hidden"
        animate={shellVisible ? "visible" : "hidden"}
        className="w-56 border-r border-border/50 bg-background/50 backdrop-blur-xs flex flex-col shrink-0 select-none"
      >
        {/* Brand/Logo Section */}
        <div className="h-14 px-4 flex items-center gap-2 border-b border-border/40 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.png" alt="CVerify Logo" className="w-7 h-auto" />
          <span className="font-outfit font-bold text-lg tracking-tight">CVerify</span>
        </div>

        {/* Sidebar Nav Items */}
        <nav className="flex-1 px-2.5 py-4 space-y-1">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-accent-soft/10 text-accent font-semibold text-xs transition-colors cursor-default">
            <LayoutDashboard size={16} />
            <span>Dashboard</span>
          </div>
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-muted hover:text-foreground text-xs transition-colors cursor-default">
            <User size={16} />
            <span>My CV</span>
          </div>
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-muted hover:text-foreground text-xs transition-colors cursor-default">
            <Briefcase size={16} />
            <span>Job Board</span>
          </div>
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-muted hover:text-foreground text-xs transition-colors cursor-default">
            <MessageSquare size={16} />
            <span>Forum</span>
          </div>
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-muted hover:text-foreground text-xs transition-colors cursor-default">
            <Settings size={16} />
            <span>Settings</span>
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-border/40 shrink-0">
          <div className="flex items-center gap-2.5 px-2 py-1">
            <div className="w-7.5 h-7.5 rounded-full bg-accent/20 border border-accent/30 text-accent flex items-center justify-center font-bold text-xs">
              K
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-bold truncate">Kaivian</span>
              <span className="text-[8px] text-muted truncate">candidate</span>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* 2. MAIN WORKSPACE VIEWPORT (Right Column) */}
      <div className="flex-1 flex flex-col min-w-0 bg-surface-secondary/20">
        {/* Mock Header */}
        <motion.header
          variants={headerVariants}
          initial="hidden"
          animate={shellVisible ? "visible" : "hidden"}
          className="h-14 px-6 border-b border-border/40 bg-background/35 backdrop-blur-xs flex items-center justify-between shrink-0 select-none"
        >
          {/* Breadcrumb Navigation */}
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <span>General</span>
            <span className="text-border">/</span>
            <span className="text-foreground font-semibold">Dashboard</span>
          </div>

          {/* Header Controls */}
          <div className="flex items-center gap-3">
            <div className="relative text-muted hover:text-foreground transition-colors cursor-default">
              <Bell size={16} />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-accent rounded-full animate-pulse" />
            </div>
            <div className="w-8 h-8 rounded-full bg-accent-soft/20 border border-accent/20 text-accent flex items-center justify-center font-bold text-xs cursor-default">
              KV
            </div>
          </div>
        </motion.header>

        {/* Mock Workspace Content Scroll area */}
        <main className="flex-1 p-4 overflow-y-auto space-y-4">
          {/* Top Banner Widget */}
          <motion.div
            variants={bannerVariants}
            initial="hidden"
            animate={shellVisible ? "visible" : "hidden"}
            className="flex items-center justify-between gap-4 p-4 rounded-xl bg-accent-soft/10 border border-accent/25 select-none"
          >
            <div className="space-y-0.5 text-left">
              <h2 className="text-xs font-extrabold flex items-center gap-1.5 text-accent uppercase tracking-wider font-outfit">
                Welcome to your Workspace, Kaivian! <Sparkles size={13} />
              </h2>
              <p className="text-[10px] text-muted leading-relaxed font-light">
                Connect source providers to build your cryptographic profile and verify experience.
              </p>
            </div>
          </motion.div>

          {/* Cards Grid */}
          <div className="grid grid-cols-12 gap-5">
            {/* CARD 1: Developer Profile (spans 8/12) */}
            <div className="col-span-8">
              <AnimatePresence>
                {card1Visible && (
                  <motion.div
                    variants={cardSlideUp}
                    initial="hidden"
                    animate="visible"
                    className="h-full"
                  >
                    <Card className="p-5 border border-border bg-background flex flex-col gap-4 h-full shadow-xs">
                      <div className="flex items-center gap-2.5 text-left select-none">
                        <div className="w-8 h-8 rounded-full bg-surface-secondary flex items-center justify-center text-foreground border border-border/50">
                          <User size={15} />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-foreground">Developer Profile</h3>
                          <p className="text-[9px] text-muted font-light">Account authorization details</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-left font-sans select-none text-xs">
                        <div>
                          <span className="text-[9px] text-muted font-bold block mb-0.5 uppercase tracking-wider">Full Name</span>
                          <span className="font-semibold text-foreground">Kaivian</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-muted font-bold block mb-0.5 uppercase tracking-wider">Email Address</span>
                          <span className="font-semibold text-foreground truncate block">candidate@cverify.com</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-muted font-bold block mb-0.5 uppercase tracking-wider">Verification Status</span>
                          <Chip color="success" size="sm" variant="soft" className="h-4.5 px-1.5 text-[8px] font-extrabold tracking-wider uppercase">
                            Verified
                          </Chip>
                        </div>
                        <div>
                          <span className="text-[9px] text-muted font-bold block mb-0.5 uppercase tracking-wider">Assigned Role</span>
                          <Chip size="sm" variant="soft" className="h-4.5 px-1.5 text-[8px] font-extrabold tracking-wider uppercase border border-border">
                            Candidate
                          </Chip>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* CARD 3: Trust Score Dial (spans 4/12) */}
            <div className="col-span-4">
              <AnimatePresence>
                {card3Visible && (
                  <motion.div
                    variants={cardSlideUp}
                    initial="hidden"
                    animate="visible"
                    className="h-full"
                  >
                    <Card className="p-5 border border-border bg-background flex flex-col items-center justify-center text-center gap-3 h-full shadow-xs">
                      <div className="relative flex items-center justify-center h-20 w-20">
                        {/* Circular Progress track background */}
                        <svg className="w-full h-full transform -rotate-90">
                          <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="6" className="text-border/30" fill="transparent" />
                          <motion.circle
                            cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="6"
                            className="text-accent" fill="transparent"
                            strokeDasharray="201"
                            initial={{ strokeDashoffset: 201 }}
                            animate={{ strokeDashoffset: [201, 185, 201] }}
                            transition={{
                              duration: 3,
                              ease: "easeInOut",
                              repeat: Infinity,
                              repeatDelay: 1,
                            }}
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="absolute text-sm font-extrabold font-mono text-muted">--</span>
                      </div>
                      <div>
                        <h4 className="text-[11px] font-bold text-foreground">Trust Score</h4>
                        <p className="text-[8px] text-muted font-light mt-0.5 max-w-[120px] mx-auto leading-normal">
                          Link GitHub to compute authenticity index
                        </p>
                      </div>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* CARD 2A: GitHub Integration (spans 6/12) */}
            <div className="col-span-6 relative">
              <AnimatePresence>
                {card2Visible && (
                  <motion.div
                    variants={cardSlideUp}
                    initial="hidden"
                    animate="visible"
                    className="h-full"
                  >
                    <Card className="p-5 border border-border bg-background flex flex-col justify-between h-full shadow-xs relative overflow-hidden">
                      <div className="flex items-center gap-3 text-left select-none">
                        <div className="w-8 h-8 flex items-center justify-center text-foreground border border-border/40 rounded-lg bg-surface-secondary">
                          <Github className="size-4.5" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                            GitHub Integration
                            <Chip size="sm" variant="soft" className="h-4 px-1.5 text-[8px] font-extrabold uppercase rounded-sm tracking-wider">
                              Unlinked
                            </Chip>
                          </span>
                          <span className="text-[8px] text-muted">Access public and private commits</span>
                        </div>
                      </div>

                      <div className="mt-5 flex justify-end relative">
                        <Button
                          size="sm"
                          variant={connectionStep === "done" ? "solid" : "primary"}
                          isDisabled={connectionStep !== "idle"}
                          isLoading={connectionStep === "connecting"}
                          onPress={handleLinkGithub}
                          className={cn(
                            "h-8 rounded-lg text-[10px] font-semibold tracking-wider uppercase px-4 cursor-pointer transition-all duration-300",
                            connectionStep === "done" && "bg-success text-success-foreground border-success animate-fade-in"
                          )}
                        >
                          {connectionStep === "idle" && "Link Account"}
                          {connectionStep === "connecting" && "Connecting"}
                          {connectionStep === "done" && (
                            <span className="flex items-center gap-1.5">
                              <Check size={12} />
                              Linked
                            </span>
                          )}
                        </Button>
                      </div>

                      {/* Virtual Mouse Cursor Overlay */}
                      <AnimatePresence>
                        {showCursor && (
                          <motion.div
                            initial={{
                              x: prefersReducedMotion ? 0 : 180,
                              y: prefersReducedMotion ? 0 : 100,
                              opacity: 0,
                            }}
                            animate={{
                              x: cursorReached ? 0 : [180, 60, 0],
                              y: cursorReached ? 0 : [100, 30, 0],
                              opacity: 1,
                            }}
                            transition={{
                              x: { duration: 1.0, ease: EASE_EXPO },
                              y: { duration: 1.0, ease: EASE_EXPO },
                              opacity: { duration: 0.4, ease: "easeOut" },
                            }}
                            className="absolute pointer-events-none z-50 flex items-center justify-center"
                            style={{
                              bottom: "22px",
                              right: "20px",
                            }}
                          >
                            {/* Pulsing Ripple ring — only visible after cursor reaches target */}
                            <AnimatePresence>
                              {cursorReached && (
                                <motion.div
                                  initial={{ scale: 0.6, opacity: 0 }}
                                  animate={{
                                    scale: [1, 2, 1],
                                    opacity: [0.6, 0, 0.6],
                                  }}
                                  exit={{ scale: 0.6, opacity: 0 }}
                                  transition={{
                                    duration: 1.8,
                                    repeat: Infinity,
                                    ease: "easeOut",
                                  }}
                                  className="absolute w-8 h-8 rounded-full border-2 border-accent bg-accent/10 pointer-events-none"
                                />
                              )}
                            </AnimatePresence>

                            {/* Cursor Arrow SVG */}
                            <motion.svg
                              className="h-5 w-5 text-foreground fill-current drop-shadow-md select-none pointer-events-none"
                              style={{ transform: "translate(6px, 7px)" }}
                              viewBox="0 0 24 24"
                              animate={
                                cursorReached
                                  ? { scale: [1, 0.85, 1] }
                                  : { scale: 1 }
                              }
                              transition={{
                                duration: 1.2,
                                repeat: cursorReached ? Infinity : 0,
                                ease: "easeInOut",
                                repeatDelay: 0.6,
                              }}
                            >
                              <path d="M4.5 3v15.2l3.9-3.9 3.2 7.7 2.6-1.1-3.2-7.7 5.6-.1z" />
                            </motion.svg>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* CARD 2B: GitLab Integration (spans 6/12) */}
            <div className="col-span-6">
              <AnimatePresence>
                {card2Visible && (
                  <motion.div
                    variants={cardSlideUp}
                    initial="hidden"
                    animate="visible"
                    className="h-full"
                  >
                    <Card className="p-5 border border-border bg-background flex flex-col justify-between h-full shadow-xs opacity-80">
                      <div className="flex items-center gap-3 text-left select-none">
                        <div className="w-8 h-8 flex items-center justify-center text-foreground border border-border/40 rounded-lg bg-surface-secondary">
                          <Gitlab className="size-4.5" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                            GitLab Integration
                            <Chip size="sm" variant="soft" className="h-4 px-1.5 text-[8px] font-extrabold uppercase rounded-sm tracking-wider">
                              Unlinked
                            </Chip>
                          </span>
                          <span className="text-[8px] text-muted">Access GitLab repository metadata</span>
                        </div>
                      </div>

                      <div className="mt-5 flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          isDisabled={connectionStep !== "idle"}
                          className="h-8 rounded-lg text-[10px] font-semibold tracking-wider uppercase px-4 border-border cursor-not-allowed"
                        >
                          Link GitLab
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Section02;
