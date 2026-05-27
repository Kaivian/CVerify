import { type ApiError } from '@/types/api.types';
import { useErrorLifecycle } from '@/stores/use-error-lifecycle';
import { NotificationHub } from '../notifications/orchestrator';
import i18n from '@/lib/i18n';

/** Checks whether a dynamic (backend-provided) key exists in the loaded i18n resources. */
function i18nKeyExists(key: string): boolean {
  return (i18n.exists as (key: string) => boolean)(key);
}

/** Resolves a dynamic (backend-provided) key against the loaded i18n resources. */
function i18nResolve(key: string, fallback?: string): string {
  return (i18n.t as (key: string, defaultValue?: string) => string)(key, fallback);
}

export interface InterpretationOptions {
  /** If true, validation errors are handled silently inline by forms, avoiding generic toast popups */
  silentValidation?: boolean;
  /** Custom fallback message if local translations cannot resolve messageKey */
  fallbackMessage?: string;
  /** Optional custom recovery retry action */
  onRetry?: () => void;
}

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
    if (error.messageKey && i18nKeyExists(error.messageKey)) {
      resolvedDescription = i18nResolve(error.messageKey);
    } else {
      // Fallback category localization mapping
      const categoryKey = `system.toast.category.${error.category.toLowerCase()}`;
      resolvedDescription = i18nKeyExists(categoryKey)
        ? i18nResolve(categoryKey)
        : (error.message || fallbackMessage || 'An unexpected action failure occurred.');
    }

    // Append Correlation ID directly to system exceptions to help developers search private logs
    const correlationSuffix = isSystemError 
      ? ` [Ref: ${correlationId}]`
      : '';

    const title = isSystemError 
      ? i18n.t('auth.toast.requestFailedTitle', 'System Outage')
      : i18n.t('auth.toast.requestFailedTitle', 'Action Failed');

    // 5. Stage 3 & Dispatch: RENDERED
    useErrorLifecycle.getState().transition(correlationId, 'RENDERED', error.code, error.category);

    NotificationHub.dispatch({
      category: notificationCategory,
      title,
      description: `${resolvedDescription}${correlationSuffix}`,
      action: error.retryable && options.onRetry
        ? {
            label: i18n.t('auth.toast.retry', 'Retry'),
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
