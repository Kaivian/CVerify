import { axiosClient } from '../../../services/axios-client';
import {
  LoginResponseData,
  UserProfileResponseData,
  AuthSuccessResponse,
  SendOtpResponseData,
  VerifyOtpResponseData,
  VerifyCompanyLinkResponseData,
  SessionInfoData,
  ResolveEmailAuthStateResponseData,
} from '../../../types/auth.types';
import { z } from 'zod';
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  createPasswordSchema,
  registerCompanySchema,
  setupWorkspaceSchema,
  companyLoginSchema,
} from '../validators/auth.validator';

// Derive request payloads from schemas using Zod's infer capabilities
export type LoginPayload = z.infer<typeof loginSchema>;
export type RegisterPayload = z.infer<typeof registerSchema>;
export type ForgotPasswordPayload = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordPayload = z.infer<typeof resetPasswordSchema> & { token: string };
export type CreatePasswordPayload = z.infer<typeof createPasswordSchema>;
export type RegisterCompanyPayload = z.infer<typeof registerCompanySchema>;
export type SetupWorkspacePayload = z.infer<typeof setupWorkspaceSchema>;
export type CompanyLoginPayload = z.infer<typeof companyLoginSchema>;

export const authApi = {
  /**
   * Log in user using email and password
   */
  login: async (payload: LoginPayload): Promise<LoginResponseData> => {
    const response = await axiosClient.post<LoginResponseData>('/auth/login', {
      email: payload.email,
      password: payload.password,
      rememberMe: payload.rememberMe,
    });
    return response.data;
  },

  /**
   * Authenticate with Google ID token
   */
  loginWithGoogle: async (idToken: string): Promise<LoginResponseData> => {
    const response = await axiosClient.post<LoginResponseData>('/auth/google', {
      idToken,
    });
    return response.data;
  },

  /**
   * Register a new traveler or business account
   */
  register: async (payload: RegisterPayload): Promise<AuthSuccessResponse> => {
    const response = await axiosClient.post<AuthSuccessResponse>('/auth/register', {
      fullName: payload.fullName,
      email: payload.email,
      password: payload.password,
      confirmPassword: payload.confirmPassword,
    });
    return response.data;
  },

  /**
   * Securely terminate current session on both client and backend
   */
  logout: async (): Promise<AuthSuccessResponse> => {
    const response = await axiosClient.post<AuthSuccessResponse>('/auth/logout');
    return response.data;
  },

  /**
   * Trigger token refresh manually (silent refresh handles this automatically in interceptors)
   */
  refreshToken: async (): Promise<LoginResponseData> => {
    const response = await axiosClient.post<LoginResponseData>('/auth/refresh-token');
    return response.data;
  },

  /**
   * Retrieve the active user's profile and roles/permissions
   */
  fetchMe: async (): Promise<UserProfileResponseData> => {
    const response = await axiosClient.get<UserProfileResponseData>('/auth/me');
    return response.data;
  },

  /**
   * Trigger forgot password reset email link
   */
  forgotPassword: async (payload: ForgotPasswordPayload): Promise<AuthSuccessResponse> => {
    const response = await axiosClient.post<AuthSuccessResponse>('/auth/recovery/candidate/forgot', payload);
    return response.data;
  },

  /**
   * Reset user password using the cryptographically verified token
   */
  resetPassword: async (payload: ResetPasswordPayload): Promise<LoginResponseData> => {
    const response = await axiosClient.post<LoginResponseData>('/auth/recovery/candidate/reset', {
      token: payload.token,
      password: payload.password,
      confirmPassword: payload.confirmPassword,
    });
    return response.data;
  },

  /**
   * Verify traveler or business partner email with verification token
   */
  verifyEmail: async (token: string): Promise<LoginResponseData> => {
    const response = await axiosClient.post<LoginResponseData>('/auth/verify-email', { token });
    return response.data;
  },

  /**
   * Resend the verification email to the user
   */
  resendVerification: async (email: string): Promise<AuthSuccessResponse> => {
    const response = await axiosClient.post<AuthSuccessResponse>('/auth/resend-verification', { email });
    return response.data;
  },

  /**
   * Request OTP code via email
   */
  sendOtp: async (email: string, purpose: string): Promise<SendOtpResponseData> => {
    const response = await axiosClient.post<SendOtpResponseData>('/auth/send-otp', { email, purpose });
    return response.data;
  },

  /**
   * Resolve the authentication state for an email identity.
   * Determines whether the user should onboard, authenticate, or verify.
   */
  resolveEmailAuthState: async (email: string): Promise<ResolveEmailAuthStateResponseData> => {
    const response = await axiosClient.post<ResolveEmailAuthStateResponseData>(
      '/auth/resolve-email-auth-state',
      { email },
    );
    return response.data;
  },

  /**
   * Verify requested OTP code
   */
  verifyOtp: async (challengeId: string, email: string, code: string, purpose: string): Promise<VerifyOtpResponseData> => {
    const response = await axiosClient.post<VerifyOtpResponseData>('/auth/verify-otp', { challengeId, email, code, purpose });
    return response.data;
  },

  /**
   * Complete password creation
   */
  createPassword: async (payload: CreatePasswordPayload): Promise<LoginResponseData> => {
    const response = await axiosClient.post<LoginResponseData>('/auth/create-password', payload);
    return response.data;
  },

  /**
   * Register a company and tax information
   */
  registerCompany: async (payload: RegisterCompanyPayload): Promise<{ success: boolean }> => {
    const response = await axiosClient.post<{ success: boolean }>('/auth/register-company', {
      companyName: payload.companyName,
      taxCode: payload.taxCode,
      companyEmail: payload.companyEmail,
    });
    return response.data;
  },

  /**
   * Verify company email onboarding link
   */
  verifyCompanyLink: async (token: string): Promise<VerifyCompanyLinkResponseData> => {
    const response = await axiosClient.post<VerifyCompanyLinkResponseData>('/auth/verify-company-link', { token });
    return response.data;
  },

  /**
   * Finalize organization workspace and owner password
   */
  setupWorkspace: async (payload: SetupWorkspacePayload): Promise<LoginResponseData> => {
    const response = await axiosClient.post<LoginResponseData>('/auth/setup-workspace', payload);
    return response.data;
  },

  /**
   * Authenticate business owner into workspace
   */
  companyLogin: async (payload: CompanyLoginPayload): Promise<LoginResponseData> => {
    const response = await axiosClient.post<LoginResponseData>('/auth/company-login', payload);
    return response.data;
  },

  /**
   * Fetch active sessions for user account
   */
  fetchSessions: async (): Promise<SessionInfoData[]> => {
    const response = await axiosClient.get<SessionInfoData[]>('/auth/sessions');
    return response.data;
  },

  /**
   * Revoke an active session by ID
   */
  revokeSession: async (sessionId: string): Promise<{ message: string }> => {
    const response = await axiosClient.delete<{ message: string }>(`/auth/sessions/${sessionId}`);
    return response.data;
  },

  /**
   * Verify company details for onboarding (Step 1)
   */
  verifyCompanyOnboarding: async (companyName: string, taxCode: string): Promise<{
    signedToken: string | null;
    officialCompanyName: string;
    taxCode: string;
    organizationExists: boolean;
    organizationDisplayName?: string;
    organizationSlug?: string;
    recoveryRequired: boolean;
  }> => {
    const response = await axiosClient.post<{
      signedToken: string | null;
      officialCompanyName: string;
      taxCode: string;
      organizationExists: boolean;
      organizationDisplayName?: string;
      organizationSlug?: string;
      recoveryRequired: boolean;
    }>('/auth/onboarding/verify-company', {
      companyName,
      taxCode,
    });
    return response.data;
  },

  /**
   * Verify OTP during onboarding flow (Step 2)
   */
  verifyOnboardingOtp: async (challengeId: string, email: string, code: string, step1Token: string): Promise<VerifyOtpResponseData> => {
    const response = await axiosClient.post<VerifyOtpResponseData>('/auth/onboarding/verify-otp', {
      challengeId,
      email,
      code,
      purpose: 'Onboarding'
    }, {
      headers: {
        'X-Step1-Token': step1Token
      }
    });
    return response.data;
  },

  /**
   * Verify Google OAuth during onboarding (Step 2)
   */
  verifyOnboardingGoogle: async (idToken: string, step1Token: string): Promise<VerifyOtpResponseData> => {
    const response = await axiosClient.post<VerifyOtpResponseData>('/auth/onboarding/verify-google', {
      idToken,
      step1Token
    });
    return response.data;
  },

  /**
   * Complete 3-step company onboarding workspace provisioning (Step 3)
   */
  completeOnboarding: async (
    payload: {
      step2Token: string;
      organizationUsername: string;
      password: string;
      confirmPassword: string;
      companyDisplayName: string;
    },
    idempotencyKey: string
  ): Promise<LoginResponseData> => {
    const response = await axiosClient.post<LoginResponseData>('/auth/onboarding/complete', payload, {
      headers: {
        'X-Idempotency-Key': idempotencyKey
      }
    });
    return response.data;
  },
};
