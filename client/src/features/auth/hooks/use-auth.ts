"use client";

import { useAuthStore } from '../store/use-auth-store';
import {
  authApi,
  LoginPayload,
  RegisterPayload,
  ResetPasswordPayload,
  CreatePasswordPayload,
  RegisterCompanyPayload,
  SetupWorkspacePayload,
  CompanyLoginPayload
} from '../services/auth.service';
import { User, UserRole, ResourceActionPermission } from '../../../types/auth.types';
import { useState, useCallback } from 'react';
import { normalizeError } from '../../../services/axios-client';
import { normalizeRole } from '../../../lib/utils/auth-utils';

// Shared module-level bootstrap promise to deduplicate parallel mounts during app initialization
let bootstrapPromise: Promise<{ authenticated: boolean; user: User | null }> | null = null;

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
  const initializeUserSession = useCallback(async () => {
    const currentStore = useAuthStore.getState();

    // If already READY, return cached session
    if (currentStore.bootstrapState === 'READY') {
      return { authenticated: currentStore.isAuthenticated, user: currentStore.user };
    }
    
    // If already running (lock active), wait on the promise or return current state
    if (currentStore.bootstrapState === 'BOOTSTRAPPING' || currentStore.bootstrapState === 'VALIDATING') {
      if (bootstrapPromise) {
        return bootstrapPromise;
      }
      // If the state is stuck in BOOTSTRAPPING/VALIDATING but we don't have an active promise,
      // we must have lost the promise reference (e.g. during module reloads or transitions).
      // Let's print a warning and allow a new request to recover the state.
      console.warn('[Auth System] Session bootstrap is in VALIDATING state but bootstrapPromise is null. Re-initializing session to recover.');
    }

    // Acquire lock and transition to bootstrapping
    currentStore.setBootstrapState('BOOTSTRAPPING');

    bootstrapPromise = (async () => {
      const stateStore = useAuthStore.getState();
      stateStore.setBootstrapState('VALIDATING');
      stateStore.setLoading(true);
      console.log('[Auth System] Session bootstrap validation started.');
      try {
        const response = await authApi.fetchMe();
        
        if (response.status === 'EMAIL_VERIFY_PENDING' || response.nextStep === 'VERIFY_EMAIL') {
          stateStore.setPendingVerificationEmail(response.email);
          stateStore.setAuthStatusAndNextStep(response.status, response.nextStep);
          stateStore.logout(false);
          console.log('[Auth System] Session bootstrap complete. Status: EMAIL_VERIFY_PENDING');
          return { authenticated: false, user: null, isUnverified: true, nextStep: response.nextStep };
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
        console.log(`[Auth System] Session bootstrap complete. User authenticated. Role: ${user.role}`);
        return { authenticated: true, user };
      } catch (err) {
        interface AxiosErrorLike {
          response?: { status?: number };
          status?: number;
        }
        const error = err as AxiosErrorLike;
        const status = error?.response?.status || error?.status;
        if (status === 401) {
          console.log('[Auth System] Session bootstrap: No active session (unauthenticated guest).');
        } else {
          console.warn('[Auth System] Session bootstrap validation failed. Cleaning local session.', error);
        }
        stateStore.logout(false);
        return { authenticated: false, user: null };
      } finally {
        stateStore.setInitialized(true);
        stateStore.setBootstrapState('READY');
        stateStore.setLoading(false);
        bootstrapPromise = null;
      }
    })();

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
