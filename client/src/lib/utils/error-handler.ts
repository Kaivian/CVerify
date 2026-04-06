/**
 * Maps raw backend/API exception codes to user-friendly, localized translation entries.
 * 
 * @param errorCode - The server-side error code (e.g. 'INVALID_CREDENTIALS').
 * @param t - The active translation function (e.g., from useTranslation('errors')).
 * @param params - Optional variables for interpolation within the translation string (e.g., count).
 */
export function getLocalizedErrorMessage(
  errorCode: string | null | undefined,
  t: (key: string, options?: unknown) => string,
  params?: Record<string, unknown>
): string {
  if (!errorCode) {
    return t('errors:UNKNOWN_ERROR');
  }

  // Supported backend API error keys in CVerify
  const supportedErrorCodes = [
    'UNKNOWN_ERROR',
    'NETWORK_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'BAD_REQUEST',
    'SERVER_ERROR',
    'RATE_LIMIT_EXCEEDED',
    'AUTH_EXPIRED_TOKEN',
    'INVALID_CREDENTIALS',
    'BRUTE_FORCE_LOCKED',
    'EMAIL_ALREADY_EXISTS',
    'VALIDATION_ERROR',
  ];

  const matchedCode = supportedErrorCodes.includes(errorCode)
    ? errorCode
    : 'UNKNOWN_ERROR';

  return t(`errors:${matchedCode}`, params);
}
