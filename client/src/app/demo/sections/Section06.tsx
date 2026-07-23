"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  ShieldCheck,
  Check,
  MapPin,
  Building,
  Award,
  ArrowRight,
  Users,
} from "lucide-react";
import { Card, Chip } from "@heroui/react";
import { Button } from "@/components/ui/button";
import { Github, Gitlab } from "@thesvg/react";

import { useDemoStore, type SceneLifecycleState } from "../stores/use-demo-store";
import { DemoMockupShell } from "../components/DemoMockupShell";
import { VirtualCursor } from "../components/VirtualCursor";
import { cn } from "@/lib/utils";
import {
  SECTION06_JD,
  SECTION06_AI_CANDIDATES,
  SECTION06_MANUAL_CANDIDATES,
  SECTION06_RANKINGS,
  Candidate,
  RankingItem,
} from "../data/mock-demo-data";

interface Section06Props {
  lifecycleState: SceneLifecycleState;
  onStateComplete: (state: SceneLifecycleState) => void;
  currentPhaseId: string;
  isPhaseCompleted: boolean;
  onPhaseComplete: () => void;
}

export function Section06({
  lifecycleState,
  onStateComplete,
  currentPhaseId,
  isPhaseCompleted,
  onPhaseComplete,
}: Section06Props) {
  const router = useRouter();
  const setStatusMessage = useDemoStore((state) => state.setStatusMessage);

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

  // Layout and view states
  const [shellVisible, setShellVisible] = useState(false);
  const [visibleCandidates, setVisibleCandidates] = useState(0); // 0 to 5
  const [visibleRankings, setVisibleRankings] = useState(0); // 0 to 5
  const [hoveredApproveId, setHoveredApproveId] = useState<string | null>(null);
  const [showHiringModal, setShowHiringModal] = useState(false);
  const [phase, setPhase] = useState<"reveal" | "discovery" | "ranking" | "decision" | "approved" | "transitioning">("reveal");

  // Virtual Cursor overlay coordinates & state
  const [cursorCoords, setCursorCoords] = useState<{ x: number; y: number } | null>(null);
  const [initialCoords, setInitialCoords] = useState<{ x: number; y: number }>({ x: 750, y: 350 });
  const [cursorClicking, setCursorClicking] = useState(false);
  const [cursorRipple, setCursorRipple] = useState(false);

  // Element Refs for layout calculations
  const workspaceRef = useRef<HTMLDivElement>(null);
  const candidateCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const rankingCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const rankingListRef = useRef<HTMLDivElement>(null);
  const candidateListRef = useRef<HTMLDivElement>(null);

  // Update cursor position relative to an element ref
  const updateCursorToRef = useCallback((
    element: HTMLElement | null,
    offsetX = 0,
    offsetY = 0
  ) => {
    if (!element || !workspaceRef.current) return;
    const rect = element.getBoundingClientRect();
    const workspaceRect = workspaceRef.current.getBoundingClientRect();
    const targetX = rect.left - workspaceRect.left + (offsetX || rect.width / 2);
    const targetY = rect.top - workspaceRect.top + (offsetY || rect.height / 2);
    setCursorCoords({ x: targetX, y: targetY });
  }, []);

  // Handle final submission and transition
  const handleApproveAction = useCallback(() => {
    if (phase === "approved" || phase === "transitioning") return;

    setPhase("approved");
    setShowHiringModal(true);
    setCursorClicking(true);
    setCursorRipple(true);
    setStatusMessage("Hiring decision confirmed with CVerify cryptographic proof!");
  }, [phase, setStatusMessage]);

  const handleApproveClick = (candidateId: string) => {
    if (candidateId !== "candidate-1") return; // only Kaivian can be approved in demo context
    if (currentPhaseId !== "decision") return;

    useDemoStore.setState({ isPlaying: true });
    onPhaseComplete(); // Trigger transition to approved phase
  };

  // Reset states on beforeEnter
  useEffect(() => {
    if (lifecycleState === "beforeEnter") {
      clearAllTimers();
      setCursorCoords(null);
      setCursorClicking(false);
      setCursorRipple(false);
      setShowHiringModal(false);
      setHoveredApproveId(null);
      setShellVisible(false);

      if (currentPhaseId === "discovery") {
        setPhase("reveal");
        setVisibleCandidates(0);
        setVisibleRankings(0);
      } else if (currentPhaseId === "ranking") {
        setPhase("ranking");
        setVisibleCandidates(5);
        setVisibleRankings(0);
      } else if (currentPhaseId === "decision") {
        setPhase("decision");
        setVisibleCandidates(5);
        setVisibleRankings(5);
      } else if (currentPhaseId === "approved") {
        setPhase("approved");
        setVisibleCandidates(5);
        setVisibleRankings(5);
        setShowHiringModal(true);
      }
    }
  }, [lifecycleState, currentPhaseId]);

  // Phase runner state machine
  useEffect(() => {
    clearAllTimers();

    if (lifecycleState !== "active") return;

    // Check if state needs to be restored deterministically without animations
    if (isPhaseCompleted) {
      setShellVisible(true);
      setVisibleCandidates(5);
      setVisibleRankings(5);
      setCursorCoords(null);
      setCursorClicking(false);
      setCursorRipple(false);

      if (currentPhaseId === "discovery") {
        setPhase("ranking");
      } else if (currentPhaseId === "ranking") {
        setPhase("decision");
      } else if (currentPhaseId === "decision") {
        setPhase("decision");
        // Place cursor directly on Kaivian's approve button in the ranking column
        const restoreCursorTimer = setTimeout(() => {
          const cardElement = rankingCardRefs.current["candidate-1"];
          const approveBtn = cardElement?.querySelector("button");
          if (approveBtn) {
            updateCursorToRef(approveBtn as HTMLElement);
            setCursorRipple(true);
            setHoveredApproveId("candidate-1");
          }
        }, 100);
        registerTimer(restoreCursorTimer);
      } else if (currentPhaseId === "approved") {
        setPhase("approved");
        setShowHiringModal(true);
      }
      onStateComplete("active");
      return;
    }

    // Play Mode (live animations)
    setShellVisible(true);
    onStateComplete("active");

    if (currentPhaseId === "discovery") {
      setPhase("discovery");
      setVisibleCandidates(0);
      setVisibleRankings(0);
      setCursorCoords(null);

      let count = 0;
      const interval = setInterval(() => {
        count++;
        setVisibleCandidates(count);
        if (count >= 5) {
          clearInterval(interval);
          const transitionTimer = setTimeout(() => {
            onPhaseComplete();
          }, 400);
          registerTimer(transitionTimer);
        }
      }, 250);
      registerInterval(interval);

    } else if (currentPhaseId === "ranking") {
      setPhase("ranking");
      setVisibleCandidates(5);
      setVisibleRankings(0);
      setCursorCoords(null);

      let count = 0;
      const interval = setInterval(() => {
        count++;
        setVisibleRankings(count);
        if (count >= 5) {
          clearInterval(interval);
          const transitionTimer = setTimeout(() => {
            onPhaseComplete();
          }, 400);
          registerTimer(transitionTimer);
        }
      }, 300);
      registerInterval(interval);

    } else if (currentPhaseId === "decision") {
      setPhase("decision");
      setVisibleCandidates(5);
      setVisibleRankings(5);
      setHoveredApproveId(null);
      setCursorClicking(false);
      setCursorRipple(false);
      setInitialCoords({ x: 750, y: 320 });

      // Move cursor to Kaivian's approve button in the ranking column
      const cursorMoveTimer = setTimeout(() => {
        const cardElement = rankingCardRefs.current["candidate-1"];
        const approveBtn = cardElement?.querySelector("button");
        if (approveBtn) {
          updateCursorToRef(approveBtn as HTMLElement);
        }
      }, 500);
      registerTimer(cursorMoveTimer);

      // Trigger hover effects and ripple when cursor arrives
      const cursorArriveTimer = setTimeout(() => {
        setCursorRipple(true);
        setHoveredApproveId("candidate-1");
      }, 1300);
      registerTimer(cursorArriveTimer);

    } else if (currentPhaseId === "approved") {
      setVisibleCandidates(5);
      setVisibleRankings(5);
      setCursorCoords(null);
      handleApproveAction();
    }
  }, [currentPhaseId, isPhaseCompleted, lifecycleState, onStateComplete, onPhaseComplete, handleApproveAction, updateCursorToRef]);

  // Synchronize cursor position on container resize or scrolling
  useEffect(() => {
    if (isPhaseCompleted) return;
    if (phase !== "decision" && phase !== "approved") return;

    const handleSync = () => {
      const cardElement = rankingCardRefs.current["candidate-1"];
      const approveBtn = cardElement?.querySelector("button");
      if (approveBtn) {
        updateCursorToRef(approveBtn as HTMLElement);
      }
    };

    window.addEventListener("resize", handleSync);

    const scrollContainer = rankingListRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", handleSync);
    }

    return () => {
      window.removeEventListener("resize", handleSync);
      if (scrollContainer) {
        scrollContainer.removeEventListener("scroll", handleSync);
      }
    };
  }, [phase, updateCursorToRef, isPhaseCompleted]);

  // Auto-scroll candidates list to the bottom as they reveal during discovery phase
  useEffect(() => {
    if (isPhaseCompleted) return;
    if (phase !== "discovery") return;

    const container = candidateListRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [visibleCandidates, phase, isPhaseCompleted]);

  // Combined candidates array with visibility flag
  const allCandidates = [
    ...SECTION06_AI_CANDIDATES.map((c, i) => ({ ...c, isAI: true, index: i })),
    ...SECTION06_MANUAL_CANDIDATES.map((c, i) => ({ ...c, isAI: false, index: i + 3 })),
  ];

  return (
    <div
      ref={workspaceRef}
      className="w-full max-w-5xl h-[520px] border-2 border-border/80 rounded-2xl overflow-hidden bg-background shadow-2xl flex text-foreground font-sans relative"
    >
      <DemoMockupShell
        title="AI Candidate Review & Approval"
        role="recruiter"
        userName="Kaivian"
        activeTab="Candidates"
        shellVisible={shellVisible}
      >
        {/* Left Column: Job Context & Candidates list */}
        <div className="w-[58%] flex flex-col h-full overflow-hidden text-left gap-3">
          {/* Active Job Description Header Widget */}
          <div className="border border-border/50 rounded-xl p-3 bg-surface-secondary/15 space-y-1.5 shrink-0 select-none">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xs font-bold text-foreground font-outfit">{SECTION06_JD.position}</h3>
                <div className="flex items-center gap-2 mt-0.5 text-[8px] text-muted font-medium">
                  <span className="flex items-center gap-0.5"><Building size={8} /> {SECTION06_JD.department}</span>
                  <span className="flex items-center gap-0.5"><MapPin size={8} /> {SECTION06_JD.location} ({SECTION06_JD.workMode})</span>
                  <span className="flex items-center gap-0.5"><Award size={8} /> {SECTION06_JD.experience} Experience</span>
                </div>
              </div>
              <Chip
                size="sm"
                variant="soft"
                className="h-4 px-1.5 text-[7px] font-extrabold uppercase rounded bg-accent/15 text-accent border border-accent/20"
              >
                {SECTION06_JD.type}
              </Chip>
            </div>
            <p className="text-[8px] text-foreground/80 leading-normal font-light">
              <span className="font-bold text-accent">Hiring Context:</span> {SECTION06_JD.summary}
            </p>
            <div className="flex flex-wrap gap-1 items-center">
              <span className="text-[7.5px] text-muted font-extrabold uppercase tracking-wider mr-1">Required:</span>
              {SECTION06_JD.skills.map((sk) => (
                <Chip
                  key={sk}
                  size="sm"
                  variant="soft"
                  className="h-3.5 px-1 text-[6.5px] font-semibold border border-border/50 bg-background text-foreground"
                >
                  {sk}
                </Chip>
              ))}
            </div>
          </div>

          {/* Scrollable list viewport for AI Recommended & Manual Candidates */}
          <div ref={candidateListRef} className="flex-1 overflow-y-auto scrollbar-none space-y-3.5 px-2">
            {/* AI Recommendation section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between shrink-0 border-b border-border/40 pb-1">
                <span className="text-[9px] font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles size={10} className="text-accent animate-pulse" />
                  AI Matching (Recommended)
                </span>
                <span className="text-[7px] font-mono text-muted">Ranked by score</span>
              </div>

              <div className="space-y-2">
                {allCandidates
                  .filter((c) => c.isAI)
                  .map((c) => {
                    const isVisible = visibleCandidates > c.index;
                    const isTopCandidate = c.id === "candidate-1";
                    const isHovered = hoveredApproveId === c.id;

                    return (
                      <AnimatePresence key={c.id}>
                        {isVisible && (
                          <motion.div
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            transition={{ type: "spring", stiffness: 260, damping: 25 }}
                            ref={(el) => { candidateCardRefs.current[c.id] = el; }}
                            className={cn(
                              "p-2.5 rounded-lg border text-left bg-background transition-all duration-300 relative select-none flex flex-col gap-1.5",
                              isTopCandidate
                                ? isHovered
                                  ? "border-accent bg-accent-soft/5 shadow-[0_0_12px_rgba(133,78,40,0.15)]"
                                  : "border-accent/40 bg-accent-soft/3"
                                : "border-border/60 hover:border-border hover:bg-surface-secondary/5"
                            )}
                          >
                            {/* Verified ribbon glow */}
                            {isTopCandidate && (
                              <span className="absolute -top-1 -left-1 flex h-2 w-2 z-10">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
                              </span>
                            )}

                            {/* Header row: Avatar, Name, scores */}
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-accent-soft/20 text-accent font-extrabold flex items-center justify-center text-[9px] border border-accent/25">
                                  {c.initials}
                                </div>
                                <div>
                                  <h4 className="text-[9.5px] font-bold text-foreground leading-tight flex items-center gap-1.5">
                                    {c.name}
                                    {c.isVerified && (
                                      <Chip
                                        size="sm"
                                        variant="soft"
                                        className="h-3.5 px-1 text-[6.5px] font-bold uppercase rounded bg-success-foreground/15 text-success border border-success/20 flex items-center gap-0.5"
                                      >
                                        <ShieldCheck size={7} /> Verified
                                      </Chip>
                                    )}
                                  </h4>
                                  <span className="text-[7.5px] text-muted">{c.role} • {c.experience}</span>
                                </div>
                              </div>

                              {/* Scores layout */}
                              <div className="flex items-center gap-1.5">
                                <div className="text-[8px] font-bold px-1.5 py-0.5 rounded-sm bg-success-foreground/10 text-success border border-success/15 font-mono">
                                  {c.matchScore}% Match
                                </div>
                                <div className="text-[8px] font-bold px-1.5 py-0.5 rounded-sm bg-accent-soft/10 text-accent border border-accent/15 font-mono">
                                  {c.trustScore}% Trust
                                </div>
                              </div>
                            </div>

                            {/* Info row: Provider icons and verified skills */}
                            <div className="flex items-center justify-between mt-1">
                              <div className="flex items-center gap-1">
                                {c.skills.map((sk) => (
                                  <Chip
                                    key={sk}
                                    size="sm"
                                    variant="soft"
                                    className="h-3.5 px-1 text-[6.5px] font-semibold border border-success/15 bg-success-foreground/5 text-success rounded-xs"
                                  >
                                    {sk}
                                  </Chip>
                                ))}
                              </div>

                              {/* Providers badge */}
                              <div className="flex items-center gap-1 text-muted">
                                {c.providers.includes("github") && <Github className="w-3.5 h-3.5 text-foreground/80" />}
                                {c.providers.includes("gitlab") && <Gitlab className="w-3.5 h-3.5 text-foreground/80" />}
                              </div>
                            </div>


                          </motion.div>
                        )}
                      </AnimatePresence>
                    );
                  })}
              </div>
            </div>

            {/* Manual Applied Candidates section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between shrink-0 border-b border-border/40 pb-1">
                <span className="text-[9px] font-bold text-foreground flex items-center gap-1.5">
                  <Users size={10} className="text-muted-foreground" />
                  Manual Apply (General Pool)
                </span>
                <span className="text-[7px] font-mono text-muted">Self-reported data</span>
              </div>

              <div className="space-y-2">
                {allCandidates
                  .filter((c) => !c.isAI)
                  .map((c) => {
                    const isVisible = visibleCandidates > c.index;

                    return (
                      <AnimatePresence key={c.id}>
                        {isVisible && (
                          <motion.div
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            transition={{ type: "spring", stiffness: 260, damping: 25 }}
                            className="p-2.5 rounded-lg border border-border/60 bg-background/60 hover:bg-surface-secondary/5 text-left transition-all duration-300 select-none flex flex-col gap-1.5"
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-muted/15 text-muted-foreground font-extrabold flex items-center justify-center text-[9px] border border-border">
                                  {c.initials}
                                </div>
                                <div>
                                  <h4 className="text-[9.5px] font-bold text-foreground/80 leading-tight flex items-center gap-1.5">
                                    {c.name}
                                    <Chip
                                      size="sm"
                                      variant="soft"
                                      className="h-3.5 px-1 text-[6.5px] font-bold uppercase rounded bg-muted/10 text-muted border border-border/45 flex items-center"
                                    >
                                      Unverified
                                    </Chip>
                                  </h4>
                                  <span className="text-[7.5px] text-muted">{c.role} • {c.experience}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <div className="text-[8px] font-bold px-1.5 py-0.5 rounded-sm bg-muted/10 text-muted-foreground border border-border/50 font-mono">
                                  {c.matchScore}% Match
                                </div>
                                <div className="text-[8px] font-bold px-1.5 py-0.5 rounded-sm bg-danger-foreground/10 text-danger border border-danger/15 font-mono">
                                  {c.trustScore}% Trust
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between mt-1">
                              <div className="flex items-center gap-1">
                                {c.skills.map((sk) => (
                                  <Chip
                                    key={sk}
                                    size="sm"
                                    variant="soft"
                                    className="h-3.5 px-1 text-[6.5px] font-medium border border-border/50 bg-muted/5 text-muted-foreground rounded-xs"
                                  >
                                    {sk}
                                  </Chip>
                                ))}
                              </div>
                              <span className="text-[7px] text-muted italic font-medium">No verified sources linked</span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: AI Ranking Board */}
        <div className="w-[42%] flex flex-col h-full overflow-hidden text-left border-l border-border/30 pl-4">
          <div className="flex items-center justify-between pb-2 shrink-0 border-b border-border/40 mb-2.5">
            <div className="flex items-center gap-1.5">
              <Sparkles size={11} className="text-accent" />
              <span className="text-xs font-bold text-foreground font-outfit">AI Recommendation Rankings</span>
            </div>
            <span className="text-[7.5px] text-muted font-mono">Top Candidates</span>
          </div>

          {/* Ranking list container */}
          <div ref={rankingListRef} className="flex-1 flex flex-col gap-2 overflow-y-auto scrollbar-none pr-0.5 select-none py-1">
            {SECTION06_RANKINGS.map((item, idx) => {
              const isVisible = visibleRankings > idx;

              // Border and backgrounds themed dynamically based on rank colors (gold, silver, bronze, gray)
              let cardStyle = "border-border/60 bg-muted/5";
              let badgeStyle = "bg-muted-foreground/30 text-foreground/80";
              let titleColor = "text-foreground";

              if (item.colorType === "gold") {
                cardStyle = "border-amber-400/80 bg-amber-500/5";
                badgeStyle = "bg-amber-500 text-white font-black shadow-xs";
                titleColor = "text-amber-800 font-extrabold";
              } else if (item.colorType === "silver") {
                cardStyle = "border-slate-300 bg-slate-400/5";
                badgeStyle = "bg-slate-400 text-white font-bold";
                titleColor = "text-slate-700 font-extrabold";
              } else if (item.colorType === "bronze") {
                cardStyle = "border-orange-400 bg-orange-500/5";
                badgeStyle = "bg-orange-500 text-white font-bold";
                titleColor = "text-orange-800 font-extrabold";
              }

              return (
                <AnimatePresence key={item.candidateId}>
                  {isVisible ? (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      ref={(el) => { rankingCardRefs.current[item.candidateId] = el; }}
                      transition={{ type: "spring", stiffness: 220, damping: 23 }}
                      className={cn(
                        "p-2.5 rounded-lg border text-left transition-all duration-300 relative flex flex-col gap-1.5",
                        cardStyle
                      )}
                    >
                      {/* Rank Indicator Badge */}
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-2">
                          <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[9px] shrink-0 font-mono", badgeStyle)}>
                            {item.rank}
                          </div>
                          <div>
                            <h4 className={cn("text-[9.5px] leading-tight", titleColor)}>
                              {item.name}
                            </h4>
                          </div>
                        </div>

                        {/* Summary scores */}
                        <div className="flex items-center gap-1 text-[7.5px] font-mono font-bold text-muted-foreground">
                          <span>M: {item.matchScore}%</span>
                          <span className="text-border/60">•</span>
                          <span>T: {item.trustScore}%</span>
                        </div>
                      </div>

                      {/* Brief strength summary */}
                      <p className="text-[7.5px] text-foreground/80 leading-relaxed font-light">
                        {item.strengthSummary}
                      </p>

                      {/* Approve button row (visible for Gold candidate in the ranking column) */}
                      {item.colorType === "gold" && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="border-t border-amber-400/20 mt-1.5 pt-1.5 flex items-center justify-between"
                        >
                          <span className="text-[7.5px] text-amber-700 font-semibold flex items-center gap-0.5">
                            <Sparkles size={8} className="animate-pulse" /> Top Match
                          </span>
                          <Button
                            variant="primary"
                            onPress={() => handleApproveClick(item.candidateId)}
                            disabled={currentPhaseId !== "decision"}
                            className={cn(
                              "h-5.5 text-[7.5px] font-extrabold uppercase px-2.5 tracking-wider rounded-md transition-all duration-300 shrink-0",
                              hoveredApproveId === item.candidateId ? "bg-accent text-white shadow-[0_0_12px_rgba(133,78,40,0.5)] scale-[1.03]" : "bg-accent/90 text-white",
                              currentPhaseId !== "decision" ? "cursor-not-allowed opacity-80" : "cursor-pointer"
                            )}
                          >
                            {phase === "approved" || phase === "transitioning" ? (
                              <span className="flex items-center gap-0.5">
                                <motion.span
                                  animate={{ rotate: 360 }}
                                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                                  className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full"
                                />
                                Hiring...
                              </span>
                            ) : (
                              <span className="flex items-center gap-0.5">
                                Approve & Hire <ArrowRight size={8} />
                              </span>
                            )}
                          </Button>
                        </motion.div>
                      )}
                    </motion.div>
                  ) : (
                    idx === 0 && (
                      <div key={`placeholder-${idx}`} className="flex-1 flex items-center justify-center text-muted/20 italic text-[9px] select-none h-full py-16">
                        Running AI verification scoring...
                      </div>
                    )
                  )}
                </AnimatePresence>
              );
            })}
          </div>
        </div>
      </DemoMockupShell>

      {/* Celebratory Confirmation Modal / Overlay */}
      <AnimatePresence>
        {showHiringModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-md z-99 flex items-center justify-center select-none"
          >
            <motion.div
              initial={{ scale: 0.85, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.85, y: -15, opacity: 0 }}
              transition={{ type: "spring", stiffness: 240, damping: 24 }}
              className="max-w-md w-full mx-6 p-6 border-2 border-accent/40 bg-surface rounded-2xl shadow-2xl text-center space-y-4"
            >
              {/* Animated checkmark */}
              <div className="mx-auto w-12 h-12 bg-success-foreground/20 text-success border border-success/35 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(22,156,70,0.15)]">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.15, type: "spring" }}
                >
                  <Check size={24} className="stroke-3" />
                </motion.div>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-extrabold font-outfit text-foreground tracking-tight">Hiring Decision Confirmed</h3>
                <p className="text-xs text-muted leading-relaxed">
                  <span className="text-accent font-bold">Kaivian</span> has been approved as the <span className="font-semibold text-foreground/80">Principal Systems Architect</span>.
                </p>
              </div>

              {/* Verified details widget */}
              <div className="p-3 bg-success-foreground/5 border border-success/15 rounded-xl text-left space-y-1.5 select-none">
                <span className="text-[7.5px] font-bold uppercase tracking-wider text-success flex items-center gap-1">
                  <ShieldCheck size={10} /> CVerify Attestation Sealed
                </span>
                <div className="grid grid-cols-2 gap-2 text-[8.5px]">
                  <div>
                    <span className="text-muted block">Hired Candidate</span>
                    <span className="font-bold text-foreground">Kaivian</span>
                  </div>
                  <div>
                    <span className="text-muted block">Proven Experience</span>
                    <span className="font-bold text-foreground">8+ Years (Verified)</span>
                  </div>
                  <div>
                    <span className="text-muted block">Trust score</span>
                    <span className="font-bold text-success">99% Absolute Trust</span>
                  </div>
                  <div>
                    <span className="text-muted block">Matching index</span>
                    <span className="font-bold text-accent">98% AI Match</span>
                  </div>
                </div>
              </div>

              <div className="pt-3">
                <Button
                  variant="primary"
                  onPress={() => router.push("/login")}
                  className="w-full h-8 text-[11px] font-bold uppercase tracking-wider bg-accent hover:bg-accent-dark text-white rounded-lg flex items-center justify-center gap-1.5 transition-all duration-300 shadow-md hover:shadow-lg scale-100 hover:scale-[1.02] cursor-pointer"
                >
                  Complete Walkthrough & Login <ArrowRight size={10} />
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reusable Virtual Mouse Cursor Overlay */}
      <VirtualCursor
        cursorCoords={cursorCoords}
        initialCoords={initialCoords}
        cursorClicking={cursorClicking}
        cursorRipple={cursorRipple}
        phase={phase}
      />
    </div>
  );
}

export default Section06;
