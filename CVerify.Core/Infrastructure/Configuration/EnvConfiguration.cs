namespace CVerify.API.Infrastructure.Configuration;

public class EnvConfiguration
{
    public DatabaseSettings Database { get; set; } = new();
    public RedisSettings Redis { get; set; } = new();
    public JwtSettings Jwt { get; set; } = new();
    public AuthSettings Auth { get; set; } = new();
    public AuthRateLimitSettings RateLimit { get; set; } = new();
    public AiSettings Ai { get; set; } = new();
    public SuperAdminSettings SuperAdmin { get; set; } = new();
    public CloudflareR2Settings R2 { get; set; } = new();
    public SecuritySettings Security { get; set; } = new();
}

public class SecuritySettings
{
    public bool DisableRateLimits { get; set; } = false;
    public string? TokenEncryptionKey { get; set; }
}


public class DatabaseSettings
{
    public string ConnectionString { get; set; } = null!;
    public bool EnableSqlLogging { get; set; } = false;
    public int SlowQueryThresholdMs { get; set; } = 250;
}

public class RedisSettings
{
    public string ConnectionString { get; set; } = null!;
}

public class JwtSettings
{
    public string Key { get; set; } = null!;
    public string Issuer { get; set; } = null!;
    public string Audience { get; set; } = null!;
    public int DurationInMinutes { get; set; } = 60;
}

public class AuthSettings
{
    public int VerificationTokenDurationInHours { get; set; } = 24;
    public int ResetPasswordTokenDurationInMinutes { get; set; } = 30;
    public string FrontendUrl { get; set; } = "http://localhost:3000";
    public string? BackendUrl { get; set; }
    public string ResetPasswordUrlFormat => $"{FrontendUrl.TrimEnd('/')}/reset-password?token={{token}}";
    public string VerifyEmailUrlFormat => $"{FrontendUrl.TrimEnd('/')}/verify-email?token={{token}}";
    public string TrustedDomains { get; set; } = "cverify.ai;localhost;127.0.0.1";
    public string GoogleClientId { get; set; } = null!;
    public string? GoogleClientSecret { get; set; }
    public string? GithubClientId { get; set; }
    public string? GithubClientSecret { get; set; }
    public string? GitlabClientId { get; set; }
    public string? GitlabClientSecret { get; set; }
    public bool DisableCsrf { get; set; } = false;
}

public class AuthRateLimitSettings
{
    public int ForgotPasswordPermitLimit { get; set; } = 3;
    public int ForgotPasswordWindowMinutes { get; set; } = 15;
    
    public int ResetPasswordPermitLimit { get; set; } = 5;
    public int ResetPasswordWindowMinutes { get; set; } = 15;

    public int ResendVerificationPermitLimit { get; set; } = 3;
    public int ResendVerificationWindowMinutes { get; set; } = 5;

    public int VerifyEmailPermitLimit { get; set; } = 10;
    public int VerifyEmailWindowMinutes { get; set; } = 5;

    public int RegisterPermitLimit { get; set; } = 5;
    public int RegisterWindowMinutes { get; set; } = 15;
}

public class AiSettings
{
    public string FastApiBaseUrl { get; set; } = "http://localhost:8000";
    public string SharedSecret { get; set; } = null!;
    public string ClientId { get; set; } = "cverify-core";
    public string ClaudeModel { get; set; } = "claude-sonnet-4-6";
}

public class SuperAdminSettings
{
    public string Email { get; set; } = "admin@system.com";
}

public class CloudflareR2Settings
{
    public string AccessKeyId { get; set; } = null!;
    public string SecretAccessKey { get; set; } = null!;
    public string Endpoint { get; set; } = null!;
    public string BucketName { get; set; } = null!;
}
