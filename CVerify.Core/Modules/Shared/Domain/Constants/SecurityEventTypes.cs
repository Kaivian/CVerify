namespace CVerify.API.Modules.Shared.Domain.Constants;

public static class SecurityEventTypes
{
    // Authentication
    public const string AuthLoginSuccess = "AUTH_LOGIN_SUCCESS";
    public const string AuthLoginFailed = "AUTH_LOGIN_FAILED";
    public const string AuthLoginBruteForce = "AUTH_LOGIN_BRUTE_FORCE";
    public const string AuthMfaFailed = "AUTH_MFA_FAILED";
    public const string AuthTokenAbuse = "AUTH_TOKEN_ABUSE";
    public const string AuthConcurrentLogins = "AUTH_CONCURRENT_LOGINS";

    // Session
    public const string SessionCreated = "SESSION_CREATED";
    public const string SessionExpired = "SESSION_EXPIRED";
    public const string SessionRevoked = "SESSION_REVOKED";
    public const string SessionImpossibleTravel = "SESSION_IMPOSSIBLE_TRAVEL";
    public const string SessionSuspiciousOrigin = "SESSION_SUSPICIOUS_ORIGIN";

    // OAuth
    public const string OAuthLinkSuccess = "OAUTH_LINK_SUCCESS";
    public const string OAuthUnlinkSuccess = "OAUTH_UNLINK_SUCCESS";
    public const string OAuthFailure = "OAUTH_FAILURE";
    public const string OAuthTokenExpired = "OAUTH_TOKEN_EXPIRED";

    // Repository
    public const string RepoLinked = "REPO_LINKED";
    public const string RepoRemoved = "REPO_REMOVED";
    public const string RepoVisibilityChanged = "REPO_VISIBILITY_CHANGED";
    public const string RepoSyncFailure = "REPO_SYNC_FAILURE";
    public const string RepoUnauthorizedAccess = "REPO_UNAUTHORIZED_ACCESS";

    // Administrative
    public const string AdminUserRoleChanged = "ADMIN_USER_ROLE_CHANGED";
    public const string AdminPermissionChanged = "ADMIN_PERMISSION_CHANGED";
    public const string AdminUserSuspended = "ADMIN_USER_SUSPENDED";
    public const string AdminUserActivated = "ADMIN_USER_ACTIVATED";
    public const string AdminImpersonationStart = "ADMIN_IMPERSONATION_START";

    // API Security
    public const string ApiRateLimitExceeded = "API_RATE_LIMIT_EXCEEDED";
    public const string ApiInjectionAttempt = "API_INJECTION_ATTEMPT";
    public const string ApiUnauthorizedEndpoint = "API_UNAUTHORIZED_ENDPOINT";
    public const string ApiValidationFailure = "API_VALIDATION_FAILURE";

    // Infrastructure
    public const string InfraDbConnectionLost = "INFRA_DB_CONNECTION_LOST";
    public const string InfraRedisFailure = "INFRA_REDIS_FAILURE";
    public const string InfraBackgroundJobFailed = "INFRA_BACKGROUND_JOB_FAILED";

    // AI Security
    public const string AiCostLimitExceeded = "AI_COST_LIMIT_EXCEEDED";
    public const string AiPromptInjection = "AI_PROMPT_INJECTION";
    public const string AiTimeoutOrFailure = "AI_TIMEOUT_OR_FAILURE";

    // Organization
    public const string OrgInvitationAbuse = "ORG_INVITATION_ABUSE";
    public const string OrgOwnershipChanged = "ORG_OWNERSHIP_CHANGED";
}
