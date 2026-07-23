"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { Check, Key, ShieldCheck } from "lucide-react";
import { Github } from "@thesvg/react";
import { useDemoStore, type SceneLifecycleState } from "../stores/use-demo-store";
import { cn } from "@/lib/utils";
import { LoginView } from "@/features/auth/views/login-view";
import { AuthContext } from "@/features/auth/context/auth-context";


interface Section01Props {
  lifecycleState: SceneLifecycleState;
  onStateComplete: (state: SceneLifecycleState) => void;
  currentPhaseId: string;
  isPhaseCompleted: boolean;
  onPhaseComplete: () => void;
}

export function Section01({
  lifecycleState,
  onStateComplete,
  currentPhaseId,
  isPhaseCompleted,
  onPhaseComplete,
}: Section01Props) {
  const prefersReducedMotion = useReducedMotion();
  const [logoState, setLogoState] = useState<"enter" | "exit">("enter");
  const [logoPhase, setLogoPhase] = useState<"idle" | "enter" | "centered" | "shifting" | "subtitle" | "done">("idle");
  const [verificationStep, setVerificationStep] = useState<"idle" | "verifying" | "success">("idle");
  const [isHoveringGoogle, setIsHoveringGoogle] = useState(false);

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

  const stage = currentPhaseId === "logo" ? "logo" : currentPhaseId === "intro" ? "intro" : "login";

  // Mock Authentication Provider handlers to prevent hitting real APIs during demo
  const mockAuthHandlers = {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    isInitialized: true,
    bootstrapState: "READY" as const,
    authError: null,

    resolveEmailAuthState: async (_email: string) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      return { success: true, data: { authState: "REQUIRES_AUTHENTICATION" } };
    },
    login: async (_credentials: unknown) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setStatusMessage("Demo Mode: Login successful!");
      return { success: true, nextStep: "DASHBOARD" };
    },
    loginWithGoogle: async (_idToken: string) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      setStatusMessage("Demo Mode: Google SSO authenticated successfully!");
      return { success: true, nextStep: "DASHBOARD" };
    },
    companyLogin: async (payload: { organizationUsername: string }) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setStatusMessage(`Demo Mode: Logged in to organization: ${payload.organizationUsername}`);
      return { success: true, nextStep: "DASHBOARD" };
    },
    sendOtp: async (_email: string, _purpose: string) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      setStatusMessage("Demo Mode: OTP sent!");
      return { success: true, data: { challengeId: "demo-challenge" } };
    },
  };

  // Deterministic reset on beforeEnter
  useEffect(() => {
    if (lifecycleState === "beforeEnter") {
      clearAllTimers();
      if (currentPhaseId === "logo") {
        setLogoState("enter");
        setLogoPhase("idle");
        setVerificationStep("idle");
      } else if (currentPhaseId === "intro") {
        setLogoState("exit");
        setLogoPhase("done");
        setVerificationStep("success");
      } else {
        setLogoState("exit");
        setLogoPhase("done");
        setVerificationStep("success");
      }
      setIsHoveringGoogle(false);
    }
  }, [lifecycleState, currentPhaseId]);

  // Handle body class for navigation logo synchronization
  useEffect(() => {
    if (stage === "logo" && lifecycleState === "active") {
      document.body.classList.add("demo-logo-stage");
    } else {
      document.body.classList.remove("demo-logo-stage");
    }
    return () => {
      document.body.classList.remove("demo-logo-stage");
    };
  }, [stage, lifecycleState]);

  // Central phase transition effect
  useEffect(() => {
    clearAllTimers();

    if (lifecycleState !== "active") return;

    if (isPhaseCompleted) {
      if (currentPhaseId === "logo") {
        setLogoState("enter");
        setLogoPhase("done");
        setVerificationStep("idle");
      } else if (currentPhaseId === "intro") {
        setLogoState("exit");
        setLogoPhase("done");
        setVerificationStep("success");
      } else if (currentPhaseId === "login") {
        setLogoState("exit");
        setLogoPhase("done");
        setVerificationStep("success");
      }
      onStateComplete("active");
      return;
    }

    // Play/Animation mode
    if (currentPhaseId === "logo") {
      setLogoState("enter");
      setLogoPhase("idle");
      setVerificationStep("idle");

      registerTimer(setTimeout(() => setLogoPhase("enter"), 50));
      registerTimer(setTimeout(() => setLogoPhase("centered"), 800));
      registerTimer(setTimeout(() => setLogoPhase("shifting"), 1300));
      registerTimer(setTimeout(() => setLogoPhase("subtitle"), 2000));
      registerTimer(setTimeout(() => setLogoPhase("done"), 2600));
      registerTimer(setTimeout(() => setLogoState("exit"), 4100));
      registerTimer(setTimeout(() => onPhaseComplete(), 4600));
      onStateComplete("active");
    } else if (currentPhaseId === "intro") {
      setLogoState("exit");
      setLogoPhase("done");
      setVerificationStep("idle");

      registerTimer(setTimeout(() => setVerificationStep("verifying"), 800));
      registerTimer(setTimeout(() => setVerificationStep("success"), 2500));
      onStateComplete("active");
    } else if (currentPhaseId === "login") {
      setLogoState("exit");
      setLogoPhase("done");
      setVerificationStep("success");

      registerTimer(setTimeout(() => onStateComplete("active"), 800));
    }
  }, [currentPhaseId, isPhaseCompleted, lifecycleState, onStateComplete]);

  // Auto-progress for intro success state in autoplay
  useEffect(() => {
    if (verificationStep === "success" && currentPhaseId === "intro" && !isPhaseCompleted) {
      const tLogin = setTimeout(() => {
        onPhaseComplete();
      }, 1000);
      return () => clearTimeout(tLogin);
    }
  }, [verificationStep, currentPhaseId, isPhaseCompleted, onPhaseComplete]);

  // Framer Motion entrance variations for Intro
  const slideUp = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 30 },
    visible: (custom: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        delay: custom * 0.2,
        ease: [0.16, 1, 0.3, 1] as const,
      },
    }),
  };



  return (
    <AuthContext.Provider value={mockAuthHandlers}>
      {/* Dynamic CSS overrides for Demo header logo synchronization and login interactions */}
      <style>{`
        body.demo-logo-stage header img[alt="CVerify Logo"],
        body.demo-logo-stage header span {
          opacity: 0 !important;
          pointer-events: none !important;
        }
        header img[alt="CVerify Logo"],
        header span {
          transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }

        /* Disable non-Google interactions in the demo login card */
        .demo-login-card-container input,
        .demo-login-card-container [role="tab"],
        .demo-login-card-container a,
        .demo-login-card-container button {
          pointer-events: none !important;
          cursor: not-allowed !important;
        }

        /* Re-enable ONLY the Google button */
        .demo-login-card-container button:not([role="tab"]):first-of-type {
          pointer-events: auto !important;
          cursor: pointer !important;
        }
      `}</style>

      <div className="w-full relative min-h-[500px] flex items-center justify-center">
        <AnimatePresence mode="wait">
          {stage === "logo" && (
            <motion.div
              key="logo-stage"
              initial={{ opacity: 0 }}
              animate={logoState === "enter" ? { opacity: 1 } : { opacity: 0, scale: prefersReducedMotion ? 1 : 0.98 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center justify-center w-full h-full min-h-[400px]"
            >
              <motion.div layout className="flex items-center justify-center gap-8">
                {/* Logo Mark */}
                <motion.img
                  layout
                  src="/brand/logo-black.png"
                  alt="CVerify Logo Mark"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{
                    opacity: logoPhase !== "idle" ? 1 : 0,
                    scale: logoPhase !== "idle" ? 1 : 0.8,
                  }}
                  transition={{
                    opacity: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
                    scale: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
                    layout: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
                  }}
                  className="h-32 w-auto select-none"
                />

                {/* Text & Subtitle block */}
                {(logoPhase === "shifting" || logoPhase === "subtitle" || logoPhase === "done") && (
                  <motion.div
                    layout
                    initial={{ opacity: 0, x: -25 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="flex flex-col items-start justify-center"
                  >
                    {/* CVerify Text */}
                    <span className="text-7xl font-bold tracking-tight text-foreground font-outfit select-none leading-none">
                      CVerify
                    </span>

                    {/* Subtitle */}
                    {(logoPhase === "subtitle" || logoPhase === "done") && (
                      <motion.span
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                        className="text-[12px] font-bold tracking-[0.25em] text-muted mt-3.5 font-sans uppercase select-none"
                      >
                        REAL COMMITS. REAL CAREER
                      </motion.span>
                    )}
                  </motion.div>
                )}
              </motion.div>
            </motion.div>
          )}

          {stage !== "logo" && (
            <motion.div
              key="main-stage"
              initial={{ opacity: 0, x: prefersReducedMotion ? 0 : 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center w-full max-w-6xl mx-auto select-none"
            >
              {/* Text Copy Column */}
              <div className="lg:col-span-7 flex flex-col items-start text-left gap-6">
                <motion.div
                  custom={0}
                  initial="hidden"
                  animate="visible"
                  variants={slideUp}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-accent/20 bg-accent/10 text-foreground text-xs font-semibold"
                >
                  <Key className="h-3.5 w-3.5 text-accent" />
                  Technical Truth Simplified
                </motion.div>

                <motion.h1
                  custom={1}
                  initial="hidden"
                  animate="visible"
                  variants={slideUp}
                  className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1] font-outfit"
                >
                  Verify Developers. <br />
                  <span className="text-accent">No Backdoor Claims.</span>
                </motion.h1>

                <motion.p
                  custom={2}
                  initial="hidden"
                  animate="visible"
                  variants={slideUp}
                  className="text-base md:text-lg text-muted max-w-xl font-normal leading-relaxed font-sans"
                >
                  CVerify establishes secure cryptographic links between developer identity, work history, and repository contributions. Say goodbye to fake resumes and unverified experience.
                </motion.p>
              </div>

              {/* Interactive Card Swap Column */}
              <div className="lg:col-span-5 flex items-center justify-center w-full min-h-[460px]">
                <AnimatePresence mode="wait">
                  {stage === "intro" ? (
                    <motion.div
                      key="github-card"
                      initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.95, y: -10 }}
                      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                      className="w-full"
                    >
                      <div className="w-full bg-surface border border-border rounded-2xl p-6 shadow-2xl relative overflow-hidden">
                        {/* Decorative backdrop glow */}
                        <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-accent/10 blur-[80px]" />

                        <div className="flex items-center justify-between border-b border-border/50 pb-4 mb-6">
                          <div className="flex items-center gap-2">
                            <Github className="h-5 w-5 text-foreground" />
                            <span className="text-xs font-bold text-foreground">GitHub Attestation</span>
                          </div>
                          <span className="text-[10px] text-muted font-mono bg-surface-secondary px-2 py-0.5 rounded-sm">
                            TLS-Secure
                          </span>
                        </div>

                        <div className="space-y-4">
                          {/* Step 1 */}
                          <div className="flex items-start gap-3.5">
                            <div className="h-5 w-5 rounded-full flex items-center justify-center bg-success/20 text-success text-[10px] font-bold mt-0.5">
                              <Check className="h-3 w-3" />
                            </div>
                            <div className="flex-1 space-y-0.5">
                              <p className="text-xs font-bold text-foreground">Initiating Secure Handshake</p>
                              <p className="text-[10px] text-muted">Establishing tunnel to candidate identity provider...</p>
                            </div>
                          </div>

                          {/* Step 2 */}
                          <div className="flex items-start gap-3.5">
                            <div className={cn(
                              "h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 transition-all duration-300",
                              verificationStep === "idle" && "bg-muted/10 text-muted",
                              verificationStep === "verifying" && "bg-accent/20 text-accent animate-pulse",
                              verificationStep === "success" && "bg-success/20 text-success"
                            )}>
                              {verificationStep === "success" ? <Check className="h-3 w-3" /> : "2"}
                            </div>
                            <div className="flex-1 space-y-0.5">
                              <p className="text-xs font-bold text-foreground">Resolving Git Signatures</p>
                              <p className="text-[10px] text-muted">Checking cryptographically signed commits on main branches...</p>
                            </div>
                          </div>

                          {/* Step 3 */}
                          <div className="flex items-start gap-3.5">
                            <div className={cn(
                              "h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 transition-all duration-300",
                              verificationStep !== "success" && "bg-muted/10 text-muted",
                              verificationStep === "success" && "bg-success/20 text-success"
                            )}>
                              {verificationStep === "success" ? <Check className="h-3 w-3" /> : "3"}
                            </div>
                            <div className="flex-1 space-y-0.5">
                              <p className="text-xs font-bold text-foreground">Issuing Trust Certificate</p>
                              <p className="text-[10px] text-muted">Generating verified candidate badge...</p>
                            </div>
                          </div>
                        </div>

                        {/* Final Certificate Banner */}
                        <div className={cn(
                          "mt-6 p-4 rounded-xl border flex items-center gap-4 transition-all duration-700 ease-out transform",
                          verificationStep === "success"
                            ? "bg-success/5 border-success/20 translate-y-0 opacity-100"
                            : "bg-surface-secondary/20 border-transparent translate-y-4 opacity-0"
                        )}>
                          <div className="p-2.5 bg-success/10 text-success rounded-lg">
                            <ShieldCheck className="h-6 w-6" />
                          </div>
                          <div className="flex-1 space-y-0.5">
                            <p className="text-xs font-bold text-foreground">Verified Developer</p>
                            <p className="text-[10px] text-success font-semibold">Trust Integrity Score: 98.4%</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="login-card"
                      initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.95, y: 15 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                      className="w-full relative demo-login-card-container"
                      onMouseOver={(e) => {
                        const target = e.target as HTMLElement;
                        const googleBtn = target.closest("button:not([role='tab']):first-of-type");
                        setIsHoveringGoogle(!!googleBtn);
                      }}
                      onMouseLeave={() => {
                        setIsHoveringGoogle(false);
                      }}
                      onClickCapture={(e) => {
                        const target = e.target as HTMLElement;
                        const googleBtn = target.closest("button:not([role='tab']):first-of-type");
                        if (googleBtn) {
                          e.stopPropagation();
                          e.preventDefault();
                          setStatusMessage("Demo Mode: Google SSO authenticated successfully!");
                          useDemoStore.setState({ isPlaying: true });
                          registerTimer(
                            setTimeout(() => {
                              onPhaseComplete();
                            }, 1000)
                          );
                        }
                      }}
                    >
                      <LoginView />

                      {/* Virtual Mouse Cursor */}
                      <motion.div
                        animate={{
                          opacity: isHoveringGoogle ? 0 : 1,
                          scale: isHoveringGoogle ? 0.8 : [1, 0.9, 1],
                        }}
                        transition={{
                          opacity: { duration: 0.3 },
                          scale: { duration: 1.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.5 }
                        }}
                        className="absolute pointer-events-none z-50 flex items-center justify-center"
                        style={{
                          top: "215px",
                          left: "73%",
                        }}
                      >
                        {/* Ripple Effect Ring */}
                        <motion.div
                          animate={{
                            scale: [1, 1.8, 1],
                            opacity: [0.2, 0.8, 0],
                          }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: "easeOut",
                          }}
                          className="absolute w-8 h-8 rounded-full border-2 border-accent/70 bg-accent/10 pointer-events-none"
                        />

                        {/* Cursor Arrow SVG */}
                        <svg
                          className="h-6 w-6 text-foreground fill-current drop-shadow-md select-none pointer-events-none"
                          style={{ transform: "translate(7px, 8.5px)" }}
                          viewBox="0 0 24 24"
                        >
                          <path d="M4.5 3v15.2l3.9-3.9 3.2 7.7 2.6-1.1-3.2-7.7 5.6-.1z" />
                        </svg>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AuthContext.Provider>
  );
}

export default Section01;
