import React from "react";
import { ShieldCheck, Sparkles, Check, AlertTriangle, XCircle, RefreshCw } from "lucide-react";

export interface BadgeConfig {
  label: string;
  className: string;
  icon?: React.ComponentType<any>;
}

// 1. Centralized Business Verification Configurations
export const BUSINESS_VERIFICATION_LEVELS: Record<number, BadgeConfig> = {
  1: {
    label: "Verified Level 1",
    className: "bg-accent/10 text-accent border border-accent/20",
    icon: Check,
  },
  2: {
    label: "Verified Level 2",
    className: "bg-success/10 text-success border border-success/20",
    icon: ShieldCheck,
  },
  3: {
    label: "Verified Level 3",
    className: "bg-warning/15 text-warning border border-warning/20",
    icon: Sparkles,
  },
};

// 2. Centralized Candidate/Project Verification Configurations
export const CANDIDATE_VERIFICATION_CONFIG: Record<string, BadgeConfig> = {
  identity: {
    label: "Verified",
    className: "bg-success/10 text-success border border-success/20",
    icon: ShieldCheck,
  },
  gpg: {
    label: "GPG Verified",
    className: "bg-accent/10 text-accent border border-accent/20",
    icon: ShieldCheck,
  },
  proof: {
    label: "Proof-Based",
    className: "bg-success/10 text-success border border-success/20",
    icon: Sparkles,
  },
};

interface BusinessBadgeProps {
  level: number | string | undefined;
  className?: string;
}

export const BusinessVerificationBadge: React.FC<BusinessBadgeProps> = ({ level, className = "" }) => {
  const numericLevel = typeof level === "string" ? parseInt(level, 10) : level;
  
  if (numericLevel === undefined || isNaN(numericLevel) || numericLevel <= 0) {
    return null; // Unverified, do not render a badge publicly
  }

  const config = BUSINESS_VERIFICATION_LEVELS[numericLevel] || BUSINESS_VERIFICATION_LEVELS[1];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase font-sans select-none transition-colors duration-300 ${config.className} ${className}`}
    >
      {Icon && <Icon className="size-3 shrink-0" />}
      <span>{config.label}</span>
    </span>
  );
};

interface CandidateBadgeProps {
  type: "identity" | "gpg" | "proof" | "project";
  level?: number | string;
  status?: number | string;
  className?: string;
}

export const CandidateVerificationBadge: React.FC<CandidateBadgeProps> = ({
  type,
  level,
  status,
  className = "",
}) => {
  if (type !== "project") {
    const config = CANDIDATE_VERIFICATION_CONFIG[type];
    if (!config) return null;
    const Icon = config.icon;
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-mono font-bold tracking-wide uppercase font-sans select-none transition-colors duration-300 ${config.className} ${className}`}
      >
        {Icon && <Icon className="size-2.5 shrink-0" />}
        <span>{config.label}</span>
      </span>
    );
  }

  // Parse project verification level & status
  const numLevel =
    typeof level === "string"
      ? level === "AiAnalyzed"
        ? 1
        : level === "RepositoryLinked"
        ? 2
        : 3
      : level;

  const numStatus =
    typeof status === "string"
      ? status === "Verified"
        ? 1
        : status === "Outdated"
        ? 2
        : status === "Disconnected"
        ? 3
        : 4
      : status;

  if (numLevel === 1) {
    // AI Analyzed
    if (numStatus === 2) {
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase font-sans select-none bg-warning/10 text-warning border border-warning/20 transition-colors duration-300 ${className}`}
        >
          <RefreshCw className="size-2.5 shrink-0 animate-spin-slow" />
          <span>AI Audited • Outdated</span>
        </span>
      );
    }
    if (numStatus === 3) {
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase font-sans select-none bg-danger/10 text-danger border border-danger/20 transition-colors duration-300 ${className}`}
        >
          <XCircle className="size-2.5 shrink-0" />
          <span>AI Audited • Disconnected</span>
        </span>
      );
    }
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase font-sans select-none bg-success/10 text-success border border-success/20 transition-colors duration-300 ${className}`}
      >
        <ShieldCheck className="size-2.5 shrink-0" />
        <span>AI Audited</span>
      </span>
    );
  }

  if (numLevel === 2) {
    // Repo Linked
    if (numStatus === 3) {
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase font-sans select-none bg-danger/10 text-danger border border-danger/20 transition-colors duration-300 ${className}`}
        >
          <XCircle className="size-2.5 shrink-0" />
          <span>Repo Linked • Disconnected</span>
        </span>
      );
    }
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase font-sans select-none bg-primary/10 text-primary border border-primary/20 transition-colors duration-300 ${className}`}
      >
        <ShieldCheck className="size-2.5 shrink-0" />
        <span>Repo Linked</span>
      </span>
    );
  }

  // Default/Self Declared
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase font-sans select-none bg-default/45 text-muted-foreground border border-default transition-colors duration-300 ${className}`}
    >
      <AlertTriangle className="size-2.5 shrink-0" />
      <span>Self Declared</span>
    </span>
  );
};
