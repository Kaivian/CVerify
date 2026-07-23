"use client";

import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  LayoutDashboard,
  User,
  Briefcase,
  Settings,
  Bell,
  Sparkles,
  ShieldCheck,
  Check,
  MapPin,
  Building,
  DollarSign,
  TrendingUp,
  Cpu,
  Award,
  ArrowRight,
  BrainCircuit,
  Search,
} from "lucide-react";
import { Card, Chip } from "@heroui/react";
import { Button } from "@/components/ui/button";
import { useDemoStore, type SceneLifecycleState } from "../stores/use-demo-store";
import { cn } from "@/lib/utils";

interface Section05Props {
  lifecycleState: SceneLifecycleState;
  onStateComplete: (state: SceneLifecycleState) => void;
  currentPhaseId: string;
  isPhaseCompleted: boolean;
  onPhaseComplete: () => void;
}

const EASE_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

// Raw jobs data
const MOCK_JOBS = [
  {
    id: "job-1",
    company: "CVerify",
    position: "Principal Systems Architect",
    location: "San Francisco, CA",
    type: "Full-time",
    workMode: "Hybrid",
    baseSalary: "$190,000 - $240,000",
    skills: ["Go", "TypeScript", "Cryptography", "ZK-Proofs"],
    baseScore: 40,
    skillsScore: 78,
    finalScore: 98,
    isTopMatch: true,
  },
  {
    id: "job-2",
    company: "ZeroKnowledge Labs",
    position: "Lead Cryptography Engineer",
    location: "Austin, TX",
    type: "Full-time",
    workMode: "Remote",
    baseSalary: "$180,000 - $220,000",
    skills: ["Go", "Rust", "Cryptography", "ZK-Proofs"],
    baseScore: 35,
    skillsScore: 74,
    finalScore: 94,
    isTopMatch: false,
  },
  {
    id: "job-3",
    company: "Reactify Labs",
    position: "Senior Frontend Engineer",
    location: "San Francisco, CA",
    type: "Full-time",
    workMode: "Hybrid",
    baseSalary: "$160,000 - $200,000",
    skills: ["React", "TypeScript", "TailwindCSS"],
    baseScore: 42,
    skillsScore: 68,
    finalScore: 85,
    isTopMatch: false,
  },
  {
    id: "job-4",
    company: "CloudScale Systems",
    position: "Platform / DevOps Architect",
    location: "Remote",
    type: "Full-time",
    workMode: "Remote",
    baseSalary: "$170,000 - $210,000",
    skills: ["Go", "Kubernetes", "Terraform"],
    baseScore: 30,
    skillsScore: 58,
    finalScore: 76,
    isTopMatch: false,
  },
  {
    id: "job-5",
    company: "Enterprise Core",
    position: "C# Backend Developer",
    location: "Redmond, WA",
    type: "Full-time",
    workMode: "On-site",
    baseSalary: "$150,000 - $185,000",
    skills: ["ASP.NET Core", "C#", "SQL"],
    baseScore: 28,
    skillsScore: 48,
    finalScore: 65,
    isTopMatch: false,
  },
  {
    id: "job-6",
    company: "NeuralNet AI",
    position: "AI Platform Engineer",
    location: "San Francisco, CA",
    type: "Full-time",
    workMode: "On-site",
    baseSalary: "$200,000 - $260,000",
    skills: ["Python", "PyTorch", "Go"],
    baseScore: 20,
    skillsScore: 40,
    finalScore: 52,
    isTopMatch: false,
  }
];

export function Section05({
  lifecycleState,
  onStateComplete,
  currentPhaseId,
  isPhaseCompleted,
  onPhaseComplete,
}: Section05Props) {
  const prefersReducedMotion = useReducedMotion();
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

  // Layout states
  const [shellVisible, setShellVisible] = useState(false);

  // Deterministic local state machine
  const [phase, setPhase] = useState<
    | "reveal"
    | "analyzingCv"
    | "jobMatching"
    | "rankingCompleted"
    | "cursorNavigation"
    | "highestMatchSelected"
    | "readyToApply"
    | "submitting"
    | "transitioning"
  >("reveal");

  // CV Analysis streaming items
  const [analyzedSkills, setAnalyzedSkills] = useState<string[]>([]);
  const [seniorityAssessment, setSeniorityAssessment] = useState("");
  const [trustScore, setTrustScore] = useState(0);
  const [overallScore, setOverallScore] = useState(0);
  const [aiSummary, setAiSummary] = useState("");
  const [strengths, setStrengths] = useState<string[]>([]);

  // Job scores tracking
  const [jobScores, setJobScores] = useState<Record<string, number>>({});
  const [jobStates, setJobStates] = useState<Record<string, "calculating" | "done">>({});

  // Virtual Cursor overlay coordinates & state
  const [cursorCoords, setCursorCoords] = useState<{ x: number; y: number } | null>(null);
  const [initialCoords, setInitialCoords] = useState<{ x: number; y: number }>({ x: 800, y: 350 });
  const [cursorClicking, setCursorClicking] = useState(false);
  const [cursorRipple, setCursorRipple] = useState(false);

  // Element Refs for layout calculations
  const workspaceRef = useRef<HTMLDivElement>(null);
  const jobListRef = useRef<HTMLDivElement>(null);

  // Refs for job items to dynamic coordinate tracking
  const jobCardsRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const applyBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Summary text to type
  const targetSummaryText = "Security-focused systems architect with 8+ years of engineering robust TypeScript applications and cryptographically secure APIs.";

  // Determine sorted jobs based on current calculated scores
  const sortedJobs = useMemo(() => {
    return [...MOCK_JOBS].sort((a, b) => {
      const scoreA = jobScores[a.id] ?? 0;
      const scoreB = jobScores[b.id] ?? 0;
      return scoreB - scoreA;
    });
  }, [jobScores]);

  // Find dynamically which job currently has the highest score
  const highestMatchJob = useMemo(() => {
    if (sortedJobs.length === 0) return null;
    return sortedJobs[0];
  }, [sortedJobs]);

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
  const handleApply = useCallback(() => {
    if (phase === "submitting" || phase === "transitioning") return;

    setPhase("submitting");
    useDemoStore.setState({ isPlaying: true, subStage: 1 });

    setStatusMessage("Preparing your verified application...");

    if (isPhaseCompleted) return;

    setTimeout(() => {
      setPhase("transitioning");
      onPhaseComplete();
    }, 1000);
  }, [phase, isPhaseCompleted, onPhaseComplete, setStatusMessage]);

  // Reset states on beforeEnter
  useEffect(() => {
    if (lifecycleState === "beforeEnter") {
      clearAllTimers();
      if (currentPhaseId === "ai-match") {
        setPhase("reveal");
        setAnalyzedSkills([]);
        setSeniorityAssessment("");
        setTrustScore(0);
        setOverallScore(0);
        setAiSummary("");
        setStrengths([]);
        setCursorCoords(null);
        setCursorClicking(false);
        setCursorRipple(false);
        setShellVisible(false);

        const initialScores: Record<string, number> = {};
        const initialStates: Record<string, "calculating" | "done"> = {};
        MOCK_JOBS.forEach((j) => {
          initialScores[j.id] = j.baseScore;
          initialStates[j.id] = "calculating";
        });
        setJobScores(initialScores);
        setJobStates(initialStates);
      } else {
        setPhase("readyToApply");
        setAnalyzedSkills(["TypeScript", "Go", "React", "Cryptography", "ZK-Proofs"]);
        setSeniorityAssessment("Principal Level");
        setTrustScore(99);
        setOverallScore(96);
        setAiSummary(targetSummaryText);
        setStrengths(["Cryptographic Engineering", "Distributed Architecture", "Zero-Knowledge Proofs"]);
        setCursorCoords(null);
        setCursorClicking(false);
        setCursorRipple(false);
        setShellVisible(true);

        const finalScores: Record<string, number> = {};
        const finalStates: Record<string, "calculating" | "done"> = {};
        MOCK_JOBS.forEach((j) => {
          finalScores[j.id] = j.finalScore;
          finalStates[j.id] = "done";
        });
        setJobScores(finalScores);
        setJobStates(finalStates);
      }
    }
  }, [lifecycleState, currentPhaseId]);

  // Phase runner state machine
  // Stable refs for tracking latest job lists without restarting phase transitions
  const sortedJobsRef = useRef(sortedJobs);
  useEffect(() => {
    sortedJobsRef.current = sortedJobs;
  }, [sortedJobs]);

  const highestMatchJobRef = useRef(highestMatchJob);
  useEffect(() => {
    highestMatchJobRef.current = highestMatchJob;
  }, [highestMatchJob]);

  // 1. Timing & Phase transition manager (Only runs when phase or lifecycleState changes)
  useEffect(() => {
    clearAllTimers();

    if (lifecycleState !== "active") return;
    if (phase === "submitting" || phase === "transitioning") return;

    if (isPhaseCompleted) {
      setShellVisible(true);
      setAnalyzedSkills(["TypeScript", "Go", "React", "Cryptography", "ZK-Proofs"]);
      setSeniorityAssessment("Principal Level");
      setTrustScore(99);
      setOverallScore(96);
      setAiSummary(targetSummaryText);
      setStrengths(["Cryptographic Engineering", "Distributed Architecture", "Zero-Knowledge Proofs"]);
      setCursorCoords(null);
      setCursorClicking(false);
      setCursorRipple(false);

      const finalScores: Record<string, number> = {};
      const finalStates: Record<string, "calculating" | "done"> = {};
      MOCK_JOBS.forEach((j) => {
        finalScores[j.id] = j.finalScore;
        finalStates[j.id] = "done";
      });
      setJobScores(finalScores);
      setJobStates(finalStates);

      if (currentPhaseId === "ai-match") {
        setPhase("readyToApply");
      } else {
        setPhase("submitting");
      }
      onStateComplete("active");
      return;
    }

    // Play/Animation mode
    if (currentPhaseId === "ai-match") {
      let timer: NodeJS.Timeout;

      if (phase === "reveal") {
        setShellVisible(true);
        onStateComplete("active");
        timer = setTimeout(() => {
          setPhase("analyzingCv");
        }, 800);
        registerTimer(timer);
      } else if (phase === "analyzingCv") {
        timer = setTimeout(() => {
          setPhase("jobMatching");
        }, 1400);
        registerTimer(timer);
      } else if (phase === "jobMatching") {
        timer = setTimeout(() => {
          setPhase("rankingCompleted");
        }, 1600);
        registerTimer(timer);
      } else if (phase === "rankingCompleted") {
        timer = setTimeout(() => {
          setPhase("cursorNavigation");
        }, 2200);
        registerTimer(timer);
      } else if (phase === "cursorNavigation") {
        timer = setTimeout(() => {
          setPhase("highestMatchSelected");
        }, 2500);
        registerTimer(timer);
      } else if (phase === "highestMatchSelected") {
        timer = setTimeout(() => {
          setPhase("readyToApply");
        }, 2000);
        registerTimer(timer);
      }
    } else if (currentPhaseId === "apply") {
      setShellVisible(true);
      setAnalyzedSkills(["TypeScript", "Go", "React", "Cryptography", "ZK-Proofs"]);
      setSeniorityAssessment("Principal Level");
      setTrustScore(99);
      setOverallScore(96);
      setAiSummary(targetSummaryText);
      setStrengths(["Cryptographic Engineering", "Distributed Architecture", "Zero-Knowledge Proofs"]);
      setCursorCoords(null);
      setCursorClicking(false);
      setCursorRipple(false);

      const finalScores: Record<string, number> = {};
      const finalStates: Record<string, "calculating" | "done"> = {};
      MOCK_JOBS.forEach((j) => {
        finalScores[j.id] = j.finalScore;
        finalStates[j.id] = "done";
      });
      setJobScores(finalScores);
      setJobStates(finalStates);

      handleApply();
    }
  }, [phase, currentPhaseId, isPhaseCompleted, lifecycleState, onStateComplete, handleApply]);

  // 2. Phase 1 effect: Analyzing CV
  useEffect(() => {
    if (phase !== "analyzingCv") return;
    if (isPhaseCompleted) return;

    const skillTimer = setTimeout(() => {
      setAnalyzedSkills(["TypeScript", "Go", "React", "Cryptography", "ZK-Proofs"]);
      setJobScores((prev) => {
        const next = { ...prev };
        MOCK_JOBS.forEach((j) => {
          next[j.id] = j.skillsScore;
        });
        return next;
      });
    }, 400);

    const strengthTimer = setTimeout(() => {
      setStrengths(["Cryptographic Engineering", "Distributed Architecture", "Zero-Knowledge Proofs"]);
    }, 900);

    registerTimer(skillTimer);
    registerTimer(strengthTimer);
  }, [phase, isPhaseCompleted]);

  // 3. Phase 2 effect: Job Matching & Score Calculations
  useEffect(() => {
    if (phase !== "jobMatching") return;
    if (isPhaseCompleted) return;

    setSeniorityAssessment("Principal Level");

    let scoreVal = 0;
    const scoreInterval = setInterval(() => {
      scoreVal += 5;
      if (scoreVal >= 99) {
        clearInterval(scoreInterval);
        setTrustScore(99);
        setOverallScore(96);
      } else {
        setTrustScore(Math.min(99, scoreVal));
        setOverallScore(Math.min(96, scoreVal));
      }
    }, 50);

    const calculateJobsTimer = setTimeout(() => {
      setJobScores((prev) => {
        const next = { ...prev };
        MOCK_JOBS.forEach((j) => {
          next[j.id] = j.finalScore;
        });
        return next;
      });
      setJobStates((prev) => {
        const next = { ...prev };
        MOCK_JOBS.forEach((j) => {
          next[j.id] = "done";
        });
        return next;
      });
    }, 600);

    registerInterval(scoreInterval);
    registerTimer(calculateJobsTimer);
  }, [phase, isPhaseCompleted]);

  // 4. Phase 3 effect: AI Summary Typewriter
  useEffect(() => {
    if (phase !== "rankingCompleted") return;
    if (isPhaseCompleted) return;

    let charIdx = 0;
    const typeInterval = setInterval(() => {
      setAiSummary(targetSummaryText.slice(0, charIdx + 1));
      charIdx++;
      if (charIdx >= targetSummaryText.length) {
        clearInterval(typeInterval);
      }
    }, 12);

    registerInterval(typeInterval);
  }, [phase, isPhaseCompleted]);

  // 5. Phase 4 effect: Guided Job Discovery Scrolling
  useEffect(() => {
    if (phase !== "cursorNavigation") return;
    if (isPhaseCompleted) return;

    setInitialCoords({ x: 800, y: 350 });

    const t1 = setTimeout(() => {
      if (jobListRef.current) {
        const firstJobId = sortedJobsRef.current[0]?.id;
        const element = jobCardsRefs.current[firstJobId];
        if (element) {
          updateCursorToRef(element, 150, 40);
        }
      }
    }, 100);

    const t2 = setTimeout(() => {
      if (jobListRef.current) {
        jobListRef.current.scrollTo({
          top: 140,
          behavior: "smooth"
        });
      }
    }, 800);

    const t3 = setTimeout(() => {
      const cloudScaleJob = MOCK_JOBS.find((j) => j.company === "CloudScale Systems");
      if (cloudScaleJob) {
        const element = jobCardsRefs.current[cloudScaleJob.id];
        if (element) {
          updateCursorToRef(element, 150, 30);
        }
      }
    }, 1200);

    const t4 = setTimeout(() => {
      if (jobListRef.current) {
        jobListRef.current.scrollTo({
          top: 0,
          behavior: "smooth"
        });
      }
    }, 1800);

    registerTimer(t1);
    registerTimer(t2);
    registerTimer(t3);
    registerTimer(t4);
  }, [phase, updateCursorToRef, isPhaseCompleted]);

  // 6. Phase 5 & 6 effect: Highest Match Selection & Apply Button Hover
  useEffect(() => {
    if (isPhaseCompleted) return;

    if (phase === "highestMatchSelected") {
      const topJob = highestMatchJobRef.current;
      if (topJob) {
        const element = jobCardsRefs.current[topJob.id];
        if (element) {
          updateCursorToRef(element, 200, 40);
        }
      }
    } else if (phase === "readyToApply") {
      const topJob = highestMatchJobRef.current;
      if (topJob) {
        // Query the button directly inside the card DOM node for maximum reliability
        const cardElement = jobCardsRefs.current[topJob.id];
        const applyBtn = cardElement?.querySelector("button");
        if (applyBtn) {
          updateCursorToRef(applyBtn as HTMLElement);
        }
      }
      setCursorRipple(true);
    }
  }, [phase, updateCursorToRef, isPhaseCompleted]);

  // 7. Scroll sync effect: Recalculates cursor coordinate dynamically while user scrolls
  useEffect(() => {
    if (isPhaseCompleted) return;

    const container = jobListRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (phase === "readyToApply" || phase === "submitting" || phase === "transitioning") {
        const topJob = highestMatchJobRef.current;
        if (topJob) {
          const cardElement = jobCardsRefs.current[topJob.id];
          const applyBtn = cardElement?.querySelector("button");
          if (applyBtn) {
            updateCursorToRef(applyBtn as HTMLElement);
          }
        }
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [phase, updateCursorToRef, isPhaseCompleted]);

  // Motion variants
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

  const mainViewVariants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.7, ease: EASE_EXPO, delay: 0.25 },
    },
  };

  return (
    <div
      ref={workspaceRef}
      className="w-full max-w-5xl h-[520px] border-2 border-border/80 rounded-2xl overflow-hidden bg-background shadow-2xl flex text-foreground font-sans relative"
    >
      {/* 1. MOCK SIDEBAR (Left Column) */}
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
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-accent-soft/10 text-accent font-semibold text-xs transition-colors cursor-default">
            <Briefcase size={16} />
            <span>Job Board</span>
          </div>
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-muted hover:text-foreground text-xs transition-colors cursor-default">
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

      {/* 2. MAIN WORKSPACE VIEWPORT (Right Column) */}
      <div className="flex-1 flex flex-col min-w-0 bg-surface-secondary/20 relative select-none">
        {/* Mock Header */}
        <motion.header
          variants={headerVariants}
          initial="hidden"
          animate={shellVisible ? "visible" : "hidden"}
          className="h-14 px-6 border-b border-border/40 bg-background/35 backdrop-blur-xs flex items-center justify-between shrink-0"
        >
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <span>Job Board</span>
            <span className="text-border">/</span>
            <span className="text-foreground font-semibold">AI Matcher</span>
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

        {/* Content Columns (AI Analysis Panel vs Match Recommendations) */}
        <motion.main
          variants={mainViewVariants}
          initial="hidden"
          animate={shellVisible ? "visible" : "hidden"}
          className="flex-1 flex overflow-hidden p-4 gap-4"
        >
          {/* Left Column: AI CV Analysis Panel */}
          <div className="w-1/2 flex flex-col h-full overflow-hidden">
            <Card className="flex-1 p-3.5 border border-border bg-background shadow-xs text-left flex flex-col h-full overflow-hidden">
              {/* Panel Header */}
              <div className="flex items-center justify-between border-b border-border/40 pb-2 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-accent/15 border border-accent/30 text-accent flex items-center justify-center">
                    <BrainCircuit size={12} className="animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-foreground">AI Profile Analysis</h3>
                    <p className="text-[8px] text-muted">CVerify cryptographic assessment</p>
                  </div>
                </div>
                <Chip
                  size="sm"
                  variant="soft"
                  className="h-4.5 px-1.5 text-[8px] font-extrabold uppercase rounded-sm border border-success/20 text-success bg-success-foreground/20"
                >
                  Verified
                </Chip>
              </div>

              {/* Scrollable Analysis Widgets */}
              <div className="flex-1 flex flex-col gap-2.5 py-0.5 pr-0.5 justify-start">

                {/* 1. Overall Metrics Row (Radial score gauge + Trust Index) */}
                <div className="grid grid-cols-2 gap-2 shrink-0">
                  {/* Circular Score Widget */}
                  <div className="border border-border/50 rounded-lg px-2 bg-surface-secondary/15 flex items-center gap-3">
                    <div className="relative w-10 h-10 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle
                          cx="20"
                          cy="20"
                          r="17"
                          className="text-border/30 stroke-current"
                          strokeWidth="2.5"
                          fill="transparent"
                        />
                        <motion.circle
                          cx="20"
                          cy="20"
                          r="17"
                          className="text-accent stroke-current"
                          strokeWidth="2.5"
                          fill="transparent"
                          strokeDasharray={2 * Math.PI * 17}
                          initial={{ strokeDashoffset: 2 * Math.PI * 17 }}
                          animate={{
                            strokeDashoffset:
                              2 * Math.PI * 17 - (overallScore / 100) * (2 * Math.PI * 17),
                          }}
                          transition={{ duration: 0.8 }}
                        />
                      </svg>
                      <span className="absolute text-[9px] font-mono font-bold">{overallScore || "—"}</span>
                    </div>
                    <div>
                      <p className="text-[7.5px] uppercase tracking-wider font-extrabold text-muted">Overall Match</p>
                      <p className="text-[9px] font-bold text-foreground">AI Readiness</p>
                    </div>
                  </div>

                  {/* Trust Rating Widget */}
                  <div className="border border-border/50 rounded-lg p-2 bg-surface-secondary/15 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-success-foreground/20 text-success flex items-center justify-center shrink-0">
                      <ShieldCheck size={16} />
                    </div>
                    <div>
                      <p className="text-[7.5px] uppercase tracking-wider font-extrabold text-muted">Trust Score</p>
                      <p className="text-[9px] font-bold text-success font-mono">{trustScore ? `${trustScore}%` : "Calculating..."}</p>
                    </div>
                  </div>
                </div>

                {/* 2. Seniority Assessment */}
                <div className="border border-border/50 rounded-lg p-2 bg-surface-secondary/15 space-y-1 shrink-0">
                  <span className="text-[7.5px] uppercase tracking-wider font-bold text-muted block">Seniority Assessment</span>
                  <div className="flex items-center gap-1.5 h-4.5">
                    {seniorityAssessment ? (
                      <motion.div
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-1"
                      >
                        <Award size={11} className="text-accent" />
                        <span className="text-[9px] font-bold text-foreground">{seniorityAssessment}</span>
                        <span className="text-[7.5px] text-muted font-normal">(8+ Years Verified)</span>
                      </motion.div>
                    ) : (
                      <div className="w-2/3 h-3 bg-muted/10 animate-pulse rounded-xs" />
                    )}
                  </div>
                </div>

                {/* 3. Skill & Capabilities (Continuous pipeline source of matching) */}
                <div className="border border-border/50 rounded-lg p-2 bg-surface-secondary/15 space-y-1.5 shrink-0">
                  <span className="text-[7.5px] uppercase tracking-wider font-bold text-muted flex items-center gap-1">
                    <Cpu size={10} /> Extracted Technical Skills
                  </span>
                  <div className="flex flex-wrap gap-1 min-h-[30px]">
                    {analyzedSkills.length > 0 ? (
                      analyzedSkills.map((skill, idx) => (
                        <motion.div
                          key={skill}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: idx * 0.08 }}
                        >
                          <Chip
                            size="sm"
                            variant="soft"
                            className="h-4.5 px-1.5 text-[7px] font-bold border border-border bg-background text-foreground"
                          >
                            {skill}
                          </Chip>
                        </motion.div>
                      ))
                    ) : (
                      <div className="flex gap-1.5 w-full">
                        <div className="w-14 h-4 bg-muted/10 animate-pulse rounded-xs" />
                        <div className="w-10 h-4 bg-muted/10 animate-pulse rounded-xs" />
                        <div className="w-16 h-4 bg-muted/10 animate-pulse rounded-xs" />
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. AI Professional Summary */}
                <div className="border border-border/50 rounded-lg p-2.5 bg-surface-secondary/15 flex-1 flex flex-col gap-1 min-h-[62px] overflow-hidden select-none">
                  <span className="text-[7.5px] uppercase tracking-wider font-bold text-accent">AI Summary Recommendation</span>
                  <p className="text-[8px] text-foreground/80 leading-normal font-light relative h-full flex items-start">
                    {aiSummary || (
                      <span className="text-muted/20 italic font-normal">Analyzing candidate profile summaries...</span>
                    )}
                    {phase === "rankingCompleted" && aiSummary.length < targetSummaryText.length && (
                      <motion.span
                        animate={{ opacity: [1, 0, 1] }}
                        transition={{ repeat: Infinity, duration: 0.8 }}
                        className="inline-block w-0.5 h-2.5 bg-accent ml-0.5"
                      />
                    )}
                  </p>
                </div>

                {/* 5. Key Strengths */}
                <div className="border border-border/50 rounded-lg p-2 bg-surface-secondary/15 space-y-1.5 shrink-0">
                  <span className="text-[7.5px] uppercase tracking-wider font-bold text-muted flex items-center gap-1">
                    <TrendingUp size={10} /> Candidate Strengths
                  </span>
                  <div className="flex flex-col gap-1">
                    {strengths.length > 0 ? (
                      strengths.map((str, idx) => (
                        <motion.div
                          key={str}
                          initial={{ opacity: 0, x: -5 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className="flex items-center gap-1 text-[8px] font-semibold text-success"
                        >
                          <Check size={8} />
                          <span>{str}</span>
                        </motion.div>
                      ))
                    ) : (
                      <div className="space-y-1">
                        <div className="w-3/4 h-2 bg-muted/10 animate-pulse rounded-xs" />
                        <div className="w-1/2 h-2 bg-muted/10 animate-pulse rounded-xs" />
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </Card>
          </div>

          {/* Right Column: Job Recommendations Board */}
          <div className="w-1/2 flex flex-col h-full overflow-hidden">
            <div className="flex-1 flex flex-col h-full relative overflow-hidden">

              {/* Viewport Header */}
              <div className="flex items-center justify-between pb-2 shrink-0 border-b border-border/40 mb-2">
                <div className="flex items-center gap-2">
                  <Search size={12} className="text-muted" />
                  <span className="text-xs font-bold text-foreground">Matched Opportunities</span>
                </div>
                <span className="text-[7.5px] text-muted font-mono">{MOCK_JOBS.length} positions found</span>
              </div>

              {/* Scrollable Job List Viewport */}
              <div
                ref={jobListRef}
                className="flex-1 flex flex-col gap-2 overflow-y-auto scrollbar-none px-2 py-2 pt-4"
                style={{ scrollBehavior: "smooth" }}
              >
                <AnimatePresence initial={false}>
                  {sortedJobs.map((job) => {
                    const score = jobScores[job.id] ?? job.baseScore;
                    const state = jobStates[job.id] ?? "calculating";
                    const isTopHighlighted = phase !== "reveal" && phase !== "analyzingCv" && phase !== "jobMatching" && job.isTopMatch;

                    // Match chip coloring
                    let scoreBg = "bg-surface-secondary/40 text-muted";
                    if (state === "done") {
                      if (score >= 90) scoreBg = "bg-success-foreground/20 text-success border border-success/30";
                      else if (score >= 70) scoreBg = "bg-warning-foreground/20 text-warning border border-warning/30";
                      else scoreBg = "bg-surface-secondary text-muted border border-border/50";
                    }

                    return (
                      <motion.div
                        key={job.id}
                        layoutId={`job-card-${job.id}`}
                        ref={(el) => { jobCardsRefs.current[job.id] = el; }}
                        transition={{ type: "spring", stiffness: 260, damping: 25 }}
                        className={cn(
                          "p-3 rounded-lg border text-left bg-background transition-all duration-300 relative select-none",
                          isTopHighlighted ? "border-accent shadow-[0_0_12px_rgba(133,78,40,0.2)] bg-accent-soft/5" : "border-border/60 hover:border-border hover:bg-surface-secondary/5"
                        )}
                      >
                        {/* Glow effect for dynamic Top Match */}
                        {isTopHighlighted && (
                          <span className="absolute -top-1.5 -left-1.5 flex h-3 w-3 z-10">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-accent" />
                          </span>
                        )}

                        <div className="flex items-start justify-between gap-1.5">
                          {/* Company / Position Info */}
                          <div className="space-y-0.5">
                            <h4 className="text-[10px] font-bold text-foreground leading-tight flex items-center gap-1">
                              {job.position}
                            </h4>
                            <div className="flex items-center gap-2 text-[8px] text-muted">
                              <span className="flex items-center gap-0.5"><Building size={8} /> {job.company}</span>
                              <span className="flex items-center gap-0.5"><MapPin size={8} /> {job.location}</span>
                            </div>
                          </div>

                          {/* Dynamic Match Pill */}
                          <div className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded-sm shrink-0 font-mono", scoreBg)}>
                            {state === "calculating" ? (
                              <span className="flex items-center gap-0.5">
                                <motion.span
                                  animate={{ opacity: [1, 0.4, 1] }}
                                  transition={{ repeat: Infinity, duration: 1 }}
                                  className="w-1 h-1 rounded-full bg-muted-foreground"
                                />
                                {score}%
                              </span>
                            ) : (
                              `${score}% Match`
                            )}
                          </div>
                        </div>

                        {/* Middle info row (salaries / modes) */}
                        <div className="flex items-center gap-2 mt-2">
                          <Chip size="sm" variant="soft" className="h-4 px-1 text-[7px] text-muted bg-surface-secondary/20">
                            {job.workMode}
                          </Chip>
                          <Chip size="sm" variant="soft" className="h-4 px-1 text-[7px] text-muted bg-surface-secondary/20">
                            {job.type}
                          </Chip>
                          <span className="text-[7.5px] text-muted font-medium flex items-center"><DollarSign size={8} />{job.baseSalary}</span>
                        </div>

                        {/* Tech Stack list */}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {job.skills.map((sk) => {
                            const isVerifiedSkill = analyzedSkills.includes(sk);
                            return (
                              <Chip
                                key={sk}
                                size="sm"
                                variant="soft"
                                className={cn(
                                  "h-4 px-1.5 text-[6.5px] font-semibold rounded-xs",
                                  isVerifiedSkill ? "border border-success/20 bg-success-foreground/10 text-success" : "border border-border/30 bg-surface-secondary/10 text-muted"
                                )}
                              >
                                {sk}
                              </Chip>
                            );
                          })}
                        </div>

                        {/* Action section (reveals when calculations finish and card is highlighted) */}
                        {isTopHighlighted && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="mt-3.5 pt-2 border-t border-border/40 flex items-center justify-between"
                          >
                            <span className="text-[7.5px] text-accent font-semibold flex items-center gap-0.5">
                              <Sparkles size={8} /> Perfect verified candidate fit
                            </span>
                            <Button
                              ref={(el) => { applyBtnRefs.current[job.id] = el; }}
                              variant="primary"
                              onPress={handleApply}
                              disabled={phase !== "readyToApply"}
                              className={cn(
                                "h-6.5 text-[8.5px] font-extrabold uppercase px-3 tracking-wider rounded-md transition-all duration-300",
                                phase !== "readyToApply"
                                  ? "cursor-not-allowed opacity-80"
                                  : "hover:shadow-[0_0_12px_rgba(133,78,40,0.5)] cursor-pointer"
                              )}
                            >
                              {phase === "submitting" || phase === "transitioning" ? (
                                <span className="flex items-center gap-1">
                                  <motion.span
                                    animate={{ rotate: 360 }}
                                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                                    className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full"
                                  />
                                  Applying...
                                </span>
                              ) : (
                                <span className="flex items-center gap-0.5">
                                  Apply Now <ArrowRight size={9} />
                                </span>
                              )}
                            </Button>
                          </motion.div>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

            </div>
          </div>
        </motion.main>
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
              x: {
                duration: (phase === "readyToApply" || phase === "submitting" || phase === "transitioning") ? 0.08 : 0.8,
                ease: EASE_EXPO,
              },
              y: {
                duration: (phase === "readyToApply" || phase === "submitting" || phase === "transitioning") ? 0.08 : 0.8,
                ease: EASE_EXPO,
              },
              opacity: { duration: 0.3, ease: "easeOut" },
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

export default Section05;
