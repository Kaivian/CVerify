using System;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Security;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.Modules.Auth.Services;

/// <summary>
/// Resolves the authentication state for an email identity from database or Redis cache.
/// Provides a single source of truth for all authentication flow decisions.
/// </summary>
public class IdentityStateResolver : IIdentityStateResolver
{
    private readonly ApplicationDbContext _context;
    private readonly ICacheService _cacheService;
    private readonly EnvConfiguration _envConfig;
    private readonly ILogger<IdentityStateResolver> _logger;

    private const string CacheKeyPrefix = "auth:identity-state:";
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(5);

    public IdentityStateResolver(
        ApplicationDbContext context,
        ICacheService cacheService,
        EnvConfiguration envConfig,
        ILogger<IdentityStateResolver> logger)
    {
        _context = context;
        _cacheService = cacheService;
        _envConfig = envConfig;
        _logger = logger;
    }

    public async Task<EmailAuthState> ResolveAsync(string email, CancellationToken cancellationToken = default)
    {
        var normalizedEmail = NormalizeEmail(email);
        var cacheKey = $"{CacheKeyPrefix}{normalizedEmail}";

        var cached = await _cacheService.GetAsync<string>(cacheKey);
        if (cached != null && Enum.TryParse<EmailAuthState>(cached, out var cachedState))
        {
            _logger.LogDebug("Identity state cache hit for {Email}: {State}", normalizedEmail, cachedState);
            return cachedState;
        }

        var state = await ResolveFromDatabaseAsync(normalizedEmail, cancellationToken);

        await _cacheService.SetAsync(cacheKey, state.ToString(), CacheTtl);
        _logger.LogInformation("Identity state resolved for {Email}: {State}", normalizedEmail, state);

        return state;
    }

    public async Task InvalidateCacheAsync(string email)
    {
        var normalizedEmail = NormalizeEmail(email);
        var cacheKey = $"{CacheKeyPrefix}{normalizedEmail}";
        await _cacheService.RemoveAsync(cacheKey);
        _logger.LogDebug("Identity state cache invalidated for {Email}", normalizedEmail);
    }

    private async Task<EmailAuthState> ResolveFromDatabaseAsync(
        string normalizedEmail, CancellationToken cancellationToken)
    {
        var user = await _context.FindUserByVerifiedEmailAsync(normalizedEmail, cancellationToken);

        if (user == null && normalizedEmail.EndsWith("@gmail.com", StringComparison.OrdinalIgnoreCase))
        {
            var fallbackEmail = LegacyEmailCompatibilityHelper.ApplyOldGmailNormalization(normalizedEmail);
            if (fallbackEmail != normalizedEmail)
            {
                user = await _context.FindUserByVerifiedEmailAsync(fallbackEmail, cancellationToken);
            }
        }

        if (user != null)
        {
            await _context.Entry(user).Collection(u => u.AuthProviders).LoadAsync(cancellationToken);
        }

        var superAdminEmail = _envConfig.SuperAdmin.Email;
        bool isSuperAdmin = string.Equals(normalizedEmail, superAdminEmail, StringComparison.OrdinalIgnoreCase);

        if (user == null)
        {
            return EmailAuthState.REQUIRES_ONBOARDING;
        }

        if (user.Status == UserStatus.SUSPENDED ||
            user.Status == UserStatus.BANNED ||
            user.DeletedAt != null)
        {
            if (!isSuperAdmin)
            {
                return EmailAuthState.ACCOUNT_RESTRICTED;
            }
        }

        if (user.Status == UserStatus.EMAIL_VERIFY_PENDING && !isSuperAdmin)
        {
            return EmailAuthState.REQUIRES_VERIFICATION;
        }

        var hasPasswordProvider = !string.IsNullOrEmpty(user.PasswordHash);

        if (hasPasswordProvider)
        {
            return EmailAuthState.REQUIRES_AUTHENTICATION;
        }

        // Account exists (e.g., via Google) but no password provider yet
        return EmailAuthState.REQUIRES_ONBOARDING;
    }

    private static string NormalizeEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email)) return string.Empty;
        return email.Trim().Normalize(NormalizationForm.FormC).ToLowerInvariant();
    }
}
