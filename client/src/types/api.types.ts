export interface UxSemantics {
  displayMode: 'Toast' | 'Banner' | 'Inline' | 'Silent';
  resolutionStrategy: 'Retry' | 'Redirect' | 'VerifyEmail' | 'ResetPassword' | 'None';
  userAction: string;
  targetPath: string;
}

/**
/// Enterprise standardized versioned API error contract.
/// Fully matches the backend CVerify reliability contract.
 */
export interface ApiError {
  contractVersion: string;
  status: number;
  code: string;
  category: string;
  severity: 'Info' | 'Warning' | 'Error';
  messageKey: string;
  message: string; // Sanitized developer safe message (fallback only)
  retryable: boolean;
  errors?: Record<string, string[]>; // Field-level validation metadata
  correlationId?: string;
  timestamp: string;
  uxSemantics: UxSemantics;
  details?: Record<string, unknown>;
  
  // Backward compatibility fields
  remainingAttempts?: number;
  cooldownSeconds?: number;
}

/**
 * Generic paginated API response wrapper.
 * Used by admin and list endpoints.
 */
export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}
