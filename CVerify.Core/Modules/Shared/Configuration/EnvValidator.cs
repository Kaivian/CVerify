using System;
using Microsoft.Extensions.Configuration;

namespace CVerify.API.Modules.Shared.Configuration;

public static class EnvValidator
{
    public static EnvConfiguration Validate(IConfiguration configuration)
    {
        var config = new EnvConfiguration();

        // 1. Database
        config.Database.ConnectionString = configuration.GetConnectionString("DefaultConnection")?.ResolveEnvironmentVariables()
            ?? throw new InvalidOperationException("Environment variable 'DATABASE_URL' is missing or connection string 'DefaultConnection' is not configured.");

        if (bool.TryParse(configuration["Database:EnableSqlLogging"] ?? configuration["ENABLE_SQL_LOGGING"], out var enableSql))
        {
            config.Database.EnableSqlLogging = enableSql;
        }

        if (int.TryParse(configuration["Database:SlowQueryThresholdMs"] ?? configuration["SLOW_QUERY_THRESHOLD_MS"], out var slowThreshold))
        {
            config.Database.SlowQueryThresholdMs = slowThreshold;
        }

        // 2. Redis
        config.Redis.ConnectionString = configuration.GetConnectionString("Redis")?.ResolveEnvironmentVariables()
            ?? throw new InvalidOperationException("Environment variable 'REDIS_URL' is missing or connection string 'Redis' is not configured.");

        // 3. JWT
        config.Jwt.Key = configuration["Jwt:Key"]?.ResolveEnvironmentVariables() ?? throw new InvalidOperationException("Environment variable 'JWT_KEY' is missing.");
        config.Jwt.Issuer = configuration["Jwt:Issuer"]?.ResolveEnvironmentVariables() ?? throw new InvalidOperationException("Environment variable 'JWT_ISSUER' is missing.");
        config.Jwt.Audience = configuration["Jwt:Audience"]?.ResolveEnvironmentVariables() ?? throw new InvalidOperationException("Environment variable 'JWT_AUDIENCE' is missing.");
        
        if (int.TryParse(configuration["Jwt:DurationInMinutes"], out var duration))
        {
            config.Jwt.DurationInMinutes = duration;
        }

        // 4. AuthSettings
        if (int.TryParse(configuration["Auth:VerificationTokenDurationInHours"], out var vtHours))
        {
            config.Auth.VerificationTokenDurationInHours = vtHours;
        }
        if (int.TryParse(configuration["Auth:ResetPasswordTokenDurationInMinutes"], out var rpMinutes))
        {
            config.Auth.ResetPasswordTokenDurationInMinutes = rpMinutes;
        }
        config.Auth.FrontendUrl = (configuration["Auth:FrontendUrl"] ?? configuration["FRONTEND_URL"])?.ResolveEnvironmentVariables()?.Trim('"') ?? config.Auth.FrontendUrl;
        config.Auth.BackendUrl = (configuration["Auth:BackendUrl"] ?? configuration["BACKEND_URL"])?.ResolveEnvironmentVariables()?.Trim('"');
        config.Auth.TrustedDomains = configuration["Auth:TrustedDomains"] ?? config.Auth.TrustedDomains;
        config.Auth.GoogleClientId = (configuration["Auth:GoogleClientId"] ?? configuration["GOOGLE_CLIENT_ID"])?.ResolveEnvironmentVariables()?.Trim('"')
            ?? throw new InvalidOperationException("Environment variable 'GOOGLE_CLIENT_ID' or setting 'Auth:GoogleClientId' is missing.");
        
        config.Auth.GoogleClientSecret = (configuration["Auth:GoogleClientSecret"] ?? configuration["GOOGLE_CLIENT_SECRET"])?.ResolveEnvironmentVariables()?.Trim('"');
        config.Auth.GithubClientId = (configuration["Auth:GithubClientId"] ?? configuration["GITHUB_CLIENT_ID"])?.ResolveEnvironmentVariables()?.Trim('"');
        config.Auth.GithubClientSecret = (configuration["Auth:GithubClientSecret"] ?? configuration["GITHUB_CLIENT_SECRET"])?.ResolveEnvironmentVariables()?.Trim('"');
        config.Auth.GitlabClientId = (configuration["Auth:GitlabClientId"] ?? configuration["GITLAB_CLIENT_ID"])?.ResolveEnvironmentVariables()?.Trim('"');
        config.Auth.GitlabClientSecret = (configuration["Auth:GitlabClientSecret"] ?? configuration["GITLAB_CLIENT_SECRET"])?.ResolveEnvironmentVariables()?.Trim('"');

        if (bool.TryParse(configuration["Auth:DisableCsrf"], out var disableCsrf))
        {
            config.Auth.DisableCsrf = disableCsrf;
        }

        // 5. AuthRateLimitSettings
        if (int.TryParse(configuration["RateLimit:ForgotPasswordPermitLimit"], out var fpLimit))
            config.RateLimit.ForgotPasswordPermitLimit = fpLimit;
        if (int.TryParse(configuration["RateLimit:ForgotPasswordWindowMinutes"], out var fpWindow))
            config.RateLimit.ForgotPasswordWindowMinutes = fpWindow;

        if (int.TryParse(configuration["RateLimit:ResetPasswordPermitLimit"], out var rpLimit))
            config.RateLimit.ResetPasswordPermitLimit = rpLimit;
        if (int.TryParse(configuration["RateLimit:ResetPasswordWindowMinutes"], out var rpWindow))
            config.RateLimit.ResetPasswordWindowMinutes = rpWindow;

        if (int.TryParse(configuration["RateLimit:ResendVerificationPermitLimit"], out var rvLimit))
            config.RateLimit.ResendVerificationPermitLimit = rvLimit;
        if (int.TryParse(configuration["RateLimit:ResendVerificationWindowMinutes"], out var rvWindow))
            config.RateLimit.ResendVerificationWindowMinutes = rvWindow;

        if (int.TryParse(configuration["RateLimit:VerifyEmailPermitLimit"], out var veLimit))
            config.RateLimit.VerifyEmailPermitLimit = veLimit;
        if (int.TryParse(configuration["RateLimit:VerifyEmailWindowMinutes"], out var veWindow))
            config.RateLimit.VerifyEmailWindowMinutes = veWindow;

        if (int.TryParse(configuration["RateLimit:RegisterPermitLimit"], out var regLimit))
            config.RateLimit.RegisterPermitLimit = regLimit;
        if (int.TryParse(configuration["RateLimit:RegisterWindowMinutes"], out var regWindow))
            config.RateLimit.RegisterWindowMinutes = regWindow;

        // 6. AI Microservice Settings
        config.Ai.FastApiBaseUrl = (configuration["Ai:FastApiBaseUrl"] ?? configuration["AI_SERVICE_URL"])?.ResolveEnvironmentVariables()?.Trim('"') ?? config.Ai.FastApiBaseUrl;
        config.Ai.SharedSecret = (configuration["Ai:SharedSecret"] ?? configuration["AI_SERVICE_SHARED_SECRET"])?.ResolveEnvironmentVariables()?.Trim('"')
            ?? throw new InvalidOperationException("Environment variable 'AI_SERVICE_SHARED_SECRET' or setting 'Ai:SharedSecret' is missing.");
        config.Ai.ClientId = (configuration["Ai:ClientId"] ?? configuration["AI_SERVICE_CLIENT_ID"])?.ResolveEnvironmentVariables()?.Trim('"') ?? config.Ai.ClientId;
        config.Ai.ClaudeModel = (configuration["Ai:ClaudeModel"] ?? configuration["CLAUDE_MODEL"])?.ResolveEnvironmentVariables()?.Trim('"') ?? config.Ai.ClaudeModel;

        // 7. Super Admin Settings
        config.SuperAdmin.Email = (configuration["SuperAdmin:Email"] ?? configuration["SUPER_ADMIN_EMAIL"])?.ResolveEnvironmentVariables()?.Trim('"') ?? config.SuperAdmin.Email;

        // 8. Cloudflare R2 Settings
        config.R2.AccessKeyId = (configuration["R2:AccessKeyId"] ?? configuration["ACCESS_KEY_ID"])?.ResolveEnvironmentVariables()?.Trim('"')
            ?? throw new InvalidOperationException("Environment variable 'ACCESS_KEY_ID' or setting 'R2:AccessKeyId' is missing.");
        config.R2.SecretAccessKey = (configuration["R2:SecretAccessKey"] ?? configuration["SECRET_ACCESS_KEY"])?.ResolveEnvironmentVariables()?.Trim('"')
            ?? throw new InvalidOperationException("Environment variable 'SECRET_ACCESS_KEY' or setting 'R2:SecretAccessKey' is missing.");
        config.R2.Endpoint = (configuration["R2:Endpoint"] ?? configuration["R2_ENDPOINT"])?.ResolveEnvironmentVariables()?.Trim('"')
            ?? throw new InvalidOperationException("Environment variable 'R2_ENDPOINT' or setting 'R2:Endpoint' is missing.");
        config.R2.BucketName = (configuration["R2:BucketName"] ?? configuration["R2_BUCKET"])?.ResolveEnvironmentVariables()?.Trim('"')
            ?? throw new InvalidOperationException("Environment variable 'R2_BUCKET' or setting 'R2:BucketName' is missing.");

        // 9. Security Settings
        if (bool.TryParse(configuration["Security:DisableRateLimits"] ?? configuration["DISABLE_RATE_LIMITS"], out var disableRL))
        {
            config.Security.DisableRateLimits = disableRL;
        }

        config.Security.TokenEncryptionKey = (configuration["Security:TokenEncryptionKey"] ?? configuration["TOKEN_ENCRYPTION_KEY"])?.ResolveEnvironmentVariables()?.Trim('"');

        return config;
    }
}

