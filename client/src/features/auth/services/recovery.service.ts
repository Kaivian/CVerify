import { axiosClient } from '../../../services/axios-client';
import { LoginResponseData } from '../../../types/auth.types';

export interface SubmitClaimPayload {
  representativeFullName: string;
  representativePosition: string;
  phoneNumber: string;
  recoveryEmail: string;
  taxCode: string;
  emailVerificationToken: string;
  documents: File[];
}

export interface SubmitClaimResponseData {
  claimId: string;
  riskScore: number;
  riskLevel: string;
  status: string;
}

export interface DocumentInfoData {
  documentId: string;
  fileName: string;
  contentType: string;
  virusScanStatus: string;
  createdAt: string;
}

export interface RiskHeuristicsInfoData {
  ocrMetadata: string;
  suspiciousMetadata: string;
  workspaceActivity: string;
  ipDeviceFlags: string;
  historicalClaimFlags: string;
}

export interface ClaimDetailsResponseData {
  claimId: string;
  taxCode: string;
  companyName: string;
  representativeFullName: string;
  representativePosition: string;
  phoneNumber: string;
  recoveryEmail: string;
  riskScore: number;
  riskLevel: string;
  suggestedStrategy: string;
  status: string;
  rejectionReason: string | null;
  reviewedBy: string | null;
  secondReviewerBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  documents: DocumentInfoData[];
  riskHeuristics: RiskHeuristicsInfoData;
}

export interface VerifyBootstrapResponseData {
  isValid: boolean;
  approvedRepresentative: string;
  verifiedRecoveryEmail: string;
  suggestedStrategy: string;
  organizationName: string;
  organizationSlug: string;
}

export interface SetupRecoveryCredentialsPayload {
  token: string;
  newPassword: string;
}

export interface SetupRecoveryCredentialsResponseData {
  sessionToken: string;
  verifiedRecoveryEmail: string;
}

export interface ExecuteRecoveryPayload {
  sessionToken: string;
  strategy: string; // 'OptionA' | 'OptionB'
  displayName: string;
  slug: string;
}

export interface VerifyOrganizationOtpPayload {
  taxCode: string;
  challengeId: string;
  code: string;
}

export interface ResetOrganizationPasswordPayload {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export const recoveryApi = {
  /**
   * Submit an organization access recovery claim with legal documents
   */
  submitClaim: async (payload: SubmitClaimPayload): Promise<SubmitClaimResponseData> => {
    const formData = new FormData();
    formData.append('RepresentativeFullName', payload.representativeFullName);
    formData.append('RepresentativePosition', payload.representativePosition);
    formData.append('PhoneNumber', payload.phoneNumber);
    formData.append('RecoveryEmail', payload.recoveryEmail);
    formData.append('TaxCode', payload.taxCode);
    formData.append('EmailVerificationToken', payload.emailVerificationToken);
    
    payload.documents.forEach((file) => {
      formData.append('documents', file);
    });

    const response = await axiosClient.post<SubmitClaimResponseData>('/auth/recovery/reclaim/submit-claim', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Fetch all claims (admin-only queue)
   */
  getClaims: async (): Promise<ClaimDetailsResponseData[]> => {
    const response = await axiosClient.get<ClaimDetailsResponseData[]>('/auth/recovery/reclaim/claims');
    return response.data;
  },

  /**
   * Review a claim (admin approve / reject)
   */
  reviewClaim: async (claimId: string, status: 'Approved' | 'Rejected', rejectionReason: string | null): Promise<{ success: boolean }> => {
    const response = await axiosClient.post<{ success: boolean }>(`/auth/recovery/reclaim/claims/${claimId}/review`, {
      status,
      rejectionReason,
    });
    return response.data;
  },

  /**
   * Download a claim document as a blob (admin only)
   */
  downloadDocument: async (claimId: string, docId: string): Promise<Blob> => {
    const response = await axiosClient.get(`/auth/recovery/reclaim/claims/${claimId}/document/${docId}`, {
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Verify bootstrap recovery link token
   */
  verifyBootstrap: async (token: string): Promise<VerifyBootstrapResponseData> => {
    const response = await axiosClient.get<VerifyBootstrapResponseData>(`/auth/recovery/reclaim/bootstrap/verify`, {
      params: { token },
    });
    return response.data;
  },

  /**
   * Step 1: Set up new owner password credentials
   */
  setupCredentials: async (payload: SetupRecoveryCredentialsPayload): Promise<SetupRecoveryCredentialsResponseData> => {
    const response = await axiosClient.post<SetupRecoveryCredentialsResponseData>('/auth/recovery/reclaim/bootstrap/setup-credentials', payload);
    return response.data;
  },

  /**
   * Step 2: Confirm strategy and execute clean rebuild / takeover
   */
  executeRecovery: async (payload: ExecuteRecoveryPayload): Promise<LoginResponseData> => {
    const response = await axiosClient.post<LoginResponseData>('/auth/recovery/reclaim/bootstrap/execute', payload);
    return response.data;
  },

  /**
   * Standard Corporate Recovery: Step 1: Request OTP by taxCode (backend-resolved email)
   */
  orgForgot: async (taxCode: string): Promise<{ challengeId: string; maskedEmail: string; cooldownSeconds: number }> => {
    const response = await axiosClient.post<{ challengeId: string; maskedEmail: string; cooldownSeconds: number }>('/auth/recovery/organization/forgot', { taxCode });
    return response.data;
  },

  /**
   * Standard Corporate Recovery: Step 2: Verify OTP
   */
  orgVerifyOtp: async (payload: VerifyOrganizationOtpPayload): Promise<{ verificationToken: string }> => {
    const response = await axiosClient.post<{ verificationToken: string }>('/auth/recovery/organization/verify-otp', payload);
    return response.data;
  },

  /**
   * Standard Corporate Recovery: Step 3: Reset password with token
   */
  orgResetPassword: async (payload: ResetOrganizationPasswordPayload): Promise<LoginResponseData> => {
    const response = await axiosClient.post<LoginResponseData>('/auth/recovery/organization/reset-password', payload);
    return response.data;
  },

  /**
   * Level 2 recovery check
   */
  level2Check: async (taxCode: string): Promise<{ isLevel2: boolean; legalBusinessName: string; taxCode: string; currentRepresentative: string | null; currentEmail: string | null }> => {
    const response = await axiosClient.get<{ isLevel2: boolean; legalBusinessName: string; taxCode: string; currentRepresentative: string | null; currentEmail: string | null }>('/auth/recovery/level2/check', {
      params: { taxCode },
    });
    return response.data;
  },

  /**
   * Submit representative rotation change request for Level 2 organization
   */
  level2RequestRotation: async (payload: {
    taxCode: string;
    newRepresentativeFullName: string;
    newRepresentativePosition: string;
    newRepresentativeEmail: string;
    newRepresentativePhone: string;
    reasonForRepresentativeChange: string;
    optionalSupportingMessage?: string;
  }): Promise<unknown> => {
    const response = await axiosClient.post<unknown>('/auth/recovery/level2/request-rotation', payload);
    return response.data;
  },

  /**
   * Get all rotation requests queue for manual Support review
   */
  level2GetRequests: async (): Promise<unknown[]> => {
    const response = await axiosClient.get<unknown[]>('/auth/recovery/level2/requests');
    return response.data;
  },

  /**
   * Record reviewer verification call details
   */
  level2RecordVerificationCall: async (requestId: string, payload: { notes: string; status: string }): Promise<{ success: boolean }> => {
    const response = await axiosClient.post<{ success: boolean }>(`/auth/recovery/level2/requests/${requestId}/verification-call`, payload);
    return response.data;
  },

  /**
   * CVerify support approval/rejection decision
   */
  level2SupportApproval: async (requestId: string, payload: { decision: string }): Promise<{ success: boolean }> => {
    const response = await axiosClient.post<{ success: boolean }>(`/auth/recovery/level2/requests/${requestId}/support-approval`, payload);
    return response.data;
  },

  /**
   * Existing Admin vote submission
   */
  level2SubmitAdminVote: async (payload: { token: string; decision: string }): Promise<{ success: boolean }> => {
    const response = await axiosClient.post<{ success: boolean }>('/auth/recovery/level2/vote', payload);
    return response.data;
  },

  /**
   * Retrieve representative changes history for auditing
   */
  level2GetHistory: async (organizationId: string): Promise<unknown[]> => {
    const response = await axiosClient.get<unknown[]>(`/auth/recovery/level2/organization/${organizationId}/history`);
    return response.data;
  },
};
