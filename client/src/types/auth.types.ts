export type UserRole = 'USER' | 'BUSINESS' | 'ADMIN';

// Scalable permission string format: 'resource:action' (e.g., 'bookings:create', 'admin:users:manage')
export type ResourceActionPermission = `${string}:${string}`;

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  permissions: ResourceActionPermission[];
  avatarUrl?: string;
  isEmailVerified?: boolean;
  passwordChangedAt?: string;
}

export type BootstrapState = 'IDLE' | 'BOOTSTRAPPING' | 'VALIDATING' | 'READY';

export interface AuthSession {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  bootstrapState: BootstrapState;
}

// Enterprise standardized API error container
export interface ApiError {
  code: string; // E.g., 'AUTH_INVALID_CREDENTIALS', 'RATE_LIMIT_EXCEEDED', 'ACCOUNT_LOCKED'
  message: string;
  status?: number; // HTTP status code
  errors?: Record<string, string[]>; // Form validation errors (e.g., email: ['Invalid email format'])
  remainingAttempts?: number; // Lockout mitigation
  cooldownSeconds?: number; // Rate-limit countdown remaining
}

export interface LoginResponseData {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  roles: string[];
  permissions: ResourceActionPermission[];
  isEmailVerified: boolean;
  status: string;
  nextStep: string;
  passwordChangedAt?: string;
}

export interface UserProfileResponseData {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  roles: string[];
  permissions: ResourceActionPermission[];
  isEmailVerified: boolean;
  status: string;
  nextStep: string;
  passwordChangedAt?: string;
}

export interface AuthSuccessResponse {
  message: string;
  statusCode?: string;
  uiAction?: string;
}

export interface SendOtpResponseData {
  challengeId: string;
  email: string;
  cooldownSeconds: number;
}

export interface VerifyOtpResponseData {
  challengeId: string;
  email: string;
  verificationToken: string;
}

export interface OtpSessionResponseData {
  hasActiveOtp: boolean;
  challengeId: string | null;
  purpose: string;
  expiresAt: string | null;
  cooldownUntil: string | null;
  maskedEmail: string;
  status: string;
}

export interface VerifyCompanyLinkResponseData {
  companyName: string;
  taxCode: string;
  companyEmail: string;
  verificationToken: string;
}

export interface SessionInfoData {
  sessionId: string;
  deviceName?: string;
  userAgent?: string;
  ipAddress?: string;
  createdAt: string;
  lastUsedAt: string;
  isCurrent: boolean;
}

export type EmailAuthState =
  | 'REQUIRES_ONBOARDING'
  | 'REQUIRES_AUTHENTICATION'
  | 'REQUIRES_VERIFICATION'
  | 'ACCOUNT_RESTRICTED';

export interface ResolveEmailAuthStateResponseData {
  authState: EmailAuthState;
}

export interface LinkedEmail {
  id: string;
  email: string;
  isPrimary: boolean;
  isVerified: boolean;
}


