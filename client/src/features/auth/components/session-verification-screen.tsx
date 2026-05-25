"use client";

import React, { useState, useEffect } from 'react';
import { useVerificationStages } from '../hooks/use-verification-stages';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../../../stores/use-theme-store';
import { Shield } from 'lucide-react';

/**
 * Premium session verification / auth bootstrap loading screen.
 *
 * Renders as a transitional auth layer (not a standalone page).
 * Designed as a reusable AuthStatusCard pattern — applicable to
 * email verification, OAuth callback, onboarding sync, workspace provisioning.
 *
 * Design tokens: fully semantic (bg-background, text-foreground, etc.)
 * Theme: adaptive logo switching with SSR hydration safeguard
 * Motion: fade-in, slide-up, indeterminate progress — all prefers-reduced-motion aware
 * Accessibility: ARIA live region for stage announcements
 */
interface SessionVerificationScreenProps {
  isAuthenticated: boolean;
}

export const SessionVerificationScreen: React.FC<SessionVerificationScreenProps> = ({
  isAuthenticated,
}) => {
  const { t } = useTranslation(['common']);
  const { stageLabel, progressPercent, isExiting, currentStage } = useVerificationStages(isAuthenticated);
  const theme = useThemeStore((state) => state.theme);

  // SSR hydration safeguard: only render theme-dependent assets after client mount
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Resolve theme-adaptive logo source
  const isDarkTheme = theme === 'dark' || theme === 'ocean';
  const logoSrc = isDarkTheme ? '/brand/logo-white.png' : '/brand/logo-black.png';

  return (
    <div
      className={[
        'flex min-h-screen w-full items-center justify-center bg-background transition-colors duration-300 select-none',
        isExiting ? 'opacity-0 transition-opacity duration-300' : '',
      ].join(' ')}
      style={{
        animation: 'var(--animate-verification-fade-in)',
      }}
      role="status"
      aria-live="polite"
    >
      <div
        className="flex flex-col items-center gap-6 w-full max-w-sm px-6"
        style={{
          animation: 'var(--animate-verification-slide-up)',
          animationDelay: '80ms',
          animationFillMode: 'backwards',
        }}
      >
        {/* Glassmorphism Verification Card */}
        <div className="w-full rounded-2xl border border-border bg-surface/70 backdrop-blur-xl shadow-overlay p-8 flex flex-col items-center gap-6">

          {/* Theme-adaptive Brand Logo */}
          <div
            className="flex items-center justify-center transition-opacity duration-300"
            style={{ opacity: isMounted ? 1 : 0 }}
          >
            {isMounted ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoSrc}
                alt="CVerify"
                className="h-10 w-auto"
                style={{ imageRendering: 'auto' }}
              />
            ) : (
              // Placeholder matching logo height to prevent layout shift during hydration
              <div className="h-10" aria-hidden="true" />
            )}
          </div>

          {/* Verification Status Label */}
          <div className="text-center space-y-1.5">
            <p
              key={currentStage.id}
              className="text-sm font-medium text-foreground font-outfit tracking-tight"
              style={{
                animation: 'var(--animate-verification-slide-up)',
                animationDuration: '250ms',
              }}
            >
              {stageLabel}
            </p>
          </div>

          {/* Segmented Progress Indicator — indeterminate with staged checkpoints */}
          <div className="w-full space-y-3">
            {/* Progress Track */}
            <div className="relative w-full h-1 rounded-full bg-surface-secondary overflow-hidden">
              {/* Determinate fill — advances with stage progress */}
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-accent transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
              {/* Indeterminate shimmer overlay — visible while progress < 100% */}
              {progressPercent < 100 && (
                <div
                  className="absolute inset-y-0 w-1/3 rounded-full bg-accent/30"
                  style={{ animation: 'var(--animate-verification-progress)' }}
                />
              )}
            </div>

            {/* Stage Segment Indicators */}
            <div className="flex items-center justify-between px-1">
              {['initializing', 'establishing', 'verifying', 'verified'].map((stageId, index) => {
                const isActive = currentStage.id === stageId;
                const isPast = progressPercent > [10, 35, 65, 100][index];
                return (
                  <div
                    key={stageId}
                    className={[
                      'w-1.5 h-1.5 rounded-full transition-all duration-300',
                      isActive ? 'bg-accent scale-125' : '',
                      isPast ? 'bg-accent' : '',
                      !isActive && !isPast ? 'bg-surface-tertiary' : '',
                    ].join(' ')}
                    aria-hidden="true"
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* System Metadata Footer — outside the card */}
        <div
          className="flex items-center justify-center gap-3"
          style={{
            animation: 'var(--animate-verification-slide-up)',
            animationDelay: '200ms',
            animationFillMode: 'backwards',
          }}
        >
          {/* Security Badge */}
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-surface-secondary/50 backdrop-blur-sm"
            style={{ animation: 'var(--animate-verification-pulse)' }}
          >
            <Shield size={10} className="text-success" />
            <span className="text-[10px] font-semibold text-muted tracking-wide uppercase">
              {t('common:sessionVerification.securityBadge')}
            </span>
          </div>

          {/* Protocol Version */}
          <span className="text-[10px] font-mono font-medium text-surface-tertiary-foreground tracking-widest">
            {t('common:sessionVerification.protocol')}
          </span>
        </div>
      </div>
    </div>
  );
};

export default SessionVerificationScreen;
