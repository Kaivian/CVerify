using System;

namespace CVerify.API.Modules.Shared.Exceptions;

public class AuthException : AuthenticationException
{
    public string Code => ErrorCode;

    public AuthException(string code, string message) 
        : base(code, message)
    {
    }

    public AuthException(string code, string message, Exception innerException) 
        : base(code, message, innerException)
    {
    }
}

public static class AuthErrorCodes
{
    public const string EmailAlreadyExists = "AUTH_EMAIL_ALREADY_EXISTS";
    public const string AccountConflict = "AUTH_ACCOUNT_CONFLICT";
    public const string InvalidToken = "AUTH_INVALID_TOKEN";
    public const string InvalidOtp = "AUTH_INVALID_OTP";
    public const string ExpiredToken = "AUTH_EXPIRED_TOKEN";
    public const string TokenAlreadyConsumed = "AUTH_TOKEN_ALREADY_CONSUMED";
    public const string PasswordTooWeak = "AUTH_PASSWORD_TOO_WEAK";
    public const string PasswordPolicyViolation = "AUTH_PASSWORD_POLICY_VIOLATION";
    public const string PasswordsDoNotMatch = "AUTH_PASSWORDS_DO_NOT_MATCH";
    public const string InvalidCredentials = "AUTH_INVALID_CREDENTIALS";
    public const string LockedOut = "AUTH_LOCKED_OUT";
    public const string CooldownActive = "AUTH_COOLDOWN_ACTIVE";
    public const string Unauthorized = "AUTH_UNAUTHORIZED";
    public const string UntrustedRedirect = "AUTH_UNTRUSTED_REDIRECT";
    public const string SuspiciousActivity = "AUTH_SUSPICIOUS_ACTIVITY";
    public const string MaxAttemptsReached = "AUTH_MAX_ATTEMPTS_REACHED";
    public const string RateLimitExceeded = "AUTH_RATE_LIMIT_EXCEEDED";
    public const string ConcurrencyConflict = "AUTH_CONCURRENCY_CONFLICT";
    public const string TooManyResends = "AUTH_TOO_MANY_RESENDS";
    public const string ServiceUnavailable = "AUTH_SERVICE_UNAVAILABLE";
}
