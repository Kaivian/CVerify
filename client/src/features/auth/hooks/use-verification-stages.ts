"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../store/use-auth-store';
import { type BootstrapState } from '../../../types/auth.types';
import { useTranslation } from 'react-i18next';

/** Union of all session verification i18n keys used in stage definitions */
type SessionVerificationKey =
  | 'common:sessionVerification.initializing'
  | 'common:sessionVerification.establishing'
  | 'common:sessionVerification.verifying'
  | 'common:sessionVerification.verified'
  | 'common:sessionVerification.preparing';

/**
 * Extensible verification stage definition.
 * Designed to scale with future bootstrap states (EXPIRED, REFRESHING, SYNCING_PROFILE, etc.)
 * without rewriting the UI architecture.
 */
export interface VerificationStage {
  id: string;
  labelKey: SessionVerificationKey;
  progress: number;
  tone: 'neutral' | 'success' | 'warning';
}

/** Maps each BootstrapState to a stage configuration */
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

/** Resolved label for unauthenticated READY state */
const PREPARING_LABEL_KEY = 'common:sessionVerification.preparing' as const;

/** Minimum total visible duration before allowing completion (ms) */
const MIN_TOTAL_VISIBLE_MS = 800;

/** Minimum per-stage transition delay — prevents flicker on fast bootstraps (ms) */
const MIN_STAGE_TRANSITION_MS = 200;

export interface UseVerificationStagesReturn {
  currentStage: VerificationStage;
  stageLabel: string;
  progressPercent: number;
  isComplete: boolean;
  isExiting: boolean;
  onTransitionComplete: () => void;
}

/**
 * Manages adaptive-timed verification stages that map to real bootstrap state transitions.
 *
 * Adaptive timing behavior:
 * - Fast bootstrap: stages merge/compress with ~200ms transitions, total ~800ms min
 * - Slow bootstrap: full staged progression shown naturally without artificial delay
 *
 * @param isAuthenticated — controls whether READY shows "verified" or "preparing" label
 */
export function useVerificationStages(isAuthenticated: boolean): UseVerificationStagesReturn {
  const { t } = useTranslation(['common']);
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
      return t(PREPARING_LABEL_KEY);
    }
    return t(displayedStage.labelKey);
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

  /** Called by the parent guard after fade-out animation completes to allow rendering children */
  const onTransitionComplete = useCallback(() => {
    // No-op — the guard controls rendering based on isExiting state
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
