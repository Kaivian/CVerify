/**
 * Maps raw backend/API exception codes to user-friendly English messages.
 * 
 * @param errorCode - The server-side error code (e.g. 'INVALID_CREDENTIALS').
 * @param t - Optional translation function (unused, kept for signature compatibility).
 * @param params - Optional variables for interpolation within the message.
 */
export function getLocalizedErrorMessage(
  errorCode: string | null | undefined,
  t?: (key: string, options?: any) => string,
  params?: Record<string, any>
): string {
  if (!errorCode) {
    return "An unknown error occurred. Please try again later.";
  }

  const errors: Record<string, string> = {
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
    BRUTE_FORCE_LOCKED: "Account locked temporarily. Please try again.",
    EMAIL_ALREADY_EXISTS: "This email is already associated with an active traveler profile.",
    VALIDATION_ERROR: "Input formats failed standard verification schemas.",
  };

  const matchedCode = errors[errorCode] ? errorCode : 'UNKNOWN_ERROR';
  let message = errors[matchedCode];

  if (errorCode === 'BRUTE_FORCE_LOCKED' && params && typeof params.count !== 'undefined') {
    message = `Account locked temporarily. Please try again in ${params.count}s.`;
  }

  return message;
}

