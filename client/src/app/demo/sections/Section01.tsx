"use client";

import React, { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Key, ShieldCheck } from "lucide-react";
import { Github } from "@thesvg/react";
import { useDemoStore, SceneLifecycleState } from "../stores/use-demo-store";
import { cn } from "@/lib/utils";

interface Section01Props {
  lifecycleState: SceneLifecycleState;
  onStateComplete: (state: SceneLifecycleState) => void;
}

export function Section01({ lifecycleState, onStateComplete }: Section01Props) {
  const prefersReducedMotion = useReducedMotion();
  const [verificationStep, setVerificationStep] = useState<"idle" | "verifying" | "success">("idle");

  // Sync section-specific sub-animation to the engine lifecycle state
  useEffect(() => {
    if (lifecycleState === "active") {
      // Start verification sub-animation sequence
      const t1 = setTimeout(() => {
        setVerificationStep("verifying");
      }, 800);

      const t2 = setTimeout(() => {
        setVerificationStep("success");
        onStateComplete("active"); // Notify engine we finished our custom intro flow animations
      }, 2500);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    } else if (lifecycleState === "beforeExit") {
      onStateComplete("beforeExit");
    }
  }, [lifecycleState, onStateComplete]);

  // Framer Motion entrance variations
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center w-full max-w-6xl mx-auto select-none">
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

      {/* Interactive Visual Widget Column */}
      <div className="lg:col-span-5 flex items-center justify-center w-full">
        <motion.div
          initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md bg-surface border border-border rounded-2xl p-6 shadow-2xl relative overflow-hidden"
        >
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
        </motion.div>
      </div>
    </div>
  );
}

export default Section01;
