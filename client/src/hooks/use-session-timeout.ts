"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../features/auth/hooks/use-auth';
import { authApi } from '../features/auth/services/auth.service';
import { AUTH_KEYS, AUTH_EVENTS } from '../lib/constants';

// Session configuration constants
const WARNING_THRESHOLD_SECONDS = 2 * 60; // 2 minutes (120 seconds warning)
const INACTIVITY_LIMIT_SECONDS = 13 * 60; // Inactivity lock at 13 minutes

export const useSessionTimeout = () => {
  const { isAuthenticated, logout, user } = useAuth();
  
  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(WARNING_THRESHOLD_SECONDS);
  
  const lastActivityTime = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef<boolean>(false);
  const showWarningRef = useRef<boolean>(false);

  // Keep ref in sync to avoid dependency invalidation inside listener callbacks
  useEffect(() => {
    showWarningRef.current = showWarning;
  }, [showWarning]);

  // Method to trigger silent refresh and extend session
  const extendSession = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    try {
      await authApi.refreshToken();
      
      // Reset state and hide warning modal safely via microtask
      queueMicrotask(() => {
        setShowWarning(false);
        setSecondsRemaining(WARNING_THRESHOLD_SECONDS);
        lastActivityTime.current = Date.now();
      });
      
      // Broadcast extension to other open tabs
      if (typeof window !== 'undefined') {
        const authChannel = new BroadcastChannel(AUTH_KEYS.BROADCAST_CHANNEL);
        authChannel.postMessage({
          type: AUTH_EVENTS.SESSION_EXTEND,
          payload: user,
        });
        authChannel.close();
      }
    } catch (error) {
      console.error('[Session Expiry Sync] Failed to silent-extend session:', error);
      queueMicrotask(() => {
        logout(true);
      });
    } finally {
      isRefreshingRef.current = false;
    }
  }, [logout, user]);

  // Reset inactivity timer on human input
  const resetInactivityTimer = useCallback(() => {
    lastActivityTime.current = Date.now();
    
    // If the warning modal is currently showing, instantly hide it and extend
    if (showWarningRef.current) {
      setShowWarning(false);
      setSecondsRemaining(WARNING_THRESHOLD_SECONDS);
      extendSession();
    }
  }, [extendSession]);

  useEffect(() => {
    if (!isAuthenticated) {
      requestAnimationFrame(() => {
        setShowWarning(false);
      });
      return;
    }

    // Set up standard user input listeners to track active presence
    const activities = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    
    const throttledResetTimer = () => {
      resetInactivityTimer();
    };

    activities.forEach((activity) => {
      window.addEventListener(activity, throttledResetTimer, { passive: true });
    });

    // Unified dynamic high-precision check function
    const checkSession = () => {
      const currentTime = Date.now();
      const activityTime = lastActivityTime.current === 0 ? currentTime : lastActivityTime.current;
      if (lastActivityTime.current === 0) {
        lastActivityTime.current = currentTime;
      }
      const elapsed = (currentTime - activityTime) / 1000;
      const totalSessionTime = INACTIVITY_LIMIT_SECONDS + WARNING_THRESHOLD_SECONDS;

      if (elapsed >= totalSessionTime) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        logout(true);
        return;
      }

      if (elapsed >= INACTIVITY_LIMIT_SECONDS) {
        setShowWarning(true);
        setSecondsRemaining(Math.ceil(totalSessionTime - elapsed));
      } else {
        setShowWarning(false);
      }
    };

    // Immediate initial assessment on mount/auth-state change scheduled asynchronously
    // to avoid synchronous setState calls inside the effect body
    requestAnimationFrame(checkSession);

    // 1-second dynamic precise assessment interval
    timerRef.current = setInterval(checkSession, 1000);

    // Synchronize instantly when tab focus returns
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkSession();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Multi-tab synchronization BroadcastChannel listener
    let syncChannel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined') {
      syncChannel = new BroadcastChannel(AUTH_KEYS.BROADCAST_CHANNEL);
      syncChannel.onmessage = (event) => {
        if (event.data.type === AUTH_EVENTS.SESSION_EXTEND || event.data.type === AUTH_EVENTS.LOGIN) {
          lastActivityTime.current = Date.now();
          queueMicrotask(() => {
            setShowWarning(false);
            setSecondsRemaining(WARNING_THRESHOLD_SECONDS);
          });
        } else if (event.data.type === AUTH_EVENTS.LOGOUT) {
          queueMicrotask(() => {
            setShowWarning(false);
          });
        }
      };
    }

    return () => {
      activities.forEach((activity) => {
        window.removeEventListener(activity, throttledResetTimer);
      });
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (syncChannel) {
        syncChannel.close();
      }
    };
  }, [isAuthenticated, resetInactivityTimer, logout]);

  return {
    showWarning,
    secondsRemaining,
    extendSession,
    logout: () => logout(true),
  };
};
