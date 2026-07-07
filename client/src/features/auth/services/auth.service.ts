import { axiosClient } from '../../../services/axios-client';
import {
  type LoginResponseData,
  type UserProfileResponseData,
  type AuthSuccessResponse,
  type SendOtpResponseData,
  type VerifyOtpResponseData,
  type VerifyCompanyLinkResponseData,
  type VerifyOrganizationLinkResponseData,
  type SessionInfoData,
  type ResolveEmailAuthStateResponseData,
  type OtpSessionResponseData,
  type LinkedEmail,
  type LinkedProviderConnection,
  type PendingLinkDetailsResponseData,
  type DeletionRequirementsDto,
  type InitiateDeletionRequest,
  type DeletionInitiationResponse,
  type ReactivateRequest,
  type SetupWorkspaceResponseData,
} from '../../../types/auth.types';
import { type z } from 'zod';
import {
  type loginSchema,
  type registerSchema,
  type forgotPasswordSchema,
  type resetPasswordSchema,
  type createPasswordSchema,
  type registerCompanySchema,
  type registerOrganizationSchema,
  type setupWorkspaceSchema,
  type setupOrganizationWorkspaceSchema,
  type companyLoginSchema,
  type organizationLoginSchema,
} from '../validators/auth.validator';

// Derive request payloads from schemas using Zod's infer capabilities
export type LoginPayload = z.infer<typeof loginSchema>;
export type RegisterPayload = z.infer<typeof registerSchema>;
export type ForgotPasswordPayload = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordPayload = z.infer<typeof resetPasswordSchema> & { token: string };
export type CreatePasswordPayload = z.infer<typeof createPasswordSchema>;
export type RegisterCompanyPayload = z.infer<typeof registerCompanySchema>;
export type RegisterOrganizationPayload = z.infer<typeof registerOrganizationSchema>;
export type SetupWorkspacePayload = z.infer<typeof setupWorkspaceSchema>;
export type SetupOrganizationWorkspacePayload = z.infer<typeof setupOrganizationWorkspaceSchema>;
export type CompanyLoginPayload = z.infer<typeof companyLoginSchema>;
export type OrganizationLoginPayload = z.infer<typeof organizationLoginSchema>;

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
  fetchMe: async (signal?: AbortSignal): Promise<UserProfileResponseData> => {
    const response = await axiosClient.get<UserProfileResponseData>('/auth/me', { signal });
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

  sendOtp: async (email: string, purpose: string, idempotencyKey?: string): Promise<SendOtpResponseData> => {
    const headers = idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : undefined;
    const response = await axiosClient.post<SendOtpResponseData>('/auth/send-otp', { email, purpose }, { headers });
    return response.data;
  },

  /**
   * Fetch active OTP session status for anti-enumeration session check
   */
  fetchOtpSession: async (email: string, purpose: string, challengeId: string): Promise<OtpSessionResponseData> => {
    const response = await axiosClient.get<OtpSessionResponseData>('/auth/otp/session', {
      params: { email, purpose, challengeId },
    });
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
   * Register an organization and tax information
   */
  registerOrganization: async (payload: RegisterOrganizationPayload): Promise<{ success: boolean }> => {
    const response = await axiosClient.post<{ success: boolean }>('/auth/register-organization', {
      organizationName: payload.organizationName,
      taxCode: payload.taxCode,
      organizationEmail: payload.organizationEmail,
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
   * Verify organization email onboarding link
   */
  verifyOrganizationLink: async (token: string): Promise<VerifyOrganizationLinkResponseData> => {
    const response = await axiosClient.post<VerifyOrganizationLinkResponseData>('/auth/verify-organization-link', { token });
    return response.data;
  },

  /**
   * Finalize organization workspace and owner password
   */
  setupWorkspace: async (payload: SetupWorkspacePayload): Promise<SetupWorkspaceResponseData> => {
    const response = await axiosClient.post<SetupWorkspaceResponseData>('/auth/setup-workspace', payload);
    return response.data;
  },

  /**
   * Finalize organization workspace and owner password
   */
  setupOrganizationWorkspace: async (payload: SetupOrganizationWorkspacePayload): Promise<SetupWorkspaceResponseData> => {
    const response = await axiosClient.post<SetupWorkspaceResponseData>('/auth/setup-workspace', {
      verificationToken: payload.verificationToken,
      organizationEmail: payload.organizationEmail,
      organizationUsername: payload.organizationUsername,
      password: payload.password,
      confirmPassword: payload.confirmPassword,
    });
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
   * Authenticate organization owner into workspace
   */
  organizationLogin: async (payload: OrganizationLoginPayload): Promise<LoginResponseData> => {
    const response = await axiosClient.post<LoginResponseData>('/auth/organization-login', payload);
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
   * Revoke all other active sessions (except the current one)
   */
  revokeOtherSessions: async (): Promise<{ message: string }> => {
    const response = await axiosClient.delete<{ message: string }>('/auth/sessions');
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
   * Verify organization details for onboarding (Step 1)
   */
  verifyOrganizationOnboarding: async (organizationName: string, taxCode: string): Promise<{
    signedToken: string | null;
    officialOrganizationName: string;
    taxCode: string;
    organizationExists: boolean;
    organizationDisplayName?: string;
    organizationSlug?: string;
    recoveryRequired: boolean;
  }> => {
    const response = await axiosClient.post<{
      signedToken: string | null;
      officialOrganizationName: string;
      taxCode: string;
      organizationExists: boolean;
      organizationDisplayName?: string;
      organizationSlug?: string;
      recoveryRequired: boolean;
    }>('/auth/onboarding/verify-organization', {
      organizationName,
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
      companyDisplayName: string;
      password?: string;
    },
    idempotencyKey: string
  ): Promise<SetupWorkspaceResponseData> => {
    const response = await axiosClient.post<SetupWorkspaceResponseData>('/auth/onboarding/complete', payload, {
      headers: {
        'X-Idempotency-Key': idempotencyKey
      }
    });
    return response.data;
  },

  /**
   * Fetch OAuth providers and their connection state
   */
  fetchLinkedProviders: async (): Promise<LinkedProvider[]> => {
    const response = await axiosClient.get<LinkedProvider[]>('/auth/providers');
    return response.data;
  },

  /**
   * Unlink an OAuth provider from user account
   */
  unlinkProvider: async (providerName: string): Promise<{ success: boolean; message: string }> => {
    const response = await axiosClient.delete<{ success: boolean; message: string }>(`/auth/providers/${providerName}`);
    return response.data;
  },

  /**
   * Permanently delete the user account
   */
  deleteAccount: async (): Promise<{ message: string }> => {
    const response = await axiosClient.delete<{ message: string }>('/auth/me');
    return response.data;
  },

  /**
   * Fetch deletion requirements for the currently logged in user
   */
  getDeletionRequirements: async (): Promise<DeletionRequirementsDto> => {
    const response = await axiosClient.get<DeletionRequirementsDto>('/users/me/deletion-requirements');
    return response.data;
  },

  /**
   * Request email verification OTP fallback code for account deletion
   */
  sendFallbackOtp: async (email: string): Promise<SendOtpResponseData> => {
    const response = await axiosClient.post<SendOtpResponseData>('/users/me/fallback-otp', { email });
    return response.data;
  },

  /**
   * Initiate deletion request with appropriate verification
   */
  initiateDeletionRequest: async (payload: InitiateDeletionRequest): Promise<DeletionInitiationResponse> => {
    const response = await axiosClient.post<DeletionInitiationResponse>('/users/me/delete-request', payload);
    return response.data;
  },

  /**
   * Reactivate a soft-deleted account within the 14-day deactivation grace period
   */
  reactivateAccount: async (payload: ReactivateRequest): Promise<LoginResponseData> => {
    const response = await axiosClient.post<LoginResponseData>('/auth/reactivate', payload);
    return response.data;
  },

  /**
   * Validate scope permissions for a provider
   */
  validateScopes: async (providerName: string): Promise<{ valid: boolean }> => {
    const response = await axiosClient.post<{ valid: boolean }>(`/auth/providers/${providerName}/validate-scopes`);
    return response.data;
  },

  /**
   * Link Google OAuth account to currently authenticated session using ID Token
   */
  linkGoogleAccount: async (idToken: string): Promise<{ success: boolean; message: string }> => {
    const response = await axiosClient.post<{ success: boolean; message: string }>('/auth/providers/google', { idToken });
    return response.data;
  },

  /**
   * Change password for the active authenticated user
   */
  changePassword: async (payload: ChangePasswordPayload): Promise<{ success: boolean; message: string }> => {
    const response = await axiosClient.post<{ success: boolean; message: string }>('/auth/change-password', payload);
    return response.data;
  },

  /**
   * Send verification OTP for password recovery inside settings
   */
  sendRecoveryOtp: async (): Promise<{ success: boolean; cooldownSeconds: number; cooldownUntil: string; otpExpiresIn: number }> => {
    const response = await axiosClient.post<{ success: boolean; cooldownSeconds: number; cooldownUntil: string; otpExpiresIn: number }>('/auth/password-recovery/send-otp');
    return response.data;
  },

  /**
   * Verify password recovery OTP inside settings
   */
  verifyRecoveryOtp: async (otp: string): Promise<{ success: boolean; verified: boolean; recoveryToken: string; expiresIn: number }> => {
    const response = await axiosClient.post<{ success: boolean; verified: boolean; recoveryToken: string; expiresIn: number }>('/auth/password-recovery/verify-otp', { otp });
    return response.data;
  },

  /**
   * Complete password recovery password change
   */
  changePasswordViaRecovery: async (payload: { recoveryToken: string; newPassword?: string; confirmPassword?: string }): Promise<{ success: boolean }> => {
    const response = await axiosClient.post<{ success: boolean }>('/auth/password-recovery/change-password', payload);
    return response.data;
  },

  /**
   * Fetch all linked emails associated with the active account
   */
  fetchLinkedEmails: async (): Promise<LinkedEmail[]> => {
    const response = await axiosClient.get<LinkedEmail[]>('/auth/emails');
    return response.data;
  },

  /**
   * Dispatch challenge OTP to link a new secondary email
   */
  sendLinkEmailOtp: async (email: string): Promise<SendOtpResponseData> => {
    const response = await axiosClient.post<SendOtpResponseData>('/auth/emails/send-otp', { email });
    return response.data;
  },

  /**
   * Verify link email OTP and save the verified email
   */
  verifyLinkEmailOtp: async (challengeId: string, email: string, code: string): Promise<{ success: boolean; message: string }> => {
    const response = await axiosClient.post<{ success: boolean; message: string }>('/auth/emails/verify-otp', { challengeId, email, code });
    return response.data;
  },

  /**
   * Promote secondary email to primary (requires re-authentication password)
   */
  makeEmailPrimary: async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    const response = await axiosClient.post<{ success: boolean; message: string }>('/auth/emails/make-primary', { email, password });
    return response.data;
  },

  /**
   * Delete / Unlink a secondary email by GUID id
   */
  deleteLinkedEmail: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await axiosClient.delete<{ success: boolean; message: string }>(`/auth/emails/${id}`);
    return response.data;
  },

  /**
   * Fetch all active OAuth connections
   */
  fetchConnections: async (): Promise<LinkedProviderConnection[]> => {
    const response = await axiosClient.get<LinkedProviderConnection[]>('/auth/providers/connections');
    return response.data;
  },

  /**
   * Fetch temporary pending connection details for verification views
   */
  fetchPendingLinkDetails: async (id: string): Promise<PendingLinkDetailsResponseData> => {
    const response = await axiosClient.get<PendingLinkDetailsResponseData>(`/auth/providers/pending/${id}`);
    return response.data;
  },

  /**
   * Confirm and activate a pending connection
   */
  confirmLink: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await axiosClient.post<{ success: boolean; message: string }>(`/auth/providers/confirm/${id}`);
    return response.data;
  },



  /**
   * Unlink/delete a specific OAuth connection by ID
   */
  unlinkConnection: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await axiosClient.delete<{ success: boolean; message: string }>(`/auth/providers/connections/${id}`);
    return response.data;
  },
};

export interface ChangePasswordPayload {
  currentPassword?: string;
  newPassword?: string;
  confirmNewPassword?: string;
}

export interface LinkedProvider {
  providerName: string;
  providerEmail: string | null;
  providerUsername: string | null;
  connected: boolean;
  scopeValidationStatus: string;
  grantedScopes: string | null;
}
