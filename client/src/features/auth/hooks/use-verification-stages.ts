"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../store/use-auth-store';
import { type BootstrapState } from '../../../types/auth.types';

type SessionVerificationKey =
  | 'common:sessionVerification.initializing'
  | 'common:sessionVerification.establishing'
  | 'common:sessionVerification.verifying'
  | 'common:sessionVerification.verified'
  | 'common:sessionVerification.preparing';

export interface VerificationStage {
  id: string;
  labelKey: SessionVerificationKey;
  progress: number;
  tone: 'neutral' | 'success' | 'warning';
}

const STAGE_MAP: Record<BootstrapState, VerificationStage> = {
  IDLE: {
    id: 'initializing',
    labelKey: 'common:sessionVerification.initializing',
    progress: 10,
    tone: 'neutral',
  },
  BOOTSTRAPPING: {
    id: 'establishing',
    labelKey: 'common:sessionVerification.establishing',
    progress: 35,
    tone: 'neutral',
  },
  VALIDATING: {
    id: 'verifying',
    labelKey: 'common:sessionVerification.verifying',
    progress: 65,
    tone: 'neutral',
  },
  READY: {
    id: 'verified',
    labelKey: 'common:sessionVerification.verified',
    progress: 100,
    tone: 'success',
  },
};

const PREPARING_LABEL_KEY = 'common:sessionVerification.preparing' as const;

const ENGLISH_LABELS: Record<string, string> = {
  'common:sessionVerification.initializing': "Initializing secure session...",
  'common:sessionVerification.establishing': "Establishing authentication channel...",
  'common:sessionVerification.verifying': "Verifying identity token...",
  'common:sessionVerification.verified': "Session verified — redirecting...",
  'common:sessionVerification.preparing': "Preparing authentication..."
};

const MIN_TOTAL_VISIBLE_MS = 800;
const MIN_STAGE_TRANSITION_MS = 200;

export interface UseVerificationStagesReturn {
  currentStage: VerificationStage;
  stageLabel: string;
  progressPercent: number;
  isComplete: boolean;
  isExiting: boolean;
  onTransitionComplete: () => void;
}

export function useVerificationStages(isAuthenticated: boolean): UseVerificationStagesReturn {
  const bootstrapState = useAuthStore((state) => state.bootstrapState);

  const [displayedStage, setDisplayedStage] = useState<VerificationStage>(STAGE_MAP.IDLE);
  const [isExiting, setIsExiting] = useState(false);

  const lastTransitionRef = useRef<number>(0);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [hasMinTimeElapsed, setHasMinTimeElapsed] = useState(false);

  // Track elapsed time safety on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setHasMinTimeElapsed(true);
    }, MIN_TOTAL_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, []);

  // Resolve which stage to display, applying minimum transition delays
  useEffect(() => {
    if (lastTransitionRef.current === 0) {
      lastTransitionRef.current = Date.now();
    }
    const targetStage = STAGE_MAP[bootstrapState];
    const now = Date.now();
    const elapsedSinceLastTransition = now - lastTransitionRef.current;
    const remainingDelay = Math.max(0, MIN_STAGE_TRANSITION_MS - elapsedSinceLastTransition);

    // Clear any pending transition from the previous state change
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }

    // If the new stage is the same as the current one, skip
    if (targetStage.id === displayedStage.id) return;

    const applyTransition = () => {
      lastTransitionRef.current = Date.now();
      setDisplayedStage(targetStage);
    };

    if (remainingDelay > 0) {
      transitionTimeoutRef.current = setTimeout(applyTransition, remainingDelay);
    } else {
      applyTransition();
    }

    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, [bootstrapState, displayedStage.id]);

  // Resolve the display label — READY state differs based on authentication result
  const stageLabel = (() => {
    if (displayedStage.id === 'verified' && !isAuthenticated) {
      return ENGLISH_LABELS[PREPARING_LABEL_KEY];
    }
    return ENGLISH_LABELS[displayedStage.labelKey];
  })();

  // Determine completion readiness with minimum visible duration
  const isComplete = bootstrapState === 'READY';

  // Trigger exit animation when bootstrap completes and minimum time has elapsed
  useEffect(() => {
    if (isComplete && hasMinTimeElapsed) {
      const timer = setTimeout(() => {
        setIsExiting(true);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isComplete, hasMinTimeElapsed]);

  const onTransitionComplete = useCallback(() => {
    // No-op
  }, []);

  return {
    currentStage: displayedStage,
    stageLabel,
    progressPercent: displayedStage.progress,
    isComplete: isComplete && hasMinTimeElapsed,
    isExiting,
    onTransitionComplete,
  };
}
