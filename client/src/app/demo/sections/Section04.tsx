"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  LayoutDashboard,
  User,
  Briefcase,
  Settings,
  Bell,
  Sparkles,
  Mail,
  MapPin,
  Link as LinkIcon,
  Check,
} from "lucide-react";
import { Github, Gitlab } from "@thesvg/react";
import { Card, Chip } from "@heroui/react";
import { Button } from "@/components/ui/button";
import { useDemoStore, type SceneLifecycleState } from "../stores/use-demo-store";
import { cn } from "@/lib/utils";

interface Section04Props {
  lifecycleState: SceneLifecycleState;
  onStateComplete: (state: SceneLifecycleState) => void;
  currentPhaseId: string;
  isPhaseCompleted: boolean;
  onPhaseComplete: () => void;
}

const EASE_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

const FIELDS = [
  {
    id: "fullName",
    label: "Full Name",
    placeholder: "e.g. John Doe",
    type: "input",
    text: "Kaivian Dev",
  },
  {
    id: "title",
    label: "Professional Title",
    placeholder: "e.g. Software Engineer",
    type: "input",
    text: "Principal Systems Architect",
  },
  {
    id: "summary",
    label: "Professional Summary",
    placeholder: "AI-generated profile summary...",
    type: "textarea",
    text: "Security-focused systems architect with 8+ years of engineering robust TypeScript applications and cryptographically secure APIs.",
  },
  {
    id: "skills",
    label: "Technical Skills",
    placeholder: "Extracted skills...",
    type: "input",
    text: "TypeScript, Go, React, ASP.NET, Cryptography, ZK-Proofs",
  },
  {
    id: "experience",
    label: "Work Experience",
    placeholder: "Verified experience history...",
    type: "textarea",
    text: "Lead Security Engineer @ CVerify (2024 - Present)",
  },
  {
    id: "education",
    label: "Education",
    placeholder: "Degree, School...",
    type: "input",
    text: "M.S. in Computer Science @ Stanford University",
  },
];

export function Section04({
  lifecycleState,
  onStateComplete,
  currentPhaseId,
  isPhaseCompleted,
  onPhaseComplete,
}: Section04Props) {
  const prefersReducedMotion = useReducedMotion();
  const setStatusMessage = useDemoStore((state) => state.setStatusMessage);

  const activeTimers = useRef<NodeJS.Timeout[]>([]);
  const registerTimer = (timer: NodeJS.Timeout) => {
    activeTimers.current.push(timer);
    return timer;
  };

  const clearAllTimers = () => {
    activeTimers.current.forEach(clearTimeout);
    activeTimers.current = [];
  };

  useEffect(() => {
    return () => clearAllTimers();
  }, []);

  // Layout states
  const [shellVisible, setShellVisible] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Simplified Generic State Machine
  const [phase, setPhase] = useState<
    | "reveal"
    | "navigatingToField"
    | "clickingField"
    | "typingField"
    | "navigatingToAddRepo"
    | "clickingAddRepo"
    | "navigatingToAnalyze"
    | "readyForAnalysis"
    | "submitting"
    | "transitioning"
  >("reveal");

  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);

  // Typed data representing values in inputs & CV Preview
  const [typedData, setTypedData] = useState({
    fullName: "",
    title: "",
    summary: "",
    skills: "",
    experience: "",
    education: "",
  });

  const [reposAdded, setReposAdded] = useState(false);

  // Virtual Cursor overlay coordinates & state
  const [cursorCoords, setCursorCoords] = useState<{ x: number; y: number } | null>(null);
  const [initialCoords, setInitialCoords] = useState<{ x: number; y: number }>({ x: 800, y: 400 });
  const [cursorClicking, setCursorClicking] = useState(false);
  const [cursorRipple, setCursorRipple] = useState(false);

  // Element Refs for layout calculations
  const workspaceRef = useRef<HTMLDivElement>(null);
  const fullNameRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const summaryRef = useRef<HTMLTextAreaElement>(null);
  const skillsRef = useRef<HTMLInputElement>(null);
  const experienceRef = useRef<HTMLTextAreaElement>(null);
  const educationRef = useRef<HTMLInputElement>(null);
  const analyzeBtnRef = useRef<HTMLButtonElement>(null);

  // Lookup helper for field refs
  const getRefForField = useCallback((id: string) => {
    switch (id) {
      case "fullName":
        return fullNameRef;
      case "title":
        return titleRef;
      case "summary":
        return summaryRef;
      case "skills":
        return skillsRef;
      case "experience":
        return experienceRef;
      case "education":
        return educationRef;
      case "analyzeBtn":
        return analyzeBtnRef;
      default:
        return null;
    }
  }, []);

  // Update cursor position relative to an element ref
  const updateCursorToRef = useCallback((
    ref: React.RefObject<HTMLElement | null>,
    offsetX = 0,
    offsetY = 0
  ) => {
    if (!ref.current || !workspaceRef.current) return;
    const rect = ref.current.getBoundingClientRect();
    const workspaceRect = workspaceRef.current.getBoundingClientRect();
    const targetX = rect.left - workspaceRect.left + (offsetX || rect.width / 2);
    const targetY = rect.top - workspaceRect.top + (offsetY || rect.height / 2);
    setCursorCoords({ x: targetX, y: targetY });
  }, []);

  // Triggered when clicking "Add Analyzed Repo"
  const handleAddRepos = useCallback(() => {
    if (reposAdded) return;
    setReposAdded(true);
    setStatusMessage("Demo Mode: Linked 2 verified repositories to your CV!");
    onPhaseComplete();
  }, [reposAdded, setStatusMessage, onPhaseComplete]);

  // Final submission and transition
  const handleAnalyzeCV = useCallback(() => {
    if (phase === "submitting" || phase === "transitioning") return;

    setPhase("submitting");
    setCursorClicking(true);
    setCursorRipple(true);
    setStatusMessage("AI is preparing your CV analysis...");

    // Transition to Section 05 after exactly 1000ms using a standard timeout
    // that won't be cleared by clearAllTimers on store play state changes.
    setTimeout(() => {
      useDemoStore.getState().nextSection();
    }, 1000);
  }, [phase, setStatusMessage]);

  // Main button router logic
  const handleBtnPress = useCallback(() => {
    if (reposAdded) {
      handleAnalyzeCV();
    } else {
      handleAddRepos();
    }
  }, [reposAdded, handleAnalyzeCV, handleAddRepos]);

  // Reset states on beforeEnter or when returning to Phase 1
  useEffect(() => {
    if (lifecycleState === "beforeEnter" || currentPhaseId === "fill-cv") {
      clearAllTimers();
      setCursorCoords(null);
      setCursorClicking(false);
      setCursorRipple(false);
      setShellVisible(false);
      setFocusedField(null);
      setCurrentFieldIndex(0);

      if (currentPhaseId === "fill-cv") {
        setPhase("reveal");
        setTypedData({
          fullName: "",
          title: "",
          summary: "",
          skills: "",
          experience: "",
          education: "",
        });
        setReposAdded(false);
        useDemoStore.setState({ isPlaying: true });
      } else if (currentPhaseId === "add-repo") {
        setPhase("navigatingToAddRepo");
        setTypedData({
          fullName: "Kaivian Dev",
          title: "Principal Systems Architect",
          summary: "Security-focused systems architect with 8+ years of engineering robust TypeScript applications and cryptographically secure APIs.",
          skills: "TypeScript, Go, React, ASP.NET, Cryptography, ZK-Proofs",
          experience: "Lead Security Engineer @ CVerify (2024 - Present)",
          education: "M.S. in Computer Science @ Stanford University",
        });
        setReposAdded(false);
        setShellVisible(true);
      } else { // analyze-cv
        setPhase("readyForAnalysis");
        setTypedData({
          fullName: "Kaivian Dev",
          title: "Principal Systems Architect",
          summary: "Security-focused systems architect with 8+ years of engineering robust TypeScript applications and cryptographically secure APIs.",
          skills: "TypeScript, Go, React, ASP.NET, Cryptography, ZK-Proofs",
          experience: "Lead Security Engineer @ CVerify (2024 - Present)",
          education: "M.S. in Computer Science @ Stanford University",
        });
        setReposAdded(true);
        setShellVisible(true);
      }
    }
  }, [lifecycleState, currentPhaseId]);

  // Animation timeline phase controller
  useEffect(() => {
    clearAllTimers();

    if (lifecycleState !== "active") return;
    if (phase === "submitting" || phase === "transitioning") return;

    // Snapping / Paused mode
    if (isPhaseCompleted && currentPhaseId !== "fill-cv") {
      setShellVisible(true);
      if (currentPhaseId === "add-repo") {
        setPhase("navigatingToAddRepo");
        setTypedData({
          fullName: "Kaivian Dev",
          title: "Principal Systems Architect",
          summary: "Security-focused systems architect with 8+ years of engineering robust TypeScript applications and cryptographically secure APIs.",
          skills: "TypeScript, Go, React, ASP.NET, Cryptography, ZK-Proofs",
          experience: "Lead Security Engineer @ CVerify (2024 - Present)",
          education: "M.S. in Computer Science @ Stanford University",
        });
        setReposAdded(false);
        setCursorCoords(null);
      } else if (currentPhaseId === "analyze-cv") {
        setPhase("readyForAnalysis");
        setTypedData({
          fullName: "Kaivian Dev",
          title: "Principal Systems Architect",
          summary: "Security-focused systems architect with 8+ years of engineering robust TypeScript applications and cryptographically secure APIs.",
          skills: "TypeScript, Go, React, ASP.NET, Cryptography, ZK-Proofs",
          experience: "Lead Security Engineer @ CVerify (2024 - Present)",
          education: "M.S. in Computer Science @ Stanford University",
        });
        setReposAdded(true);
        setCursorCoords(null);
      }
      onStateComplete("active");
      return;
    }

    // Play/Animation mode: run original state machine steps
    if (currentPhaseId === "fill-cv") {

      let timer: NodeJS.Timeout;

      if (phase === "reveal") {
        setShellVisible(true);
        onStateComplete("active");
        timer = setTimeout(() => {
          setPhase("navigatingToField");
          setCurrentFieldIndex(0);
        }, 800);
        registerTimer(timer);
      } else if (phase === "navigatingToField") {
        const field = FIELDS[currentFieldIndex];
        const ref = getRefForField(field.id);
        if (ref) {
          registerTimer(
            setTimeout(() => {
              updateCursorToRef(ref, 20); // Position slightly right from left edge of input
            }, 50)
          );
        }

        timer = setTimeout(() => {
          setPhase("clickingField");
        }, 600);
        registerTimer(timer);
      } else if (phase === "clickingField") {
        setCursorClicking(true);
        setCursorRipple(true);

        timer = setTimeout(() => {
          const field = FIELDS[currentFieldIndex];
          setFocusedField(field.id);
          setCursorClicking(false);
          setCursorRipple(false);
          setPhase("typingField");
        }, 200);
        registerTimer(timer);
      } else if (phase === "typingField") {
        const field = FIELDS[currentFieldIndex];
        const targetText = field.text;
        let charIdx = 0;

        // Speed up typing for summary
        const speed = field.id === "summary" ? 8 : 12;

        const typeInterval = setInterval(() => {
          setTypedData((prev) => ({
            ...prev,
            [field.id]: targetText.slice(0, charIdx + 1),
          }));
          charIdx++;

          if (charIdx >= targetText.length) {
            clearInterval(typeInterval);
            setFocusedField(null);

            if (currentFieldIndex < FIELDS.length - 1) {
              setCurrentFieldIndex((prev) => prev + 1);
              setPhase("navigatingToField");
            } else {
              setCursorCoords(null);
              setPhase("navigatingToAddRepo");
              onPhaseComplete();
            }
          }
        }, speed);

        registerTimer(typeInterval);
      }
    } else if (currentPhaseId === "add-repo") {
      setShellVisible(true);
      setTypedData({
        fullName: "Kaivian Dev",
        title: "Principal Systems Architect",
        summary: "Security-focused systems architect with 8+ years of engineering robust TypeScript applications and cryptographically secure APIs.",
        skills: "TypeScript, Go, React, ASP.NET, Cryptography, ZK-Proofs",
        experience: "Lead Security Engineer @ CVerify (2024 - Present)",
        education: "M.S. in Computer Science @ Stanford University",
      });
      setReposAdded(false);
      setPhase("navigatingToAddRepo");

      setInitialCoords({ x: 800, y: 400 });
      registerTimer(setTimeout(() => updateCursorToRef(analyzeBtnRef), 500));

      registerTimer(setTimeout(() => setCursorClicking(true), 1700));
      registerTimer(setTimeout(() => {
        setReposAdded(true);
        setStatusMessage("Demo Mode: Linked 2 verified repositories to your CV!");
        setCursorClicking(false);
        setCursorRipple(true);
      }, 1900));

      registerTimer(setTimeout(() => {
        setCursorRipple(false);
        setCursorCoords(null);
        onPhaseComplete();
      }, 2400));

      onStateComplete("active");
    } else if (currentPhaseId === "analyze-cv") {
      setShellVisible(true);
      setTypedData({
        fullName: "Kaivian Dev",
        title: "Principal Systems Architect",
        summary: "Security-focused systems architect with 8+ years of engineering robust TypeScript applications and cryptographically secure APIs.",
        skills: "TypeScript, Go, React, ASP.NET, Cryptography, ZK-Proofs",
        experience: "Lead Security Engineer @ CVerify (2024 - Present)",
        education: "M.S. in Computer Science @ Stanford University",
      });
      setReposAdded(true);
      setPhase("readyForAnalysis");

      setInitialCoords({ x: 400, y: 300 });
      registerTimer(setTimeout(() => updateCursorToRef(analyzeBtnRef), 500));

      registerTimer(
        setTimeout(() => {
          setCursorRipple(true);
        }, 1500)
      );

      onStateComplete("active");
    }
  }, [
    phase,
    currentFieldIndex,
    currentPhaseId,
    isPhaseCompleted,
    lifecycleState,
    onStateComplete,
    getRefForField,
    updateCursorToRef,
  ]);

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

  // Determine button text and styling based on state
  let buttonText = "Add Analyzed Repo";
  let buttonClass = "bg-surface-secondary text-muted";
  let isBtnDisabled = true;

  if (reposAdded) {
    buttonText = phase === "submitting" || phase === "transitioning" ? "Analyzing Profile..." : "Analyze CV";
    isBtnDisabled = phase === "submitting" || phase === "transitioning";

    if (phase === "readyForAnalysis" || phase === "submitting" || phase === "transitioning") {
      buttonClass = "bg-accent text-accent-foreground shadow-[0_0_12px_rgba(133,78,40,0.45)] ring-2 ring-accent hover:opacity-90 cursor-pointer";
    } else {
      buttonClass = "bg-accent text-accent-foreground shadow-[0_0_12px_rgba(133,78,40,0.45)] ring-2 ring-accent hover:opacity-90 cursor-pointer";
    }
  } else {
    const isAddRepoActive = currentPhaseId === "add-repo" || phase === "navigatingToAddRepo" || phase === "clickingAddRepo";
    if (isAddRepoActive) {
      buttonClass = "bg-secondary text-secondary-foreground font-bold shadow-md hover:opacity-90 pointer-events-none";
      isBtnDisabled = false;
    } else {
      buttonClass = "bg-surface-secondary text-muted cursor-not-allowed";
      isBtnDisabled = true;
    }
  }

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
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-accent-soft/10 text-accent font-semibold text-xs transition-colors cursor-default">
            <User size={16} />
            <span>My CV</span>
          </div>
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-muted hover:text-foreground text-xs transition-colors cursor-default">
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
      <div className="flex-1 flex flex-col min-w-0 bg-surface-secondary/20 relative">
        {/* Mock Header */}
        <motion.header
          variants={headerVariants}
          initial="hidden"
          animate={shellVisible ? "visible" : "hidden"}
          className="h-14 px-6 border-b border-border/40 bg-background/35 backdrop-blur-xs flex items-center justify-between shrink-0 select-none"
        >
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <span>My CV</span>
            <span className="text-border">/</span>
            <span className="text-foreground font-semibold">Builder</span>
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

        {/* Content Columns (Split Editor vs Preview) */}
        <motion.main
          variants={mainViewVariants}
          initial="hidden"
          animate={shellVisible ? "visible" : "hidden"}
          className="flex-1 flex overflow-hidden p-4 gap-4"
        >
          {/* Left Column: CV Editor */}
          <div className="w-1/2 flex flex-col h-full">
            <Card className="flex-1 p-3.5 border border-border bg-background shadow-xs text-left flex flex-col justify-between h-full overflow-hidden select-none">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/40 pb-2 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-accent/15 border border-accent/30 text-accent flex items-center justify-center">
                    <Sparkles size={12} className="animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-foreground">AI CV Profile Builder</h3>
                    <p className="text-[8px] text-muted">Compiling verified developer metadata</p>
                  </div>
                </div>
                <Chip
                  size="sm"
                  variant="soft"
                  className="h-4.5 px-1.5 text-[8px] font-extrabold uppercase rounded-sm border border-accent/20 text-accent bg-accent-soft/10"
                >
                  Auto-Pilot
                </Chip>
              </div>

              {/* Form Fields */}
              <div className="flex-1 flex flex-col gap-1 overflow-y-auto scrollbar-none py-0.5 justify-between">
                {FIELDS.map((field) => {
                  const isFocused = focusedField === field.id;
                  const typedVal = typedData[field.id as keyof typeof typedData];

                  return (
                    <div key={field.id} className="space-y-0.5">
                      <label className="text-[8px] font-bold uppercase tracking-wider text-muted flex items-center gap-1">
                        {field.label}
                        {isFocused && (
                          <span className="w-1 h-1 rounded-full bg-accent animate-ping" />
                        )}
                      </label>
                      {field.type === "input" ? (
                        <input
                          ref={getRefForField(field.id) as React.RefObject<HTMLInputElement>}
                          type="text"
                          readOnly
                          placeholder={field.placeholder}
                          value={typedVal}
                          className={cn(
                            "w-full h-6 bg-field-background border border-border/80 rounded-md text-[9px] px-1.5 font-medium transition-all duration-300 focus:outline-none placeholder:text-muted/40 text-foreground",
                            isFocused && "border-accent ring-1 ring-accent bg-background"
                          )}
                        />
                      ) : (
                        <textarea
                          ref={getRefForField(field.id) as React.RefObject<HTMLTextAreaElement>}
                          readOnly
                          placeholder={field.placeholder}
                          value={typedVal}
                          className={cn(
                            "w-full h-9 bg-field-background border border-border/80 rounded-md text-[8.5px] px-1.5 py-0.5 font-medium transition-all duration-300 focus:outline-none placeholder:text-muted/40 text-foreground resize-none scrollbar-none",
                            isFocused && "border-accent ring-1 ring-accent bg-background"
                          )}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Action Button */}
              <div className="pt-2 border-t border-border/40 shrink-0">
                <Button
                  ref={analyzeBtnRef}
                  variant="primary"
                  onPress={handleBtnPress}
                  disabled={isBtnDisabled}
                  isLoading={reposAdded && (phase === "submitting" || phase === "transitioning")}
                  className={cn(
                    "w-full h-7.5 text-[9px] uppercase font-bold tracking-wider rounded-lg transition-all duration-500",
                    buttonClass
                  )}
                >
                  {buttonText}
                </Button>
              </div>
            </Card>
          </div>

          {/* Right Column: CV Preview */}
          <div className="w-1/2 flex flex-col h-full">
            <Card className="flex-1 p-4 border border-border bg-background shadow-xs text-left flex flex-col gap-3 h-full select-none relative">
              {/* CV Header */}
              <div className="border-b border-border/40 pb-2 flex items-start justify-between shrink-0">
                <div className="space-y-0.5 max-w-[60%]">
                  <h1 className="text-sm font-bold font-outfit text-foreground tracking-tight h-5 flex items-center">
                    {typedData.fullName || (
                      <span className="text-muted/20 italic font-normal text-xs">Your Full Name</span>
                    )}
                    {focusedField === "fullName" && (
                      <motion.span
                        animate={{ opacity: [1, 0, 1] }}
                        transition={{ repeat: Infinity, duration: 0.8 }}
                        className="ml-0.5 inline-block w-0.5 h-3.5 bg-accent"
                      />
                    )}
                  </h1>
                  <p className="text-[8px] text-accent font-medium tracking-wide uppercase h-4 flex items-center">
                    {typedData.title || (
                      <span className="text-muted/20 italic font-normal text-[7.5px] lowercase">Professional title...</span>
                    )}
                    {focusedField === "title" && (
                      <motion.span
                        animate={{ opacity: [1, 0, 1] }}
                        transition={{ repeat: Infinity, duration: 0.8 }}
                        className="ml-0.5 inline-block w-0.5 h-3 bg-accent"
                      />
                    )}
                  </p>
                </div>

                <div className="text-[7.5px] text-muted space-y-0.5 text-right font-mono">
                  <div className="flex items-center justify-end gap-1">
                    <Mail size={8} /> kaivian@cverify.io
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <MapPin size={8} /> San Francisco, CA
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <LinkIcon size={8} /> github.com/kaivian
                  </div>
                </div>
              </div>

              {/* Scrollable Content inside Preview */}
              <div className="flex-1 space-y-3">
                {/* CV Summary */}
                <AnimatePresence>
                  {(typedData.summary || focusedField === "summary") && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-1 text-left"
                    >
                      <h2 className="text-[7.5px] font-bold text-accent uppercase tracking-wider border-b border-border/40 pb-0.5">
                        Professional Summary
                      </h2>
                      <p className="text-[8px] text-foreground/80 leading-relaxed font-light relative">
                        {typedData.summary}
                        {focusedField === "summary" && (
                          <motion.span
                            animate={{ opacity: [1, 0, 1] }}
                            transition={{ repeat: Infinity, duration: 0.8 }}
                            className="inline-block w-0.5 h-2.5 bg-accent"
                          />
                        )}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* CV Skills */}
                <AnimatePresence>
                  {(typedData.skills || focusedField === "skills") && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-1 text-left"
                    >
                      <h2 className="text-[7.5px] font-bold text-accent uppercase tracking-wider border-b border-border/40 pb-0.5">
                        Technical Skills
                      </h2>
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {typedData.skills.split(",").map((skill, idx) => {
                          const trimmed = skill.trim();
                          if (!trimmed) return null;
                          const isLast = idx === typedData.skills.split(",").length - 1;
                          return (
                            <Chip
                              key={idx}
                              size="sm"
                              variant="soft"
                              className="h-4 px-1 text-[7.5px] font-medium tracking-wide border border-border text-foreground/90 bg-surface-secondary/40 rounded-sm"
                            >
                              {trimmed}
                              {isLast && focusedField === "skills" && (
                                <motion.span
                                  animate={{ opacity: [1, 0, 1] }}
                                  transition={{ repeat: Infinity, duration: 0.8 }}
                                  className="ml-0.5 inline-block w-0.5 h-2 bg-accent"
                                />
                              )}
                            </Chip>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* CV Experience */}
                <AnimatePresence>
                  {(typedData.experience || focusedField === "experience") && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-1.5 text-left"
                    >
                      <h2 className="text-[7.5px] font-bold text-accent uppercase tracking-wider border-b border-border/40 pb-0.5">
                        Work Experience
                      </h2>
                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between text-[8px] font-bold">
                          <span className="text-foreground">CVerify Inc.</span>
                          <span className="text-muted font-normal">2024 - Present</span>
                        </div>
                        <div className="flex items-center justify-between text-[7px] text-accent/80 font-medium">
                          <span>Lead Security Engineer</span>
                          <span>San Francisco, CA</span>
                        </div>
                        <p className="text-[7.5px] text-foreground/80 leading-relaxed font-light pt-0.5 pl-1.5 border-l border-border/50 mt-1">
                          {typedData.experience || (
                            <span className="text-muted/20 italic font-normal">Typing experience details...</span>
                          )}
                          {focusedField === "experience" && (
                            <motion.span
                              animate={{ opacity: [1, 0, 1] }}
                              transition={{ repeat: Infinity, duration: 0.8 }}
                              className="inline-block w-0.5 h-2 bg-accent"
                            />
                          )}
                        </p>
                        {typedData.experience.length > 20 && (
                          <motion.ul
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-[7px] text-muted list-disc list-inside mt-1 pl-1.5 space-y-0.5"
                          >
                            <li>Led design of repository cryptographic indexing engine.</li>
                            <li>Secured candidate credential profiles with signature proofs.</li>
                          </motion.ul>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* CV Education */}
                <AnimatePresence>
                  {(typedData.education || focusedField === "education") && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-0.5 text-left"
                    >
                      <h2 className="text-[7px] font-bold text-accent uppercase tracking-wider border-b border-border/40 pb-0.5">
                        Education
                      </h2>
                      <div className="flex items-center justify-between text-[7.5px] font-bold text-foreground relative">
                        <span>
                          {typedData.education || (
                            <span className="text-muted/20 italic font-normal">Typing education details...</span>
                          )}
                          {focusedField === "education" && (
                            <motion.span
                              animate={{ opacity: [1, 0, 1] }}
                              transition={{ repeat: Infinity, duration: 0.8 }}
                              className="ml-0.5 inline-block w-0.5 h-2.5 bg-accent"
                            />
                          )}
                        </span>
                        {typedData.education && (
                          <span className="text-muted font-normal text-[7px] shrink-0">2018 - 2020</span>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* CV Verified Projects */}
                <AnimatePresence>
                  {reposAdded && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-1.5 text-left"
                    >
                      <h2 className="text-[7.5px] font-bold text-accent uppercase tracking-wider border-b border-border/40 pb-0.5">
                        Verified Contribution Projects
                      </h2>

                      <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                        {/* cverify-web Card */}
                        <motion.div
                          initial={{ scale: 0.95, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: 0.1 }}
                          className="p-1.5 border border-success/30 bg-success/5 rounded-md flex flex-col justify-between h-[52px]"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[8px] font-bold flex items-center gap-0.5 text-foreground">
                              <Github className="w-2.5 h-2.5" /> cverify-web
                            </span>
                            <span className="text-[7px] text-success font-bold uppercase tracking-wider flex items-center gap-0.2 select-none">
                              <Check size={7} /> Grade A
                            </span>
                          </div>
                          <p className="text-[7px] text-muted leading-tight truncate">
                            TypeScript frontend, 90%+ ZK proofs.
                          </p>
                        </motion.div>

                        {/* cverify-api Card */}
                        <motion.div
                          initial={{ scale: 0.95, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: 0.3 }}
                          className="p-1.5 border border-success/30 bg-success/5 rounded-md flex flex-col justify-between h-[52px]"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[8px] font-bold flex items-center gap-0.5 text-[#FC6D26]">
                              <Gitlab className="w-2.5 h-2.5" /> cverify-api
                            </span>
                            <span className="text-[7px] text-success font-bold uppercase tracking-wider flex items-center gap-0.2 select-none">
                              <Check size={7} /> Grade A-
                            </span>
                          </div>
                          <p className="text-[7px] text-muted leading-tight truncate">
                            C# DDD REST API secure handshake.
                          </p>
                        </motion.div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Card>
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
              x: { duration: 0.8, ease: EASE_EXPO },
              y: { duration: 0.8, ease: EASE_EXPO },
              opacity: { duration: 0.3, ease: "easeOut" },
            }}
            className="absolute pointer-events-none z-100 flex items-center justify-center"
            style={{
              top: -5,
              left: 50,
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

export default Section04;
