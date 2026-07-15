"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  LayoutDashboard,
  User,
  Briefcase,
  Settings,
  Bell,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

const EASE_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

interface DemoMockupShellProps {
  title: string;
  role: "candidate" | "recruiter";
  userName: string;
  activeTab: string;
  shellVisible: boolean;
  children: React.ReactNode;
}

export function DemoMockupShell({
  title,
  role,
  userName,
  activeTab,
  shellVisible,
  children,
}: DemoMockupShellProps) {
  const prefersReducedMotion = useReducedMotion();

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

  const isRecruiter = role === "recruiter";

  return (
    <>
      {/* 1. MOCK SIDEBAR */}
      <motion.aside
        variants={sidebarVariants}
        initial="hidden"
        animate={shellVisible ? "visible" : "hidden"}
        className="w-56 border-r border-border/50 bg-background/50 backdrop-blur-xs flex flex-col shrink-0 select-none text-left"
      >
        <div className="h-14 px-4 flex items-center gap-2 border-b border-border/40 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.png" alt="CVerify Logo" className="w-7 h-auto" />
          <span className="font-outfit font-bold text-lg tracking-tight">CVerify</span>
        </div>

        <nav className="flex-1 px-2.5 py-4 space-y-1">
          {/* 1. Dashboard Tab */}
          <div
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-colors cursor-default",
              activeTab === "Dashboard"
                ? "bg-accent-soft/10 text-accent font-semibold"
                : "text-muted hover:text-foreground"
            )}
          >
            <LayoutDashboard size={16} />
            <span>Dashboard</span>
          </div>

          {/* 2. Candidate View: My CV | Recruiter View: Job Openings */}
          {isRecruiter ? (
            <div
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-colors cursor-default",
                activeTab === "Job Openings"
                  ? "bg-accent-soft/10 text-accent font-semibold"
                  : "text-muted hover:text-foreground"
              )}
            >
              <Briefcase size={16} />
              <span>Job Openings</span>
            </div>
          ) : (
            <div
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-colors cursor-default",
                activeTab === "My CV"
                  ? "bg-accent-soft/10 text-accent font-semibold"
                  : "text-muted hover:text-foreground"
              )}
            >
              <User size={16} />
              <span>My CV</span>
            </div>
          )}

          {/* 3. Candidate View: Job Board | Recruiter View: Candidates */}
          {isRecruiter ? (
            <div
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-colors cursor-default",
                activeTab === "Candidates"
                  ? "bg-accent-soft/10 text-accent font-semibold"
                  : "text-muted hover:text-foreground"
              )}
            >
              <User size={16} />
              <span>Candidates</span>
            </div>
          ) : (
            <div
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-colors cursor-default",
                activeTab === "Job Board"
                  ? "bg-accent-soft/10 text-accent font-semibold"
                  : "text-muted hover:text-foreground"
              )}
            >
              <Briefcase size={16} />
              <span>Job Board</span>
            </div>
          )}

          {/* 4. Recruiter View: Verifications */}
          {isRecruiter && (
            <div
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-colors cursor-default",
                activeTab === "Verifications"
                  ? "bg-accent-soft/10 text-accent font-semibold"
                  : "text-muted hover:text-foreground"
              )}
            >
              <ShieldCheck size={16} />
              <span>Verifications</span>
            </div>
          )}

          {/* 5. Settings Tab */}
          <div
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-colors cursor-default",
              activeTab === "Settings"
                ? "bg-accent-soft/10 text-accent font-semibold"
                : "text-muted hover:text-foreground"
            )}
          >
            <Settings size={16} />
            <span>Settings</span>
          </div>
        </nav>

        {/* Profile section at bottom */}
        <div className="p-3 border-t border-border/40 shrink-0">
          <div className="flex items-center gap-2.5 px-2 py-1">
            <div className="w-7.5 h-7.5 rounded-full bg-accent/20 border border-accent/30 text-accent flex items-center justify-center font-bold text-xs">
              {isRecruiter ? "KV" : "K"}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-bold truncate">{userName}</span>
              <span className="text-[8px] text-muted truncate font-medium">
                {isRecruiter ? "recruiter" : "candidate"}
              </span>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* 2. MAIN WORKSPACE VIEWPORT */}
      <div className="flex-1 flex flex-col min-w-0 bg-surface-secondary/20 relative select-none">
        {/* Mock Header */}
        <motion.header
          variants={headerVariants}
          initial="hidden"
          animate={shellVisible ? "visible" : "hidden"}
          className="h-14 px-6 border-b border-border/40 bg-background/35 backdrop-blur-xs flex items-center justify-between shrink-0 animate-fade-in"
        >
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <span>{isRecruiter ? "Recruiter Portal" : "Job Board"}</span>
            <span className="text-border">/</span>
            <span className="text-foreground font-semibold">{title}</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative text-muted hover:text-foreground transition-colors cursor-default">
              <Bell size={16} />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-accent rounded-full animate-pulse" />
            </div>
            <div className="w-8 h-8 rounded-full bg-accent-soft/20 border border-accent/20 text-accent flex items-center justify-center font-bold text-xs cursor-default">
              {isRecruiter ? "KV" : "KV"}
            </div>
          </div>
        </motion.header>

        {/* Mock content */}
        <motion.main
          className="flex-1 flex overflow-hidden p-4 gap-4"
        >
          {children}
        </motion.main>
      </div>
    </>
  );
}

export default DemoMockupShell;
