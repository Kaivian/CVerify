"use client";

import React, { useEffect, useState, useRef } from "react";
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
  Globe,
  Lock,
  Terminal,
} from "lucide-react";
import { Github, Gitlab } from "@thesvg/react";
import { Card, Chip, toast } from "@heroui/react";
import { Button } from "@/components/ui/button";
import { useDemoStore } from "../stores/use-demo-store";
import { cn } from "@/lib/utils";

interface Section03Props {
  lifecycleState: string;
  onStateComplete: (state: string) => void;
}

const EASE_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function Section03({ lifecycleState, onStateComplete }: Section03Props) {
  const prefersReducedMotion = useReducedMotion();
  const subStage = useDemoStore((state) => state.subStage);
  const setSubStage = useDemoStore((state) => state.setSubStage);
  const nextSection = useDemoStore((state) => state.nextSection);

  // Layout states
  const [shellVisible, setShellVisible] = useState(false);
  const [card1Visible, setCard1Visible] = useState(false);
  const [card2Visible, setCard2Visible] = useState(false);

  // Repository states
  const [repo1State, setRepo1State] = useState<"unanalyzed" | "analyzing" | "completed">("unanalyzed");
  const [repo2State, setRepo2State] = useState<"unanalyzed" | "analyzing" | "completed">("unanalyzed");
  const [repo1Progress, setRepo1Progress] = useState(0);
  const [repo2Progress, setRepo2Progress] = useState(0);

  // Terminal logging
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);

  // State Machine Phase
  const [phase, setPhase] = useState<
    | "reveal"
    | "moveCursorToRepo1"
    | "clickingRepo1"
    | "analyzingRepo1"
    | "moveCursorToRepo2"
    | "clickingRepo2"
    | "analyzingBoth"
    | "resultsCompleted"
    | "moveCursorToLink"
    | "linkHover"
    | "linking"
    | "transitioning"
  >("reveal");

  // Virtual Cursor positioning & state
  const [cursorCoords, setCursorCoords] = useState<{ x: number; y: number } | null>(null);
  const [initialCoords, setInitialCoords] = useState<{ x: number; y: number }>({ x: 800, y: 400 });
  const [cursorClicking, setCursorClicking] = useState(false);
  const [cursorRipple, setCursorRipple] = useState(false);

  // Element refs for relative coordinate calculation
  const workspaceRef = useRef<HTMLDivElement>(null);
  const repo1BtnRef = useRef<HTMLButtonElement>(null);
  const repo2BtnRef = useRef<HTMLButtonElement>(null);
  const linkCvBtnRef = useRef<HTMLButtonElement>(null);

  // Reset states and sync subStages on transition initiation
  useEffect(() => {
    if (lifecycleState === "beforeEnter") {
      Promise.resolve().then(() => {
        setSubStage(0, 2);
      });
      setPhase("reveal");
      setRepo1State("unanalyzed");
      setRepo2State("unanalyzed");
      setRepo1Progress(0);
      setRepo2Progress(0);
      setTerminalLogs([]);
      setCursorCoords(null);
      setCursorClicking(false);
      setCursorRipple(false);
      setShellVisible(false);
      setCard1Visible(false);
      setCard2Visible(false);
    }
  }, [lifecycleState, setSubStage]);

  // Sync internal subStages when active
  useEffect(() => {
    if (lifecycleState === "active") {
      Promise.resolve().then(() => {
        setSubStage(0, 2);
      });
    }
  }, [lifecycleState, setSubStage]);

  // Recalculates and positions the cursor relative to a button's location
  const updateCursorToRef = (elementRef: React.RefObject<HTMLButtonElement | null>) => {
    if (!elementRef.current || !workspaceRef.current) return;
    const btnRect = elementRef.current.getBoundingClientRect();
    const workspaceRect = workspaceRef.current.getBoundingClientRect();
    const targetX = btnRect.left - workspaceRect.left + btnRect.width / 2;
    const targetY = btnRect.top - workspaceRect.top + btnRect.height / 2;
    setCursorCoords({ x: targetX, y: targetY });
  };

  // Perform "Link to CV" action
  const handleLinkToCv = () => {
    if (phase === "linking" || phase === "transitioning") return;

    setPhase("linking");
    setSubStage(1, 2); // Sync store subStage

    toast.success("Demo Mode: Linking verified repositories to candidate profile...");

    // Transition to Section 04 after exactly 1000ms
    setTimeout(() => {
      setPhase("transitioning");
      nextSection();
    }, 1000);
  };

  // Watch for external footer Next clicks shifting substage to 1
  useEffect(() => {
    if (
      lifecycleState === "active" &&
      subStage === 1 &&
      phase !== "linking" &&
      phase !== "transitioning"
    ) {
      handleLinkToCv();
    }
  }, [subStage, lifecycleState, phase]);

  // Phase runner state machine
  useEffect(() => {
    if (lifecycleState !== "active") return;

    let timer: NodeJS.Timeout;

    if (phase === "reveal") {
      // Phase 1: Reveal layout shell and cascade repo cards
      const tShell = setTimeout(() => setShellVisible(true), 200);
      const tCard1 = setTimeout(() => setCard1Visible(true), 600);
      const tCard2 = setTimeout(() => setCard2Visible(true), 800);

      onStateComplete("active");

      timer = setTimeout(() => {
        setPhase("moveCursorToRepo1");
      }, 1600);

      return () => {
        clearTimeout(tShell);
        clearTimeout(tCard1);
        clearTimeout(tCard2);
        clearTimeout(timer);
      };
    }

    if (phase === "moveCursorToRepo1") {
      // Position cursor at default start, then animate to repo 1
      setInitialCoords({ x: 800, y: 400 });
      // Calculate repo 1 button coords
      setTimeout(() => {
        updateCursorToRef(repo1BtnRef);
      }, 50);

      timer = setTimeout(() => {
        setPhase("clickingRepo1");
      }, 1300);

      return () => clearTimeout(timer);
    }

    if (phase === "clickingRepo1") {
      setCursorClicking(true);
      setCursorRipple(true);

      // Simulate button click action
      timer = setTimeout(() => {
        setRepo1State("analyzing");
        setCursorClicking(false);
        setCursorRipple(false);
        setPhase("analyzingRepo1");
      }, 400);

      return () => clearTimeout(timer);
    }

    if (phase === "analyzingRepo1") {
      // Briefly show progress starting on Repo 1, then move cursor to Repo 2
      timer = setTimeout(() => {
        setPhase("moveCursorToRepo2");
      }, 600);

      return () => clearTimeout(timer);
    }

    if (phase === "moveCursorToRepo2") {
      // Update cursor coords to repo 2 button
      updateCursorToRef(repo2BtnRef);

      timer = setTimeout(() => {
        setPhase("clickingRepo2");
      }, 1300);

      return () => clearTimeout(timer);
    }

    if (phase === "clickingRepo2") {
      setCursorClicking(true);
      setCursorRipple(true);

      timer = setTimeout(() => {
        setRepo2State("analyzing");
        setCursorClicking(false);
        setCursorRipple(false);
        setPhase("analyzingBoth");
      }, 400);

      return () => clearTimeout(timer);
    }

    if (phase === "analyzingBoth") {
      // Hide cursor
      setCursorCoords(null);

      // Simulate simultaneous analysis progress with console logs
      let currentProgress1 = 0;
      let currentProgress2 = 0;
      const logs = [
        "Initializing repository indexing handshake...",
        "Resolving branch profiles & commit histories...",
        "Fetching original cryptographic commit metadata...",
        "Verifying commit signature algorithms against PGP keys...",
        "Matching developer authenticity profiles with provider metadata...",
        "Generating zero-knowledge contribution proofs...",
        "Compiling AI verification report and maintainability scoring..."
      ];
      setTerminalLogs([logs[0]]);

      const progressInterval = setInterval(() => {
        currentProgress1 += Math.floor(Math.random() * 8) + 12;
        currentProgress2 += Math.floor(Math.random() * 12) + 8;

        if (currentProgress1 >= 100) currentProgress1 = 100;
        if (currentProgress2 >= 100) currentProgress2 = 100;

        setRepo1Progress(currentProgress1);
        setRepo2Progress(currentProgress2);

        // Add logs progressively based on progress values
        const logIndex = Math.floor(((currentProgress1 + currentProgress2) / 200) * logs.length);
        setTerminalLogs(logs.slice(0, Math.max(1, logIndex + 1)));

        if (currentProgress1 === 100 && currentProgress2 === 100) {
          clearInterval(progressInterval);
          setTimeout(() => {
            setRepo1State("completed");
            setRepo2State("completed");
            setPhase("resultsCompleted");
          }, 800);
        }
      }, 250);

      return () => clearInterval(progressInterval);
    }

    if (phase === "resultsCompleted") {
      timer = setTimeout(() => {
        setPhase("moveCursorToLink");
      }, 1800);

      return () => clearTimeout(timer);
    }

    if (phase === "moveCursorToLink") {
      // Set cursor start at repo 2 button area
      if (repo2BtnRef.current) {
        const btnRect = repo2BtnRef.current.getBoundingClientRect();
        if (workspaceRef.current) {
          const workspaceRect = workspaceRef.current.getBoundingClientRect();
          setInitialCoords({
            x: btnRect.left - workspaceRect.left + btnRect.width / 2,
            y: btnRect.top - workspaceRect.top + btnRect.height / 2
          });
        }
      }

      // Update cursor target to link CV button ref
      setTimeout(() => {
        updateCursorToRef(linkCvBtnRef);
      }, 50);

      timer = setTimeout(() => {
        setPhase("linkHover");
      }, 1300);

      return () => clearTimeout(timer);
    }

    if (phase === "linkHover") {
      setCursorRipple(true);
    }
  }, [phase, lifecycleState]);

  // Motion variants
  const cardSlideUp = {
    hidden: {
      opacity: 0,
      y: prefersReducedMotion ? 0 : 20,
      scale: prefersReducedMotion ? 1 : 0.98,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.6, ease: EASE_EXPO },
    },
  };

  const sidebarVariants = {
    hidden: { opacity: 0, x: prefersReducedMotion ? 0 : -20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.6, ease: EASE_EXPO },
    },
  };

  const headerVariants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : -12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: EASE_EXPO, delay: 0.15 },
    },
  };

  const bannerVariants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: EASE_EXPO, delay: 0.25 },
    },
  };

  return (
    <div
      ref={workspaceRef}
      className="w-full max-w-5xl h-[520px] border-2 border-border/80 rounded-2xl overflow-hidden bg-background shadow-2xl flex text-foreground font-sans relative"
    >
      {/* 1. MOCK SIDEBAR */}
      <motion.aside
        variants={sidebarVariants}
        initial="hidden"
        animate={shellVisible ? "visible" : "hidden"}
        className="w-56 border-r border-border/50 bg-background/50 backdrop-blur-xs flex flex-col shrink-0 select-none"
      >
        <div className="h-14 px-4 flex items-center gap-2 border-b border-border/40 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.png" alt="CVerify Logo" className="w-7 h-auto" />
          <span className="font-outfit font-bold text-lg tracking-tight">CVerify</span>
        </div>

        <nav className="flex-1 px-2.5 py-4 space-y-1">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-muted hover:text-foreground text-xs transition-colors cursor-default">
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
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-accent-soft/10 text-accent font-semibold text-xs transition-colors cursor-default">
            <Settings size={16} />
            <span>Settings</span>
          </div>
        </nav>

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

      {/* 2. MAIN WORKSPACE VIEWPORT */}
      <div className="flex-1 flex flex-col min-w-0 bg-surface-secondary/20 relative">
        {/* Mock Header */}
        <motion.header
          variants={headerVariants}
          initial="hidden"
          animate={shellVisible ? "visible" : "hidden"}
          className="h-14 px-6 border-b border-border/40 bg-background/35 backdrop-blur-xs flex items-center justify-between shrink-0 select-none"
        >
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <span>Settings</span>
            <span className="text-border">/</span>
            <span className="text-foreground font-semibold">Source Code Providers</span>
          </div>

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

        {/* Scrollable Content Area */}
        <main className="flex-1 p-4 overflow-y-auto space-y-3.5">
          <div className="space-y-3.5">
            {/* Context Header Banner */}
            <motion.div
              variants={bannerVariants}
              initial="hidden"
              animate={shellVisible ? "visible" : "hidden"}
            >
              <AnimatePresence mode="wait">
                {repo1State === "completed" && repo2State === "completed" ? (
                  <motion.div
                    key="success-banner"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="flex items-center justify-between gap-4 p-3 rounded-xl bg-success/5 border border-success/35 select-none shadow-xs text-left"
                  >
                    <div className="space-y-0.5">
                      <h2 className="text-xs font-extrabold flex items-center gap-1.5 text-success uppercase tracking-wider font-outfit">
                        Analysis Completed successfully! <Sparkles size={13} className="text-success animate-pulse" />
                      </h2>
                      <p className="text-[9px] text-muted leading-relaxed font-light">
                        Cryptographic proofs are generated. Link these verified achievements to your CV profile to proceed.
                      </p>
                    </div>
                    <Button
                      ref={linkCvBtnRef}
                      size="sm"
                      variant="primary"
                      disabled={phase === "linking" || phase === "transitioning"}
                      isLoading={phase === "linking" || phase === "transitioning"}
                      onPress={handleLinkToCv}
                      className={cn(
                        "h-7 rounded-lg text-[9px] font-bold tracking-wider uppercase px-4 bg-success hover:bg-success/90 text-success-foreground shrink-0 shadow-md cursor-pointer transition-all duration-300",
                        (phase === "moveCursorToLink" || phase === "linkHover") && "ring-2 ring-success ring-offset-2 ring-offset-background"
                      )}
                    >
                      Link to CV
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="standard-banner"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="flex items-center justify-between gap-4 p-3 rounded-xl bg-accent-soft/10 border border-accent/25 select-none text-left"
                  >
                    <div className="space-y-0.5">
                      <h2 className="text-xs font-extrabold flex items-center gap-1.5 text-accent uppercase tracking-wider font-outfit">
                        Source Code Repositories <Sparkles size={13} />
                      </h2>
                      <p className="text-[9px] text-muted leading-relaxed font-light">
                        Select and analyze imported repository paths to verify contributions and compile experience scores.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Repositories Grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* Repository #1 Card */}
              <AnimatePresence>
                {card1Visible && (
                  <motion.div
                    variants={cardSlideUp}
                    initial="hidden"
                    animate="visible"
                  >
                    <Card className="p-4.5 border border-border bg-background flex flex-col gap-2 h-full shadow-xs text-left relative overflow-hidden transition-all duration-500">
                      <div className="flex items-start justify-between gap-2 shrink-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <Github className="size-4.5 text-foreground/80 shrink-0" />
                          <span className="font-bold text-[11px] truncate text-foreground">cverify-web</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Globe size={11} className="text-accent" />
                          <Chip size="sm" variant="soft" className="h-4.5 px-1.5 text-[7px] font-extrabold uppercase rounded-sm border border-border">
                            Public
                          </Chip>
                        </div>
                      </div>

                      <div className="flex-1">
                        <AnimatePresence mode="wait">
                          {repo1State !== "completed" ? (
                            <motion.div
                              key="unanalyzed-body-1"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              transition={{ duration: 0.3, ease: EASE_EXPO }}
                              className="text-[9px] text-muted space-y-1 font-light"
                            >
                              <p>Branch: <span className="font-semibold text-foreground">main</span></p>
                              <p>Language: <span className="font-semibold text-foreground">TypeScript</span></p>
                              <p>Last Commit: <span className="font-semibold text-foreground">2 hours ago</span></p>
                            </motion.div>
                          ) : (
                            <motion.div
                              key="completed-body-1"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.45, ease: EASE_EXPO }}
                              className="flex-1 flex flex-col gap-1.5"
                            >
                              <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full border-2 border-success bg-success/5 flex items-center justify-center font-black text-xs text-success">
                                    96
                                  </div>
                                  <div>
                                    <p className="text-[7px] text-muted font-bold uppercase tracking-wider">Overall Score</p>
                                    <p className="text-[9px] text-success font-black">+35 pts trust</p>
                                  </div>
                                </div>
                                <Chip color="success" size="sm" variant="soft" className="h-4.5 px-1.5 text-[8px] font-black uppercase rounded-sm">
                                  Grade A
                                </Chip>
                              </div>
                              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[8px] text-muted-foreground font-sans">
                                <div>Code Quality: <span className="font-bold text-foreground">95%</span></div>
                                <div>Architecture: <span className="font-bold text-foreground">92%</span></div>
                                <div>Security: <span className="font-bold text-foreground">98%</span></div>
                                <div>Maintainability: <span className="font-bold text-foreground">94%</span></div>
                              </div>
                              <div className="mt-auto p-1.5 rounded bg-accent-soft/5 border border-accent/15 text-[8px] leading-relaxed text-muted-foreground italic flex gap-1 items-start">
                                <Sparkles size={9} className="text-accent shrink-0 mt-0.5" />
                                <span>TypeScript app with 90%+ test coverage, clean structure, and low vulnerability index.</span>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="mt-auto flex items-center justify-between shrink-0 h-8">
                        <AnimatePresence mode="wait">
                          {repo1State === "unanalyzed" && (
                            <motion.div
                              key="unanalyzed-btn-1"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="flex items-center justify-between w-full"
                            >
                              <span className="text-[8.5px] text-muted font-bold uppercase tracking-wider">Ready to Analyze</span>
                              <Button
                                ref={repo1BtnRef}
                                size="sm"
                                variant="secondary"
                                disabled
                                className="h-7 text-[8px] font-semibold uppercase px-3 cursor-default"
                              >
                                Analyze
                              </Button>
                            </motion.div>
                          )}
                          {repo1State === "analyzing" && (
                            <motion.div
                              key="analyzing-progress-1"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="w-full space-y-1"
                            >
                              <div className="flex items-center justify-between text-[8px]">
                                <span className="text-accent font-bold animate-pulse">Analyzing codebase...</span>
                                <span className="text-accent font-mono font-bold">{repo1Progress}%</span>
                              </div>
                              <div className="w-full h-1 bg-border rounded-full overflow-hidden">
                                <motion.div
                                  className="h-full bg-accent"
                                  style={{ width: `${repo1Progress}%` }}
                                />
                              </div>
                            </motion.div>
                          )}
                          {repo1State === "completed" && (
                            <motion.div
                              key="completed-status-1"
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.4 }}
                              className="flex items-center justify-between w-full"
                            >
                              <span className="text-[8px] text-success uppercase font-bold tracking-wider flex items-center gap-1 select-none">
                                <Check size={9} className="text-success" /> Verified
                              </span>
                              <Chip size="sm" variant="soft" className="h-4.5 px-1.5 text-[8px] font-extrabold uppercase rounded-sm border border-border text-foreground">
                                Indexed
                              </Chip>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Repository #2 Card */}
              <AnimatePresence>
                {card2Visible && (
                  <motion.div
                    variants={cardSlideUp}
                    initial="hidden"
                    animate="visible"
                  >
                    <Card className="p-4.5 border border-border bg-background flex flex-col gap-2 h-full shadow-xs text-left relative overflow-hidden transition-all duration-500">
                      <div className="flex items-start justify-between gap-2 shrink-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <Gitlab className="size-4.5 text-[#FC6D26] shrink-0" />
                          <span className="font-bold text-[11px] truncate text-foreground">cverify-api</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Lock size={11} className="text-muted-foreground" />
                          <Chip size="sm" variant="soft" className="h-4.5 px-1.5 text-[7px] font-extrabold uppercase rounded-sm border border-border">
                            Private
                          </Chip>
                        </div>
                      </div>

                      <div className="flex-1">
                        <AnimatePresence mode="wait">
                          {repo2State !== "completed" ? (
                            <motion.div
                              key="unanalyzed-body-2"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              transition={{ duration: 0.3, ease: EASE_EXPO }}
                              className="text-[9px] text-muted space-y-1 font-light"
                            >
                              <p>Branch: <span className="font-semibold text-foreground">develop</span></p>
                              <p>Language: <span className="font-semibold text-foreground">C# (ASP.NET)</span></p>
                              <p>Last Commit: <span className="font-semibold text-foreground">1 day ago</span></p>
                            </motion.div>
                          ) : (
                            <motion.div
                              key="completed-body-2"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.45, ease: EASE_EXPO }}
                              className="flex-1 flex flex-col gap-1.5"
                            >
                              <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full border-2 border-success bg-success/5 flex items-center justify-center font-black text-xs text-success">
                                    92
                                  </div>
                                  <div>
                                    <p className="text-[7px] text-muted font-bold uppercase tracking-wider">Overall Score</p>
                                    <p className="text-[9px] text-success font-black">+30 pts trust</p>
                                  </div>
                                </div>
                                <Chip color="success" size="sm" variant="soft" className="h-4.5 px-1.5 text-[8px] font-black uppercase rounded-sm">
                                  Grade A-
                                </Chip>
                              </div>
                              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[8px] text-muted-foreground font-sans">
                                <div>Code Quality: <span className="font-bold text-foreground">91%</span></div>
                                <div>Architecture: <span className="font-bold text-foreground">94%</span></div>
                                <div>Security: <span className="font-bold text-foreground">95%</span></div>
                                <div>Maintainability: <span className="font-bold text-foreground">92%</span></div>
                              </div>
                              <div className="mt-auto p-1.5 rounded bg-accent-soft/5 border border-accent/15 text-[8px] leading-relaxed text-muted-foreground italic flex gap-1 items-start">
                                <Sparkles size={9} className="text-accent shrink-0 mt-0.5" />
                                <span>C# API using Domain-Driven Design layout with integration tests and secure auth routing.</span>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="mt-auto flex items-center justify-between shrink-0 h-8">
                        <AnimatePresence mode="wait">
                          {repo2State === "unanalyzed" && (
                            <motion.div
                              key="unanalyzed-btn-2"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="flex items-center justify-between w-full"
                            >
                              <span className="text-[8.5px] text-muted font-bold uppercase tracking-wider">Ready to Analyze</span>
                              <Button
                                ref={repo2BtnRef}
                                size="sm"
                                variant="secondary"
                                disabled
                                className="h-7 text-[8px] font-semibold uppercase px-3 cursor-default"
                              >
                                Analyze
                              </Button>
                            </motion.div>
                          )}
                          {repo2State === "analyzing" && (
                            <motion.div
                              key="analyzing-progress-2"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="w-full space-y-1"
                            >
                              <div className="flex items-center justify-between text-[8px]">
                                <span className="text-accent font-bold animate-pulse">Analyzing codebase...</span>
                                <span className="text-accent font-mono font-bold">{repo2Progress}%</span>
                              </div>
                              <div className="w-full h-1 bg-border rounded-full overflow-hidden">
                                <motion.div
                                  className="h-full bg-accent"
                                  style={{ width: `${repo2Progress}%` }}
                                />
                              </div>
                            </motion.div>
                          )}
                          {repo2State === "completed" && (
                            <motion.div
                              key="completed-status-2"
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.4 }}
                              className="flex items-center justify-between w-full"
                            >
                              <span className="text-[8px] text-success uppercase font-bold tracking-wider flex items-center gap-1 select-none">
                                <Check size={9} className="text-success" /> Verified
                              </span>
                              <Chip size="sm" variant="soft" className="h-4.5 px-1.5 text-[8px] font-extrabold uppercase rounded-sm border border-border text-foreground">
                                Indexed
                              </Chip>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Console / Verification Logs */}
          <AnimatePresence>
            {(phase === "analyzingBoth" || phase === "resultsCompleted" || phase === "moveCursorToLink" || phase === "linkHover") && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.5, ease: EASE_EXPO }}
                className="rounded-xl border border-border bg-surface-secondary/50 p-3 font-mono text-[9px] text-foreground/80 select-none shadow-xs text-left shrink-0 mt-3"
              >
                <div className="flex items-center justify-between border-b border-border/80 pb-2 mb-2">
                  <span className="text-muted font-bold uppercase tracking-wider">Verification Engine Output</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                    <span className="text-accent font-bold">Active Handshake</span>
                  </div>
                </div>
                <div className="space-y-1 max-h-[60px] overflow-y-auto scrollbar-thin">
                  {terminalLogs.map((log, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-accent select-none font-bold">&gt;</span>
                      <span className="text-foreground">{log}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Virtual Mouse Cursor Overlay */}
      <AnimatePresence>
        {cursorCoords && (
          <motion.div
            initial={{
              x: initialCoords.x,
              y: initialCoords.y,
              opacity: 0,
            }}
            animate={{
              x: cursorCoords.x,
              y: cursorCoords.y,
              opacity: 1,
            }}
            transition={{
              x: { duration: 1.2, ease: EASE_EXPO },
              y: { duration: 1.2, ease: EASE_EXPO },
              opacity: { duration: 0.4, ease: "easeOut" },
            }}
            className="absolute pointer-events-none z-100 flex items-center justify-center"
            style={{
              top: 0,
              left: 0,
            }}
          >
            {/* Pulsing Ripple ring */}
            <AnimatePresence>
              {cursorRipple && (
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{
                    scale: [1, 2.2, 1],
                    opacity: [0.6, 0, 0.6],
                  }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  transition={{
                    duration: 1.4,
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
              animate={cursorClicking ? { scale: [1, 0.82, 1] } : { scale: 1 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <path d="M4.5 3v15.2l3.9-3.9 3.2 7.7 2.6-1.1-3.2-7.7 5.6-.1z" />
            </motion.svg>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Section03;
