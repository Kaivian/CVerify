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
  type CompanyLoginPayload,
  type ChangePasswordPayload
} from '../services/auth.service';
import { type User, type UserRole, type ResourceActionPermission } from '../../../types/auth.types';
import { useState, useCallback } from 'react';
import { normalizeError } from '../../../services/axios-client';
import { normalizeRole } from '../../../lib/utils/auth-utils';

// Shared module-level bootstrap promise to deduplicate parallel mounts during app initialization
let bootstrapPromise: Promise<{ authenticated: boolean; user: User | null; isUnverified?: boolean; nextStep?: string }> | null = null;
let activeAuthAbortController: AbortController | null = null;

export const useAuth = () => {
  const storeUser = useAuthStore(s => s.user);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const isLoading = useAuthStore(s => s.isLoading);
  const isInitialized = useAuthStore(s => s.isInitialized);
  const bootstrapState = useAuthStore(s => s.bootstrapState);

  // Store actions destructured with individual selectors for absolute stability
  const setLoading = useAuthStore(s => s.setLoading);
  const setPendingVerificationEmail = useAuthStore(s => s.setPendingVerificationEmail);
  const setAuthStatusAndNextStep = useAuthStore(s => s.setAuthStatusAndNextStep);
  const login = useAuthStore(s => s.login);
  const logout = useAuthStore(s => s.logout);
  const updateUserStore = useAuthStore(s => s.updateUser);
  const storeHasRole = useAuthStore(s => s.hasRole);
  const storeHasPermission = useAuthStore(s => s.hasPermission);

  const [authError, setAuthError] = useState<string | null>(null);
  
  // Wrapper for Login operation
  const loginUser = useCallback(async (credentials: LoginPayload) => {
    setLoading(true);
    setAuthError(null);
    try {
      const response = await authApi.login(credentials);
      
      if (response.status === 'EMAIL_VERIFY_PENDING' || response.nextStep === 'VERIFY_EMAIL') {
        setPendingVerificationEmail(response.email);
        setAuthStatusAndNextStep(response.status, response.nextStep);
        setLoading(false);
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
        passwordChangedAt: response.passwordChangedAt,
        hasPassword: response.hasPassword,
      };

      login(user);
      setAuthStatusAndNextStep(response.status, response.nextStep);
      return { success: true, user, nextStep: response.nextStep };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      setLoading(false);
      return { success: false, error: parsedError };
    }
  }, [setLoading, setPendingVerificationEmail, setAuthStatusAndNextStep, login]);

  // Wrapper for Google Sign-in operation
  const loginUserWithGoogle = useCallback(async (idToken: string) => {
    setLoading(true);
    setAuthError(null);
    try {
      const response = await authApi.loginWithGoogle(idToken);
      
      if (response.status === 'EMAIL_VERIFY_PENDING' || response.nextStep === 'VERIFY_EMAIL') {
        setPendingVerificationEmail(response.email);
        setAuthStatusAndNextStep(response.status, response.nextStep);
        setLoading(false);
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
        passwordChangedAt: response.passwordChangedAt,
        hasPassword: response.hasPassword,
      };

      login(user);
      setAuthStatusAndNextStep(response.status, response.nextStep);
      return { success: true, user, nextStep: response.nextStep };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      setLoading(false);
      return { success: false, error: parsedError };
    }
  }, [setLoading, setPendingVerificationEmail, setAuthStatusAndNextStep, login]);

  // Wrapper for Registration operation
  const registerUser = useCallback(async (details: RegisterPayload) => {
    setLoading(true);
    setAuthError(null);
    try {
      const response = await authApi.register(details);
      setLoading(false);
      return {
        success: true,
        message: response.message || 'Registration successful!',
        statusCode: response.statusCode,
        uiAction: response.uiAction,
      };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      setLoading(false);
      return { success: false, error: parsedError };
    }
  }, [setLoading]);

  // Wrapper for Email Verification operation
  const verifyEmailUser = useCallback(async (token: string) => {
    setLoading(true);
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
        passwordChangedAt: response.passwordChangedAt,
        hasPassword: response.hasPassword,
      };

      login(user);
      setAuthStatusAndNextStep(response.status, response.nextStep);
      setLoading(false);
      return { success: true, user, nextStep: response.nextStep };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      setLoading(false);
      return { success: false, error: parsedError };
    }
  }, [setLoading, login, setAuthStatusAndNextStep]);

  // Wrapper for Password Reset operation
  const resetPasswordUser = useCallback(async (payload: ResetPasswordPayload) => {
    setLoading(true);
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
        passwordChangedAt: response.passwordChangedAt,
        hasPassword: response.hasPassword,
      };

      login(user);
      setAuthStatusAndNextStep(response.status, response.nextStep);
      setLoading(false);
      return { success: true, user, nextStep: response.nextStep };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      setLoading(false);
      return { success: false, error: parsedError };
    }
  }, [setLoading, login, setAuthStatusAndNextStep]);

  // Wrapper for Logout operation (calls API then clears state)
  const logoutUser = useCallback(async (broadcast = true) => {
    setLoading(true);
    try {
      await authApi.logout();
    } catch (err) {
      console.warn('[Session System] Invalidation request on server failed or bypassed:', err);
    } finally {
      logout(broadcast);
    }
  }, [setLoading, logout]);

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
          passwordChangedAt: response.passwordChangedAt,
          hasPassword: response.hasPassword,
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
  const sendOtp = useCallback(async (email: string, purpose: string, idempotencyKey?: string) => {
    setLoading(true);
    setAuthError(null);
    try {
      const response = await authApi.sendOtp(email, purpose, idempotencyKey);
      setLoading(false);
      return { success: true, data: response };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      setLoading(false);
      return { success: false, error: parsedError };
    }
  }, [setLoading]);

  // Fetch OTP active session status
  const fetchOtpSession = useCallback(async (email: string, purpose: string, challengeId: string) => {
    setLoading(true);
    setAuthError(null);
    try {
      const response = await authApi.fetchOtpSession(email, purpose, challengeId);
      setLoading(false);
      return { success: true, data: response };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      setLoading(false);
      return { success: false, error: parsedError };
    }
  }, [setLoading]);

  // Resolve identity state for email (lightweight, no loading indicator)
  const resolveEmailAuthState = useCallback(async (email: string) => {
    setAuthError(null);
    try {
      const response = await authApi.resolveEmailAuthState(email);
      return { success: true as const, data: response };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      return { success: false as const, error: parsedError };
    }
  }, []);

  // Verify OTP
  const verifyOtp = useCallback(async (challengeId: string, email: string, code: string, purpose: string) => {
    setLoading(true);
    setAuthError(null);
    try {
      const response = await authApi.verifyOtp(challengeId, email, code, purpose);
      setLoading(false);
      return { success: true, data: response };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      setLoading(false);
      return { success: false, error: parsedError };
    }
  }, [setLoading]);

  // Create Password
  const createPassword = useCallback(async (payload: CreatePasswordPayload) => {
    setLoading(true);
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
        passwordChangedAt: response.passwordChangedAt,
        hasPassword: response.hasPassword,
      };
      login(user);
      setAuthStatusAndNextStep(response.status, response.nextStep);
      return { success: true, user, nextStep: response.nextStep };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      setLoading(false);
      return { success: false, error: parsedError };
    }
  }, [setLoading, login, setAuthStatusAndNextStep]);

  // Register Company
  const registerCompany = useCallback(async (payload: RegisterCompanyPayload) => {
    setLoading(true);
    setAuthError(null);
    try {
      const response = await authApi.registerCompany(payload);
      setLoading(false);
      return { success: true, data: response };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      setLoading(false);
      return { success: false, error: parsedError };
    }
  }, [setLoading]);

  // Verify Company Link
  const verifyCompanyLink = useCallback(async (token: string) => {
    setLoading(true);
    setAuthError(null);
    try {
      const response = await authApi.verifyCompanyLink(token);
      setLoading(false);
      return { success: true, data: response };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      setLoading(false);
      return { success: false, error: parsedError };
    }
  }, [setLoading]);

  // Setup Workspace
  const setupWorkspace = useCallback(async (payload: SetupWorkspacePayload) => {
    setLoading(true);
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
        passwordChangedAt: response.passwordChangedAt,
        hasPassword: response.hasPassword,
      };
      login(user);
      setAuthStatusAndNextStep(response.status, response.nextStep);
      return { success: true, user, nextStep: response.nextStep };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      setLoading(false);
      return { success: false, error: parsedError };
    }
  }, [setLoading, login, setAuthStatusAndNextStep]);

  // Company Login
  const companyLogin = useCallback(async (payload: CompanyLoginPayload) => {
    setLoading(true);
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
        passwordChangedAt: response.passwordChangedAt,
        hasPassword: response.hasPassword,
      };
      login(user);
      setAuthStatusAndNextStep(response.status, response.nextStep);
      return { success: true, user, nextStep: response.nextStep };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      setLoading(false);
      return { success: false, error: parsedError };
    }
  }, [setLoading, login, setAuthStatusAndNextStep]);

  // Fetch Sessions
  const fetchSessions = useCallback(async () => {
    try {
      return await authApi.fetchSessions();
    } catch (err: unknown) {
      console.error('Failed to fetch sessions:', err);
      return [];
    }
  }, []);

  // Revoke Session
  const revokeSession = useCallback(async (sessionId: string) => {
    try {
      await authApi.revokeSession(sessionId);
      return { success: true };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      console.error('Failed to revoke session:', parsedError);
      return { success: false, error: parsedError.message };
    }
  }, []);

  // Revoke All Other Sessions
  const revokeOtherSessions = useCallback(async () => {
    try {
      await authApi.revokeOtherSessions();
      return { success: true };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      console.error('Failed to revoke other sessions:', parsedError);
      return { success: false, error: parsedError.message };
    }
  }, []);

  // Verify Company Onboarding (Step 1)
  const verifyCompanyOnboarding = useCallback(async (companyName: string, taxCode: string) => {
    setLoading(true);
    setAuthError(null);
    try {
      const response = await authApi.verifyCompanyOnboarding(companyName, taxCode);
      setLoading(false);
      return { success: true, data: response };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      setLoading(false);
      return { success: false, error: parsedError };
    }
  }, [setLoading]);

  // Verify Onboarding OTP (Step 2)
  const verifyOnboardingOtp = useCallback(async (challengeId: string, email: string, code: string, step1Token: string) => {
    setLoading(true);
    setAuthError(null);
    try {
      const response = await authApi.verifyOnboardingOtp(challengeId, email, code, step1Token);
      setLoading(false);
      return { success: true, data: response };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      setLoading(false);
      return { success: false, error: parsedError };
    }
  }, [setLoading]);

  // Verify Onboarding Google (Step 2)
  const verifyOnboardingGoogle = useCallback(async (idToken: string, step1Token: string) => {
    setLoading(true);
    setAuthError(null);
    try {
      const response = await authApi.verifyOnboardingGoogle(idToken, step1Token);
      setLoading(false);
      return { success: true, data: response };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      setLoading(false);
      return { success: false, error: parsedError };
    }
  }, [setLoading]);

  // Complete Onboarding Workspace Provisioning (Step 3)
  const completeOnboarding = useCallback(async (
    payload: {
      step2Token: string;
      organizationUsername: string;
      password: string;
      confirmPassword: string;
      companyDisplayName: string;
    },
    idempotencyKey: string
  ) => {
    setLoading(true);
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
        passwordChangedAt: response.passwordChangedAt,
        hasPassword: response.hasPassword,
      };
      login(user);
      setAuthStatusAndNextStep(response.status, response.nextStep);
      setLoading(false);
      return { success: true, user, nextStep: response.nextStep };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      setLoading(false);
      return { success: false, error: parsedError };
    }
  }, [setLoading, login, setAuthStatusAndNextStep]);

  // Delete account action
  const deleteAccount = useCallback(async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const response = await authApi.deleteAccount();
      logout(false);
      setLoading(false);
      return { success: true, data: response };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      setLoading(false);
      return { success: false, error: parsedError };
    }
  }, [setLoading, logout]);

  // Change password action
  const changePassword = useCallback(async (payload: ChangePasswordPayload) => {
    setLoading(true);
    setAuthError(null);
    try {
      const response = await authApi.changePassword(payload);
      setLoading(false);
      return { success: true, data: response };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      setLoading(false);
      return { success: false, error: parsedError };
    }
  }, [setLoading]);

  // Fetch linked providers action
  const fetchLinkedProviders = useCallback(async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const response = await authApi.fetchLinkedProviders();
      setLoading(false);
      return { success: true, data: response };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      setLoading(false);
      return { success: false, error: parsedError };
    }
  }, [setLoading]);

  // Link Google Account action
  const linkGoogleAccount = useCallback(async (idToken: string) => {
    setLoading(true);
    setAuthError(null);
    try {
      const response = await authApi.linkGoogleAccount(idToken);
      setLoading(false);
      return { success: true, data: response };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      setLoading(false);
      return { success: false, error: parsedError };
    }
  }, [setLoading]);

  // Unlink provider action
  const unlinkProvider = useCallback(async (providerName: string) => {
    setLoading(true);
    setAuthError(null);
    try {
      const response = await authApi.unlinkProvider(providerName);
      setLoading(false);
      return { success: true, data: response };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      setLoading(false);
      return { success: false, error: parsedError };
    }
  }, [setLoading]);

  // Validate scopes action
  const validateScopes = useCallback(async (providerName: string) => {
    setLoading(true);
    setAuthError(null);
    try {
      const response = await authApi.validateScopes(providerName);
      setLoading(false);
      return { success: true, data: response };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      setLoading(false);
      return { success: false, error: parsedError };
    }
  }, [setLoading]);

  // Forgot password action
  const forgotPassword = useCallback(async (email: string) => {
    setLoading(true);
    setAuthError(null);
    try {
      const response = await authApi.forgotPassword({ email });
      setLoading(false);
      return { success: true, data: response };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      setLoading(false);
      return { success: false, error: parsedError };
    }
  }, [setLoading]);

  // Send Recovery OTP action
  const sendRecoveryOtp = useCallback(async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const response = await authApi.sendRecoveryOtp();
      setLoading(false);
      return { success: true, data: response };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      setLoading(false);
      return { success: false, error: parsedError };
    }
  }, [setLoading]);

  // Verify Recovery OTP action
  const verifyRecoveryOtp = useCallback(async (otp: string) => {
    setLoading(true);
    setAuthError(null);
    try {
      const response = await authApi.verifyRecoveryOtp(otp);
      setLoading(false);
      return { success: true, data: response };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      setLoading(false);
      return { success: false, error: parsedError };
    }
  }, [setLoading]);

  // Change Password via Recovery action
  const changePasswordViaRecovery = useCallback(async (payload: { recoveryToken: string; newPassword?: string; confirmPassword?: string }) => {
    setLoading(true);
    setAuthError(null);
    try {
      const response = await authApi.changePasswordViaRecovery(payload);
      setLoading(false);
      return { success: true, data: response };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      setLoading(false);
      return { success: false, error: parsedError };
    }
  }, [setLoading]);

  // Fetch linked emails
  const fetchLinkedEmails = useCallback(async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const response = await authApi.fetchLinkedEmails();
      setLoading(false);
      return { success: true, data: response };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      setLoading(false);
      return { success: false, error: parsedError };
    }
  }, [setLoading]);

  // Send link email OTP
  const sendLinkEmailOtp = useCallback(async (email: string) => {
    setLoading(true);
    setAuthError(null);
    try {
      const response = await authApi.sendLinkEmailOtp(email);
      setLoading(false);
      return { success: true, data: response };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      setLoading(false);
      return { success: false, error: parsedError };
    }
  }, [setLoading]);

  // Verify link email OTP
  const verifyLinkEmailOtp = useCallback(async (challengeId: string, email: string, code: string) => {
    setLoading(true);
    setAuthError(null);
    try {
      const response = await authApi.verifyLinkEmailOtp(challengeId, email, code);
      setLoading(false);
      return { success: true, data: response };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      setLoading(false);
      return { success: false, error: parsedError };
    }
  }, [setLoading]);

  // Promote email to primary
  const makeEmailPrimary = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setAuthError(null);
    try {
      const response = await authApi.makeEmailPrimary(email, password);
      setLoading(false);
      return { success: true, data: response };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      setLoading(false);
      return { success: false, error: parsedError };
    }
  }, [setLoading]);

  // Delete linked email
  const deleteLinkedEmail = useCallback(async (id: string) => {
    setLoading(true);
    setAuthError(null);
    try {
      const response = await authApi.deleteLinkedEmail(id);
      setLoading(false);
      return { success: true, data: response };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      setLoading(false);
      return { success: false, error: parsedError };
    }
  }, [setLoading]);

  // Fetch active connections
  const fetchConnections = useCallback(async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const data = await authApi.fetchConnections();
      setLoading(false);
      return { success: true, data };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      setLoading(false);
      return { success: false, error: parsedError };
    }
  }, [setLoading]);

  // Fetch pending link details
  const fetchPendingLinkDetails = useCallback(async (id: string) => {
    setLoading(true);
    setAuthError(null);
    try {
      const data = await authApi.fetchPendingLinkDetails(id);
      setLoading(false);
      return { success: true, data };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      setLoading(false);
      return { success: false, error: parsedError };
    }
  }, [setLoading]);

  // Confirm pending link
  const confirmLink = useCallback(async (id: string) => {
    setLoading(true);
    setAuthError(null);
    try {
      const data = await authApi.confirmLink(id);
      setLoading(false);
      return { success: true, data };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      setLoading(false);
      return { success: false, error: parsedError };
    }
  }, [setLoading]);



  // Unlink specific connection
  const unlinkConnection = useCallback(async (id: string) => {
    setLoading(true);
    setAuthError(null);
    try {
      const data = await authApi.unlinkConnection(id);
      setLoading(false);
      return { success: true, data };
    } catch (err: unknown) {
      const parsedError = normalizeError(err);
      setAuthError(parsedError.message);
      setLoading(false);
      return { success: false, error: parsedError };
    }
  }, [setLoading]);

  return {
    // Zustand States
    user: storeUser,
    isAuthenticated,
    isLoading,
    isInitialized,
    bootstrapState,
    authError,
    
    // Auth Actions
    login: loginUser,
    loginWithGoogle: loginUserWithGoogle,
    register: registerUser,
    logout: logoutUser,
    verifyEmail: verifyEmailUser,
    resetPassword: resetPasswordUser,
    initializeSession: initializeUserSession,
    updateProfile: updateUserStore,
 
    // New actions
    sendOtp,
    fetchOtpSession,
    resolveEmailAuthState,
    verifyOtp,
    createPassword,
    registerCompany,
    verifyCompanyLink,
    setupWorkspace,
    companyLogin,
    fetchSessions,
    revokeSession,
    revokeOtherSessions,
    
    // OAuth provider integration actions
    deleteAccount,
    fetchLinkedProviders,
    unlinkProvider,
    validateScopes,
    forgotPassword,
    changePassword,
    linkGoogleAccount,
    
    // Settings password recovery actions
    sendRecoveryOtp,
    verifyRecoveryOtp,
    changePasswordViaRecovery,
    
    // Linked email management actions
    fetchLinkedEmails,
    sendLinkEmailOtp,
    verifyLinkEmailOtp,
    makeEmailPrimary,
    deleteLinkedEmail,

    // Multi-account OAuth actions
    fetchConnections,
    fetchPendingLinkDetails,
    confirmLink,
    unlinkConnection,

    // Unified Onboarding flow
    verifyCompanyOnboarding,
    verifyOnboardingOtp,
    verifyOnboardingGoogle,
    completeOnboarding,

    // Guards Facades
    hasRole: useCallback((role: UserRole) => storeHasRole(role), [storeHasRole]),
    hasPermission: useCallback((permission: ResourceActionPermission) => storeHasPermission(permission), [storeHasPermission]),
  };
};
