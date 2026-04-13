namespace CVerify.API.Modules.Shared.Exceptions;

/// <summary>
/// Stable architectural classifications of platform and system errors.
/// </summary>
public enum ErrorCategory
{
    VALIDATION,         // Input parameters failing rules
    AUTHENTICATION,     // Session, credentials, expired tokens
    AUTHORIZATION,      // Role checks, ACLs, org boundary failures
    BUSINESS,           // State machine violations, database constraints
    INFRASTRUCTURE,     // Redis down, rate limiting, connection pooling failures
    NETWORK,            // DNS failures, client offline
    EXTERNAL_SERVICE,   // FastApi, Google SSO, SMTP down/timeouts
    UNKNOWN             // System crashed or unhandled exception
}
