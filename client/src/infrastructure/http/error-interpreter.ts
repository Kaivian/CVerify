import { type ApiError } from '@/types/api.types';
import { useErrorLifecycle } from '@/stores/use-error-lifecycle';
import { NotificationHub } from '../notifications/orchestrator';

export interface InterpretationOptions {
  /** If true, validation errors are handled silently inline by forms, avoiding generic toast popups */
  silentValidation?: boolean;
  /** Custom fallback message if local translations cannot resolve messageKey */
  fallbackMessage?: string;
  /** Optional custom recovery retry action */
  onRetry?: () => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  UNKNOWN_ERROR: "An unknown error occurred. Please try again later.",
  NETWORK_ERROR: "Could not connect to server. Please check your internet connection.",
  UNAUTHORIZED: "You are unauthorized to access this. Please sign in again.",
  FORBIDDEN: "You are forbidden from performing this operational query.",
  NOT_FOUND: "The requested resource could not be found.",
  BAD_REQUEST: "Invalid request inputs.",
  SERVER_ERROR: "System server exception occurred. Core engineering team alerted.",
  RATE_LIMIT_EXCEEDED: "Too many requests. Please try again in a few minutes.",
  AUTH_EXPIRED_TOKEN: "The authorization token has expired. Please request a new link.",
  INVALID_CREDENTIALS: "The email or password details are incorrect.",
  BRUTE_FORCE_LOCKED: "Account locked temporarily.",
  EMAIL_ALREADY_EXISTS: "This email is already associated with an active traveler profile.",
  VALIDATION_ERROR: "Input formats failed standard verification schemas."
};

/**
 * Enterprise-grade Frontend Error Interpretation Layer.
 * Decouples public visual copy entirely from exception variables, manages state machines,
 * executes UX resolution strategies, and dispatches intents to abstract notification layers.
 */
export const ErrorInterpreter = {
  interpret(error: ApiError, options: InterpretationOptions = {}) {
    const { silentValidation = true, fallbackMessage } = options;
    const correlationId = error.correlationId || `err_${Date.now()}`;

    // 1. Stage 1 & 2: Machine received and starts parsing
    useErrorLifecycle.getState().transition(correlationId, 'RECEIVED', error.code, error.category);
    useErrorLifecycle.getState().transition(correlationId, 'INTERPRETED', error.code, error.category);

    // 2. Silent Validation Rule: Inline fields take absolute priority to prevent toast spam
    if (error.category === 'VALIDATION' && silentValidation) {
      useErrorLifecycle.getState().transition(correlationId, 'RESOLVED', error.code, error.category);
      return;
    }

    // 3. Resolve display severity and visual groupings
    const isSystemError = 
      error.category === 'UNKNOWN' || 
      error.category === 'INFRASTRUCTURE' || 
      error.category === 'NETWORK' ||
      (error.status && error.status >= 500);

    const categoryMap: Record<string, 'success' | 'warning' | 'info' | 'error'> = {
      'VALIDATION': 'error',
      'AUTHENTICATION': 'error',
      'AUTHORIZATION': 'error',
      'BUSINESS': 'error',
      'INFRASTRUCTURE': 'error',
      'NETWORK': 'warning',
      'EXTERNAL_SERVICE': 'error',
      'UNKNOWN': 'error'
    };

    const notificationCategory = categoryMap[error.category] || 'error';

    // 4. Fully Owning Copy: Prioritize messageKey, fall back to localized category defaults
    let resolvedDescription = '';
    if (error.messageKey && ERROR_MESSAGES[error.messageKey]) {
      resolvedDescription = ERROR_MESSAGES[error.messageKey];
    } else {
      resolvedDescription = error.message || fallbackMessage || 'An unexpected action failure occurred.';
    }

    // Append Correlation ID directly to system exceptions to help developers search private logs
    const correlationSuffix = isSystemError 
      ? ` [Ref: ${correlationId}]`
      : '';

    const title = isSystemError 
      ? 'System Outage'
      : 'Action Failed';

    // 5. Stage 3 & Dispatch: RENDERED
    useErrorLifecycle.getState().transition(correlationId, 'RENDERED', error.code, error.category);

    NotificationHub.dispatch({
      category: notificationCategory,
      title,
      description: `${resolvedDescription}${correlationSuffix}`,
      action: error.retryable && options.onRetry
        ? {
            label: 'Retry',
            onPress: () => {
              useErrorLifecycle.getState().incrementRetry(correlationId);
              useErrorLifecycle.getState().transition(correlationId, 'RETRIED', error.code, error.category);
              options.onRetry?.();
            }
          }
        : undefined,
    });

    // 6. Execute UX Semantics Resolution Strategy (Redirects, verification triggers)
    if (error.uxSemantics && error.uxSemantics.resolutionStrategy === 'Redirect' && error.uxSemantics.targetPath) {
      console.log(`[Error Interpreter] Executing resolution redirect to: ${error.uxSemantics.targetPath}`);
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.href = error.uxSemantics.targetPath;
        }
      }, 1500);
    }
  }
};
