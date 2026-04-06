using System.Collections.Generic;

namespace CVerify.API.Application.Exceptions.Catalogs;

public static class AuthErrorCatalog
{
    public static readonly Dictionary<string, ErrorDefinition> Definitions = new()
    {
        {
            AuthErrorCodes.InvalidCredentials,
            new(AuthErrorCodes.InvalidCredentials, ErrorCategory.AUTHENTICATION, "auth.toast.verifiedFailedDesc", "Incorrect email or password.")
        },
        {
            AuthErrorCodes.EmailAlreadyExists,
            new(AuthErrorCodes.EmailAlreadyExists, ErrorCategory.AUTHENTICATION, "auth.toast.accountAlreadyExistsDesc", "This email address is already registered.")
        },
        {
            AuthErrorCodes.ExpiredToken,
            new(AuthErrorCodes.ExpiredToken, ErrorCategory.AUTHENTICATION, "auth.toast.verifiedFailedDesc", "The authentication token has expired.")
        },
        {
            AuthErrorCodes.InvalidToken,
            new(AuthErrorCodes.InvalidToken, ErrorCategory.AUTHENTICATION, "auth.toast.tokenMissingDesc", "The security token is missing or invalid.")
        },
        {
            AuthErrorCodes.TokenAlreadyConsumed,
            new(AuthErrorCodes.TokenAlreadyConsumed, ErrorCategory.AUTHENTICATION, "auth.toast.verifiedFailedDesc", "This security token has already been consumed.")
        },
        {
            AuthErrorCodes.PasswordTooWeak,
            new(AuthErrorCodes.PasswordTooWeak, ErrorCategory.VALIDATION, "auth.validation.passwordStrength", "Password does not meet complexity requirements.")
        },
        {
            AuthErrorCodes.PasswordPolicyViolation,
            new(AuthErrorCodes.PasswordPolicyViolation, ErrorCategory.VALIDATION, "auth.validation.password_policy_failed", "Password does not satisfy the enterprise policy requirements.")
        },
        {
            AuthErrorCodes.PasswordsDoNotMatch,
            new(AuthErrorCodes.PasswordsDoNotMatch, ErrorCategory.VALIDATION, "auth.validation.passwordsMismatch", "Passwords do not match.")
        },
        {
            AuthErrorCodes.LockedOut,
            new(AuthErrorCodes.LockedOut, ErrorCategory.AUTHENTICATION, "auth.toast.authAlertAccountLocked", "Account is locked out due to too many failed attempts.")
        },
        {
            AuthErrorCodes.CooldownActive,
            new(AuthErrorCodes.CooldownActive, ErrorCategory.AUTHENTICATION, "auth.toast.rateLimitDesc", "Rate limit active. Please try again later.", true, "Warning")
        },
        {
            AuthErrorCodes.Unauthorized,
            new(AuthErrorCodes.Unauthorized, ErrorCategory.AUTHENTICATION, "auth.toast.sessionExpiredDesc", "Unauthorized access. Please log in again.")
        },
        {
            AuthErrorCodes.UntrustedRedirect,
            new(AuthErrorCodes.UntrustedRedirect, ErrorCategory.AUTHORIZATION, "auth.toast.requestFailedDesc", "Redirect URL is not trusted.")
        },
        {
            AuthErrorCodes.SuspiciousActivity,
            new(AuthErrorCodes.SuspiciousActivity, ErrorCategory.AUTHENTICATION, "auth.toast.requestFailedDesc", "Suspicious activity detected. Action aborted.")
        },
        {
            AuthErrorCodes.MaxAttemptsReached,
            new(AuthErrorCodes.MaxAttemptsReached, ErrorCategory.AUTHENTICATION, "auth.toast.rateLimitDesc", "Maximum attempts reached. Please reset your password.", false, "Warning")
        }
    };
}
