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
import { Card, Chip } from "@heroui/react";
import { Button } from "@/components/ui/button";
import { useDemoStore } from "../stores/use-demo-store";
import { cn } from "@/lib/utils";

interface Section03Props {
  lifecycleState: string;
  onStateComplete: (state: string) => void;
  currentPhaseId: string;
  isPhaseCompleted: boolean;
  onPhaseComplete: () => void;
}

const EASE_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function Section03({
  lifecycleState,
  onStateComplete,
  currentPhaseId,
  isPhaseCompleted,
  onPhaseComplete,
}: Section03Props) {
  const prefersReducedMotion = useReducedMotion();
  const setStatusMessage = useDemoStore((state) => state.setStatusMessage);

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
  const syncBtnRef = useRef<HTMLButtonElement>(null);
  const analyzeBtnRef = useRef<HTMLButtonElement>(null);

  const activeTimers = useRef<NodeJS.Timeout[]>([]);
  const activeIntervals = useRef<NodeJS.Timeout[]>([]);

  const registerTimer = (timer: NodeJS.Timeout) => {
    activeTimers.current.push(timer);
    return timer;
  };

  const registerInterval = (interval: NodeJS.Timeout) => {
    activeIntervals.current.push(interval);
    return interval;
  };

  const clearAllTimers = () => {
    activeTimers.current.forEach(clearTimeout);
    activeTimers.current = [];
    activeIntervals.current.forEach(clearInterval);
    activeIntervals.current = [];
  };

  useEffect(() => {
    return () => clearAllTimers();
  }, []);

  const logsList = [
    "Initializing repository indexing handshake...",
    "Resolving branch profiles & commit histories...",
    "Fetching original cryptographic commit metadata...",
    "Verifying commit signature algorithms against PGP keys...",
    "Matching developer authenticity profiles with provider metadata...",
    "Generating zero-knowledge contribution proofs...",
    "Compiling AI verification report and maintainability scoring..."
  ];

  // Reset states and sync subStages on transition initiation
  useEffect(() => {
    if (lifecycleState === "beforeEnter") {
      clearAllTimers();
      setCursorCoords(null);
      setCursorClicking(false);
      setCursorRipple(false);

      if (currentPhaseId === "sync-repo") {
        setPhase("reveal");
        setRepo1State("unanalyzed");
        setRepo2State("unanalyzed");
        setRepo1Progress(0);
        setRepo2Progress(0);
        setTerminalLogs([]);
        setShellVisible(false);
        setCard1Visible(false);
        setCard2Visible(false);
      } else if (currentPhaseId === "show-repos") {
        setPhase("reveal");
        setRepo1State("unanalyzed");
        setRepo2State("unanalyzed");
        setRepo1Progress(0);
        setRepo2Progress(0);
        setTerminalLogs([]);
        setShellVisible(true);
        setCard1Visible(true);
        setCard2Visible(true);
      } else if (currentPhaseId === "analyze") {
        setPhase("analyzingBoth");
        setRepo1State("analyzing");
        setRepo2State("analyzing");
        setRepo1Progress(0);
        setRepo2Progress(0);
        setTerminalLogs([]);
        setShellVisible(true);
        setCard1Visible(true);
        setCard2Visible(true);
      } else { // link-cv
        setPhase("linkHover");
        setRepo1State("completed");
        setRepo2State("completed");
        setRepo1Progress(100);
        setRepo2Progress(100);
        setTerminalLogs(logsList);
        setShellVisible(true);
        setCard1Visible(true);
        setCard2Visible(true);
      }
    }
  }, [lifecycleState, currentPhaseId]);

  // Recalculates and positions the cursor relative to a button's location
  const updateCursorToRef = (elementRef: React.RefObject<HTMLButtonElement | null>) => {
    if (!elementRef.current || !workspaceRef.current) return;
    const btnRect = elementRef.current.getBoundingClientRect();
    const workspaceRect = workspaceRef.current.getBoundingClientRect();
    const targetX = btnRect.left - workspaceRect.left + btnRect.width / 2;
    const targetY = btnRect.top - workspaceRect.top + btnRect.height / 2;
    setCursorCoords({ x: targetX, y: targetY });
  };

  const handleSyncRepos = () => {
    if (currentPhaseId !== "sync-repo") return;
    useDemoStore.setState({ isPlaying: true, subStage: 1 });
    if (isPhaseCompleted) return;
    onPhaseComplete();
  };

  const handleAnalyzeRepo1 = () => {
    if (currentPhaseId !== "show-repos") return;
    if (repo1State !== "unanalyzed") return;
    setRepo1State("analyzing");
    if (!useDemoStore.getState().isPlaying && repo2State === "analyzing") {
      registerTimer(setTimeout(() => onPhaseComplete(), 800));
    }
  };

  const handleAnalyzeRepo2 = () => {
    if (currentPhaseId !== "show-repos") return;
    if (repo2State !== "unanalyzed") return;
    setRepo2State("analyzing");
    if (!useDemoStore.getState().isPlaying && repo1State === "analyzing") {
      registerTimer(setTimeout(() => onPhaseComplete(), 800));
    }
  };

  // Perform "Link to CV" action
  const handleLinkToCv = () => {
    if (phase === "linking" || phase === "transitioning") return;

    setPhase("linking");
    setCursorClicking(true);
    setCursorRipple(true);
    setStatusMessage("Demo Mode: Linking verified repositories to candidate profile...");

    // Transition to Section 04 after exactly 1000ms
    registerTimer(
      setTimeout(() => {
        setCursorClicking(false);
        setCursorRipple(false);
        setCursorCoords(null);
        setPhase("transitioning");
        onPhaseComplete();
      }, 1000)
    );
  };

  // Phase runner state machine
  useEffect(() => {
    clearAllTimers();

    if (lifecycleState !== "active") return;

    // Snapping / Paused mode
    if (isPhaseCompleted) {
      setShellVisible(true);
      if (currentPhaseId === "sync-repo") {
        setPhase("reveal");
        setCard1Visible(false);
        setCard2Visible(false);
        setRepo1State("unanalyzed");
        setRepo2State("unanalyzed");
        setRepo1Progress(0);
        setRepo2Progress(0);
        setTerminalLogs([]);
        setCursorCoords(null);
      } else if (currentPhaseId === "show-repos") {
        setPhase("reveal");
        setCard1Visible(true);
        setCard2Visible(true);
        setRepo1State("unanalyzed");
        setRepo2State("unanalyzed");
        setRepo1Progress(0);
        setRepo2Progress(0);
        setTerminalLogs([]);
        setCursorCoords(null);
      } else if (currentPhaseId === "analyze") {
        setPhase("resultsCompleted");
        setCard1Visible(true);
        setCard2Visible(true);
        setRepo1State("completed");
        setRepo2State("completed");
        setRepo1Progress(100);
        setRepo2Progress(100);
        setTerminalLogs(logsList);
        setCursorCoords(null);
      } else if (currentPhaseId === "link-cv") {
        setPhase("linkHover");
        setCard1Visible(true);
        setCard2Visible(true);
        setRepo1State("completed");
        setRepo2State("completed");
        setRepo1Progress(100);
        setRepo2Progress(100);
        setTerminalLogs(logsList);
        setCursorCoords(null);
      }
      onStateComplete("active");
      return;
    }

    // Play/Animation mode
    if (currentPhaseId === "sync-repo") {
      setShellVisible(true);
      setCard1Visible(false);
      setCard2Visible(false);
      setRepo1State("unanalyzed");
      setRepo2State("unanalyzed");
      setRepo1Progress(0);
      setRepo2Progress(0);
      setTerminalLogs([]);
      setPhase("reveal");

      setInitialCoords({ x: 800, y: 400 });
      registerTimer(setTimeout(() => updateCursorToRef(syncBtnRef), 500));

      registerTimer(setTimeout(() => setCursorClicking(true), 1700));
      registerTimer(setTimeout(() => {
        setCursorClicking(false);
        setCursorRipple(true);
      }, 1900));

      registerTimer(setTimeout(() => {
        setCursorRipple(false);
        setCursorCoords(null);
        onPhaseComplete();
      }, 2400));

      onStateComplete("active");
    } else if (currentPhaseId === "show-repos") {
      setShellVisible(true);
      setCard1Visible(true);
      setCard2Visible(true);
      setRepo1State("unanalyzed");
      setRepo2State("unanalyzed");
      setRepo1Progress(0);
      setRepo2Progress(0);
      setTerminalLogs([]);
      setPhase("reveal");

      setInitialCoords({ x: 800, y: 400 });
      registerTimer(setTimeout(() => updateCursorToRef(repo1BtnRef), 1200));

      registerTimer(setTimeout(() => setCursorClicking(true), 2400));
      registerTimer(setTimeout(() => {
        setRepo1State("analyzing");
        setCursorClicking(false);
        setCursorRipple(true);
      }, 2600));

      registerTimer(setTimeout(() => {
        setCursorRipple(false);
        updateCursorToRef(repo2BtnRef);
      }, 3000));

      registerTimer(setTimeout(() => setCursorClicking(true), 4200));
      registerTimer(setTimeout(() => {
        setRepo2State("analyzing");
        setCursorClicking(false);
        setCursorRipple(true);
      }, 4400));

      registerTimer(setTimeout(() => {
        setCursorRipple(false);
        setCursorCoords(null);
        onPhaseComplete();
      }, 4900));

      onStateComplete("active");
    } else if (currentPhaseId === "analyze") {
      setShellVisible(true);
      setCard1Visible(true);
      setCard2Visible(true);
      setRepo1State("analyzing");
      setRepo2State("analyzing");
      setRepo1Progress(0);
      setRepo2Progress(0);
      setTerminalLogs([logsList[0]]);
      setCursorCoords(null);
      setPhase("analyzingBoth");

      let currentProgress1 = 0;
      let currentProgress2 = 0;

      const progressInterval = setInterval(() => {
        currentProgress1 += Math.floor(Math.random() * 8) + 12;
        currentProgress2 += Math.floor(Math.random() * 12) + 8;

        if (currentProgress1 >= 100) currentProgress1 = 100;
        if (currentProgress2 >= 100) currentProgress2 = 100;

        setRepo1Progress(currentProgress1);
        setRepo2Progress(currentProgress2);

        const logIndex = Math.floor(((currentProgress1 + currentProgress2) / 200) * logsList.length);
        setTerminalLogs(logsList.slice(0, Math.max(1, logIndex + 1)));

        if (currentProgress1 === 100 && currentProgress2 === 100) {
          clearInterval(progressInterval);
          registerTimer(
            setTimeout(() => {
              setRepo1State("completed");
              setRepo2State("completed");
              setPhase("resultsCompleted");
            }, 500)
          );

          registerTimer(
            setTimeout(() => {
              onPhaseComplete();
            }, 1500)
          );
        }
      }, 200);

      registerInterval(progressInterval);
      onStateComplete("active");
    } else if (currentPhaseId === "link-cv") {
      setShellVisible(true);
      setCard1Visible(true);
      setCard2Visible(true);
      setRepo1State("completed");
      setRepo2State("completed");
      setRepo1Progress(100);
      setRepo2Progress(100);
      setTerminalLogs(logsList);
      setPhase("moveCursorToLink");

      setInitialCoords({ x: 400, y: 300 });
      registerTimer(setTimeout(() => updateCursorToRef(linkCvBtnRef), 500));

      registerTimer(
        setTimeout(() => {
          setPhase("linkHover");
          setCursorRipple(true);
        }, 1500)
      );

      onStateComplete("active");
    }
  }, [currentPhaseId, isPhaseCompleted, lifecycleState, onStateComplete]);

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
        <main className="flex-1 p-4 overflow-y-auto flex flex-col justify-start">
          <AnimatePresence mode="wait">
            {currentPhaseId === "sync-repo" ? (
              <motion.div
                key="empty-state"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.5, ease: EASE_EXPO }}
                className="flex-1 flex flex-col items-center justify-center min-h-[350px] p-6 text-center select-none"
              >
                <div className="w-14 h-14 rounded-full bg-accent-soft/10 border border-accent/25 flex items-center justify-center mb-4 text-accent">
                  <Globe size={24} className="animate-pulse" />
                </div>
                <h3 className="text-sm font-bold text-foreground mb-1 font-outfit">No Repositories Linked</h3>
                <p className="text-[10px] text-muted max-w-xs mb-6 leading-relaxed">
                  Connect and sync your source code providers to start indexing repositories and generating zero-knowledge contribution proofs.
                </p>
                <Button
                  ref={syncBtnRef}
                  size="md"
                  variant="primary"
                  onPress={handleSyncRepos}
                  className="h-9 px-6 bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg cursor-pointer"
                >
                  Sync Repositories
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="main-content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3.5 flex-1 flex flex-col"
              >
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
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={true}
                          className="h-7 rounded-lg text-[9px] font-bold tracking-wider uppercase px-4 bg-muted text-muted-foreground shrink-0 shadow-none cursor-not-allowed transition-all duration-300"
                        >
                          Link to CV
                        </Button>
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

                          <div className="mt-auto flex items-center justify-between shrink-0 h-4">
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
                                    disabled={repo1State !== "unanalyzed"}
                                    onPress={handleAnalyzeRepo1}
                                    className={cn(
                                      "h-7 text-[8px] font-bold uppercase px-3 transition-colors",
                                      repo1State === "unanalyzed"
                                        ? "cursor-pointer bg-accent hover:bg-accent/90 text-accent-foreground border-none shadow-xs"
                                        : "cursor-default text-muted-foreground bg-muted border-none"
                                    )}
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

                          <div className="mt-auto flex items-center justify-between shrink-0 h-4">
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
                                    disabled={repo2State !== "unanalyzed"}
                                    onPress={handleAnalyzeRepo2}
                                    className={cn(
                                      "h-7 text-[8px] font-bold uppercase px-3 transition-colors",
                                      repo2State === "unanalyzed"
                                        ? "cursor-pointer bg-accent hover:bg-accent/90 text-accent-foreground border-none shadow-xs"
                                        : "cursor-default text-muted-foreground bg-muted border-none"
                                    )}
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

                {/* Console / Verification Logs */}
                <AnimatePresence>
                  {(phase === "analyzingBoth" || phase === "resultsCompleted" || phase === "moveCursorToLink" || phase === "linkHover") && (
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      transition={{ duration: 0.5, ease: EASE_EXPO }}
                      className="rounded-xl border border-border bg-surface-secondary/50 p-3 font-mono text-[9px] text-foreground/80 select-none shadow-xs text-left shrink-0 min-h-33"
                    >
                      <div className="flex items-center justify-between border-b border-border/80 pb-2 mb-2">
                        <span className="text-muted font-bold uppercase tracking-wider">Verification Engine Output</span>
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                          <span className="text-accent font-bold">Active Handshake</span>
                        </div>
                      </div>
                      <div className="space-y-1 max-h-[73px] overflow-y-auto scrollbar-thin">
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
