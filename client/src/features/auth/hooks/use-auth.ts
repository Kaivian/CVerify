"use client";

import { useAuthStore } from '../store/use-auth-store';
import {
  authApi,
  type LoginPayload,
  type RegisterPayload,
  type ResetPasswordPayload,
  type CreatePasswordPayload,
  type RegisterCompanyPayload,
  type SetupWorkspacePayload,
  type CompanyLoginPayload
} from '../services/auth.service';
import { type User, type UserRole, type ResourceActionPermission } from '../../../types/auth.types';
import { useState, useCallback } from 'react';
import { normalizeError } from '../../../services/axios-client';
import { normalizeRole } from '../../../lib/utils/auth-utils';

// Shared module-level bootstrap promise to deduplicate parallel mounts during app initialization
let bootstrapPromise: Promise<{ authenticated: boolean; user: User | null; isUnverified?: boolean; nextStep?: string }> | null = null;
let activeAuthAbortController: AbortController | null = null;

export const useAuth = () => {
  const store = useAuthStore();
  const [authError, setAuthError] = useState<string | null>(null);
  
  // Wrapper for Login operation
  const loginUser = async (credentials: LoginPayload) => {
    store.setLoading(true);
    setAuthError(null);
    try {
      const response = await authApi.login(credentials);
      
      if (response.status === 'EMAIL_VERIFY_PENDING' || response.nextStep === 'VERIFY_EMAIL') {
        store.setPendingVerificationEmail(response.email);
        store.setAuthStatusAndNextStep(response.status, response.nextStep);
        store.setLoading(false);
        return { success: true, isUnverified: true, nextStep: response.nextStep, email: response.email };
      }

      const user: User = {
        id: response.id,
        email: response.email,
        fullName: response.fullName,
        avatarUrl: response.avatarUrl,
        role: normalizeRole(response.roles),
        permissions: response.permissions,
        isEmailVerified: response.isEmailVerified,
      };

      store.login(user);
      store.setAuthStatusAndNextStep(response.status, response.nextStep);
      return { success: true, user, nextStep: response.nextStep };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      store.setLoading(false);
      return { success: false, error: parsedError };
    }
  };

  // Wrapper for Google Sign-in operation
  const loginUserWithGoogle = async (idToken: string) => {
    store.setLoading(true);
    setAuthError(null);
    try {
      const response = await authApi.loginWithGoogle(idToken);
      
      if (response.status === 'EMAIL_VERIFY_PENDING' || response.nextStep === 'VERIFY_EMAIL') {
        store.setPendingVerificationEmail(response.email);
        store.setAuthStatusAndNextStep(response.status, response.nextStep);
        store.setLoading(false);
        return { success: true, isUnverified: true, nextStep: response.nextStep, email: response.email };
      }

      const user: User = {
        id: response.id,
        email: response.email,
        fullName: response.fullName,
        avatarUrl: response.avatarUrl,
        role: normalizeRole(response.roles),
        permissions: response.permissions,
        isEmailVerified: response.isEmailVerified,
      };

      store.login(user);
      store.setAuthStatusAndNextStep(response.status, response.nextStep);
      return { success: true, user, nextStep: response.nextStep };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      store.setLoading(false);
      return { success: false, error: parsedError };
    }
  };

  // Wrapper for Registration operation
  const registerUser = async (details: RegisterPayload) => {
    store.setLoading(true);
    setAuthError(null);
    try {
      const response = await authApi.register(details);
      store.setLoading(false);
      return {
        success: true,
        message: response.message || 'Registration successful!',
        statusCode: response.statusCode,
        uiAction: response.uiAction,
      };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      store.setLoading(false);
      return { success: false, error: parsedError };
    }
  };

  // Wrapper for Email Verification operation
  const verifyEmailUser = async (token: string) => {
    store.setLoading(true);
    setAuthError(null);
    try {
      const response = await authApi.verifyEmail(token);
      
      const user: User = {
        id: response.id,
        email: response.email,
        fullName: response.fullName,
        avatarUrl: response.avatarUrl,
        role: normalizeRole(response.roles),
        permissions: response.permissions,
        isEmailVerified: response.isEmailVerified,
      };

      store.login(user);
      store.setAuthStatusAndNextStep(response.status, response.nextStep);
      store.setLoading(false);
      return { success: true, user, nextStep: response.nextStep };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      store.setLoading(false);
      return { success: false, error: parsedError };
    }
  };

  // Wrapper for Password Reset operation
  const resetPasswordUser = async (payload: ResetPasswordPayload) => {
    store.setLoading(true);
    setAuthError(null);
    try {
      const response = await authApi.resetPassword(payload);
      
      const user: User = {
        id: response.id,
        email: response.email,
        fullName: response.fullName,
        avatarUrl: response.avatarUrl,
        role: normalizeRole(response.roles),
        permissions: response.permissions,
        isEmailVerified: response.isEmailVerified,
      };

      store.login(user);
      store.setAuthStatusAndNextStep(response.status, response.nextStep);
      store.setLoading(false);
      return { success: true, user, nextStep: response.nextStep };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      store.setLoading(false);
      return { success: false, error: parsedError };
    }
  };

  // Wrapper for Logout operation (calls API then clears state)
  const logoutUser = async (broadcast = true) => {
    store.setLoading(true);
    try {
      await authApi.logout();
    } catch (err) {
      console.warn('[Session System] Invalidation request on server failed or bypassed:', err);
    } finally {
      store.logout(broadcast);
    }
  };

  // Bootstraps local profile on app boot or token refresh, locking concurrent parallel calls
  const initializeUserSession = useCallback(async (forceRevalidate = false) => {
    const currentStore = useAuthStore.getState();

    // Auto-recovery for stuck hydration states (e.g. from BFCache when promise is lost but store says loading)
    if (currentStore.isLoading && !bootstrapPromise && currentStore.bootstrapState !== 'READY') {
      console.warn('[Auth System] Detected stuck loading state without active promise. Resetting.');
      currentStore.setLoading(false);
      currentStore.setBootstrapState('IDLE');
    }

    if (!forceRevalidate) {
      // If already READY, return cached session
      if (currentStore.bootstrapState === 'READY') {
        return { authenticated: currentStore.isAuthenticated, user: currentStore.user };
      }
      
      // If already running (lock active), wait on the promise or return current state
      if (currentStore.bootstrapState === 'BOOTSTRAPPING' || currentStore.bootstrapState === 'VALIDATING') {
        if (bootstrapPromise) {
          return bootstrapPromise;
        }
        console.warn('[Auth System] Session bootstrap is in VALIDATING state but bootstrapPromise is null. Re-initializing session to recover.');
      }
    } else {
      // On force revalidate, if we are already fetching, cancel the stale request explicitly.
      if (activeAuthAbortController) {
        console.log('[Auth System] Force revalidate requested. Cancelling stale inflight request.');
        activeAuthAbortController.abort('Forced revalidation');
        activeAuthAbortController = null;
      }
    }

    // Determine if we should perform a silent background revalidation
    // Silent revalidation happens if we're forcing revalidate while already READY.
    const isSilentRevalidation = forceRevalidate && currentStore.bootstrapState === 'READY';

    // Acquire lock and transition to bootstrapping (unless silent)
    if (!isSilentRevalidation) {
      currentStore.setBootstrapState('BOOTSTRAPPING');
    }

    // Create a new AbortController for this request
    activeAuthAbortController = new AbortController();
    const signal = activeAuthAbortController.signal;

    bootstrapPromise = new Promise(async (resolve) => {
      const stateStore = useAuthStore.getState();
      if (!isSilentRevalidation) {
        stateStore.setBootstrapState('VALIDATING');
        stateStore.setLoading(true);
      }
      console.log(`[Auth System] Session validation started${isSilentRevalidation ? ' (silent)' : ''}.`);

      // Timeout protection to prevent permanent deadlock
      const timeoutId = setTimeout(() => {
        if (activeAuthAbortController) {
          activeAuthAbortController.abort('Timeout');
        }
        console.error('[Auth System] Session bootstrap timed out after 3000ms. Forcing exit.');
        stateStore.logout(false);
        stateStore.setInitialized(true);
        stateStore.setBootstrapState('READY');
        stateStore.setLoading(false);
        bootstrapPromise = null;
        resolve({ authenticated: false, user: null });
      }, 3000);

      try {
        const response = await authApi.fetchMe(signal);
        clearTimeout(timeoutId);
        
        // Ensure we don't proceed if the timeout already fired and cleared the promise
        if (!bootstrapPromise && !isSilentRevalidation) return;
        
        if (response.status === 'EMAIL_VERIFY_PENDING' || response.nextStep === 'VERIFY_EMAIL') {
          stateStore.setPendingVerificationEmail(response.email);
          stateStore.setAuthStatusAndNextStep(response.status, response.nextStep);
          stateStore.logout(false);
          console.log('[Auth System] Session bootstrap complete. Status: EMAIL_VERIFY_PENDING');
          resolve({ authenticated: false, user: null, isUnverified: true, nextStep: response.nextStep });
          return;
        }

        const user: User = {
          id: response.id,
          email: response.email,
          fullName: response.fullName,
          avatarUrl: response.avatarUrl,
          role: normalizeRole(response.roles),
          permissions: response.permissions,
          isEmailVerified: response.isEmailVerified,
        };

        stateStore.login(user);
        stateStore.setAuthStatusAndNextStep(response.status, response.nextStep);
        console.log(`[Auth System] Session validation complete. User authenticated. Role: ${user.role}`);
        resolve({ authenticated: true, user });
      } catch (err) {
        clearTimeout(timeoutId);
        
        interface AxiosErrorLike {
          name?: string;
          response?: { status?: number };
          status?: number;
        }
        const error = err as AxiosErrorLike;
        
        // If aborted intentionally, just resolve to whatever the current state is.
        if (error?.name === 'CanceledError' || signal.aborted) {
          console.log('[Auth System] Request was intentionally aborted.');
          resolve({ authenticated: stateStore.isAuthenticated, user: stateStore.user });
          return;
        }

        // Ensure we don't proceed if the timeout already fired
        if (!bootstrapPromise && !isSilentRevalidation) return;

        const status = error?.response?.status || error?.status;
        if (status === 401) {
          console.log('[Auth System] Session validation: No active session (unauthenticated guest).');
        } else {
          console.warn('[Auth System] Session validation failed. Cleaning local session.', error);
        }
        stateStore.logout(false);
        resolve({ authenticated: false, user: null });
      } finally {
        // Clean up the abort controller if it's the current one
        if (activeAuthAbortController?.signal === signal) {
          activeAuthAbortController = null;
        }

        if (bootstrapPromise) { // Only run this if not aborted by timeout
          stateStore.setInitialized(true);
          stateStore.setBootstrapState('READY');
          stateStore.setLoading(false);
          bootstrapPromise = null;
        }
      }
    });

    return bootstrapPromise;
  }, []);

    // Send OTP
    const sendOtp = async (email: string, purpose: string) => {
      store.setLoading(true);
      setAuthError(null);
      try {
        const response = await authApi.sendOtp(email, purpose);
        store.setLoading(false);
        return { success: true, data: response };
      } catch (err: unknown) {
        const parsedError = normalizeError(err);
        setAuthError(parsedError.message);
        store.setLoading(false);
        return { success: false, error: parsedError };
      }
    };

    // Resolve identity state for email (lightweight, no loading indicator)
    const resolveEmailAuthState = async (email: string) => {
      setAuthError(null);
      try {
        const response = await authApi.resolveEmailAuthState(email);
        return { success: true as const, data: response };
      } catch (err: unknown) {
        const parsedError = normalizeError(err);
        setAuthError(parsedError.message);
        return { success: false as const, error: parsedError };
      }
    };

    // Verify OTP
    const verifyOtp = async (challengeId: string, email: string, code: string, purpose: string) => {
      store.setLoading(true);
      setAuthError(null);
      try {
        const response = await authApi.verifyOtp(challengeId, email, code, purpose);
        store.setLoading(false);
        return { success: true, data: response };
      } catch (err: unknown) {
        const parsedError = normalizeError(err);
        setAuthError(parsedError.message);
        store.setLoading(false);
        return { success: false, error: parsedError };
      }
    };

    // Create Password
    const createPassword = async (payload: CreatePasswordPayload) => {
      store.setLoading(true);
      setAuthError(null);
      try {
        const response = await authApi.createPassword(payload);
        const user: User = {
          id: response.id,
          email: response.email,
          fullName: response.fullName,
          avatarUrl: response.avatarUrl,
          role: normalizeRole(response.roles),
          permissions: response.permissions,
          isEmailVerified: response.isEmailVerified,
        };
        store.login(user);
        store.setAuthStatusAndNextStep(response.status, response.nextStep);
        return { success: true, user, nextStep: response.nextStep };
      } catch (err: unknown) {
        const parsedError = normalizeError(err);
        setAuthError(parsedError.message);
        store.setLoading(false);
        return { success: false, error: parsedError };
      }
    };

    // Register Company
    const registerCompany = async (payload: RegisterCompanyPayload) => {
      store.setLoading(true);
      setAuthError(null);
      try {
        const response = await authApi.registerCompany(payload);
        store.setLoading(false);
        return { success: true, data: response };
      } catch (err: unknown) {
        const parsedError = normalizeError(err);
        setAuthError(parsedError.message);
        store.setLoading(false);
        return { success: false, error: parsedError };
      }
    };

    // Verify Company Link
    const verifyCompanyLink = async (token: string) => {
      store.setLoading(true);
      setAuthError(null);
      try {
        const response = await authApi.verifyCompanyLink(token);
        store.setLoading(false);
        return { success: true, data: response };
      } catch (err: unknown) {
        const parsedError = normalizeError(err);
        setAuthError(parsedError.message);
        store.setLoading(false);
        return { success: false, error: parsedError };
      }
    };

    // Setup Workspace
    const setupWorkspace = async (payload: SetupWorkspacePayload) => {
      store.setLoading(true);
      setAuthError(null);
      try {
        const response = await authApi.setupWorkspace(payload);
        const user: User = {
          id: response.id,
          email: response.email,
          fullName: response.fullName,
          avatarUrl: response.avatarUrl,
          role: normalizeRole(response.roles),
          permissions: response.permissions,
          isEmailVerified: response.isEmailVerified,
        };
        store.login(user);
        store.setAuthStatusAndNextStep(response.status, response.nextStep);
        return { success: true, user, nextStep: response.nextStep };
      } catch (err: unknown) {
        const parsedError = normalizeError(err);
        setAuthError(parsedError.message);
        store.setLoading(false);
        return { success: false, error: parsedError };
      }
    };

    // Company Login
    const companyLogin = async (payload: CompanyLoginPayload) => {
      store.setLoading(true);
      setAuthError(null);
      try {
        const response = await authApi.companyLogin(payload);
        const user: User = {
          id: response.id,
          email: response.email,
          fullName: response.fullName,
          avatarUrl: response.avatarUrl,
          role: normalizeRole(response.roles),
          permissions: response.permissions,
          isEmailVerified: response.isEmailVerified,
        };
        store.login(user);
        store.setAuthStatusAndNextStep(response.status, response.nextStep);
        return { success: true, user, nextStep: response.nextStep };
      } catch (err: unknown) {
        const parsedError = normalizeError(err);
        setAuthError(parsedError.message);
        store.setLoading(false);
        return { success: false, error: parsedError };
      }
    };

    // Fetch Sessions
    const fetchSessions = async () => {
      try {
        return await authApi.fetchSessions();
      } catch (err: unknown) {
        console.error('Failed to fetch sessions:', err);
        return [];
      }
    };

    // Revoke Session
    const revokeSession = async (sessionId: string) => {
      try {
        await authApi.revokeSession(sessionId);
        return true;
      } catch (err: unknown) {
        console.error('Failed to revoke session:', err);
        return false;
      }
    };

    // Verify Company Onboarding (Step 1)
    const verifyCompanyOnboarding = async (companyName: string, taxCode: string) => {
      store.setLoading(true);
      setAuthError(null);
      try {
        const response = await authApi.verifyCompanyOnboarding(companyName, taxCode);
        store.setLoading(false);
        return { success: true, data: response };
      } catch (err: unknown) {
        const parsedError = normalizeError(err);
        setAuthError(parsedError.message);
        store.setLoading(false);
        return { success: false, error: parsedError };
      }
    };

    // Verify Onboarding OTP (Step 2)
    const verifyOnboardingOtp = async (challengeId: string, email: string, code: string, step1Token: string) => {
      store.setLoading(true);
      setAuthError(null);
      try {
        const response = await authApi.verifyOnboardingOtp(challengeId, email, code, step1Token);
        store.setLoading(false);
        return { success: true, data: response };
      } catch (err: unknown) {
        const parsedError = normalizeError(err);
        setAuthError(parsedError.message);
        store.setLoading(false);
        return { success: false, error: parsedError };
      }
    };

    // Verify Onboarding Google (Step 2)
    const verifyOnboardingGoogle = async (idToken: string, step1Token: string) => {
      store.setLoading(true);
      setAuthError(null);
      try {
        const response = await authApi.verifyOnboardingGoogle(idToken, step1Token);
        store.setLoading(false);
        return { success: true, data: response };
      } catch (err: unknown) {
        const parsedError = normalizeError(err);
        setAuthError(parsedError.message);
        store.setLoading(false);
        return { success: false, error: parsedError };
      }
    };

    // Complete Onboarding Workspace Provisioning (Step 3)
    const completeOnboarding = async (
      payload: {
        step2Token: string;
        organizationUsername: string;
        password: string;
        confirmPassword: string;
        companyDisplayName: string;
      },
      idempotencyKey: string
    ) => {
      store.setLoading(true);
      setAuthError(null);
      try {
        const response = await authApi.completeOnboarding(payload, idempotencyKey);
        const user: User = {
          id: response.id,
          email: response.email,
          fullName: response.fullName,
          avatarUrl: response.avatarUrl,
          role: normalizeRole(response.roles),
          permissions: response.permissions,
          isEmailVerified: response.isEmailVerified,
        };
        store.login(user);
        store.setAuthStatusAndNextStep(response.status, response.nextStep);
        store.setLoading(false);
        return { success: true, user, nextStep: response.nextStep };
      } catch (err: unknown) {
        const parsedError = normalizeError(err);
        setAuthError(parsedError.message);
        store.setLoading(false);
        return { success: false, error: parsedError };
      }
    };

  return {
    // Zustand States
    user: store.user,
    isAuthenticated: store.isAuthenticated,
    isLoading: store.isLoading,
    isInitialized: store.isInitialized,
    bootstrapState: store.bootstrapState,
    authError,
    
    // Auth Actions
    login: loginUser,
    loginWithGoogle: loginUserWithGoogle,
    register: registerUser,
    logout: logoutUser,
    verifyEmail: verifyEmailUser,
    resetPassword: resetPasswordUser,
    initializeSession: initializeUserSession,
    updateProfile: store.updateUser,

    // New actions
    sendOtp,
    resolveEmailAuthState,
    verifyOtp,
    createPassword,
    registerCompany,
    verifyCompanyLink,
    setupWorkspace,
    companyLogin,
    fetchSessions,
    revokeSession,
    
    // Unified Onboarding flow
    verifyCompanyOnboarding,
    verifyOnboardingOtp,
    verifyOnboardingGoogle,
    completeOnboarding,

    // Guards Facades
    hasRole: (role: UserRole) => store.hasRole(role),
    hasPermission: (permission: ResourceActionPermission) => store.hasPermission(permission),
  };
};
