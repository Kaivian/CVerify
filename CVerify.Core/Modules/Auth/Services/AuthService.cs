using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using Polly;
using Polly.Retry;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Google.Apis.Auth;
using CVerify.API.Modules.Auth.DTOs;
using CVerify.API.Modules.Auth.Entities;
using CVerify.API.Modules.Auth.Enums;
using CVerify.API.Modules.Auth.Services.OtpPolicies;
using CVerify.API.Modules.Auth.Services.PasswordPolicies;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.Diagnostics;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Email.Entities;
using CVerify.API.Modules.Shared.Exceptions;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Security;
using CVerify.API.Modules.Shared.Storage.Interfaces;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.Modules.Auth.Services;

/// <summary>
/// Orchestrates advanced authentication flows including register, login, verification, and password recovery.
/// </summary>
public class AuthService : IAuthService
{
    private static readonly Dictionary<string, string> CanonicalProviders = new(StringComparer.OrdinalIgnoreCase)
    {
        { "github", "github" },
        { "gitlab", "gitlab" },
        { "google", "google" }
    };

    private readonly ApplicationDbContext _context;
    private readonly ITokenService _tokenService;
    private readonly ICacheService _cacheService;
    private readonly IAccountService _accountService;
    private readonly IIdentityRepository _identityRepository;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly EnvConfiguration _envConfig;
    private readonly ILogger<AuthService> _logger;
    private readonly AuthMetrics _metrics;
    private readonly TimeProvider _timeProvider;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IIdentityStateResolver _identityStateResolver;
    private readonly IPasswordPolicyService _passwordPolicyService;
    private readonly IOtpPolicyService _otpPolicyService;
    private readonly IStorageService _storageService;
    private readonly IRateLimitPolicyService _rateLimitPolicyService;
    private readonly IGoogleTokenValidator _googleTokenValidator;
    private readonly IUsernameService _usernameService;
    private readonly IWorkspaceMembershipService _workspaceMembershipService;
 
    public AuthService(
        ApplicationDbContext context,
        ITokenService tokenService,
        ICacheService cacheService,
        IAccountService accountService,
        IIdentityRepository identityRepository,
        IHttpContextAccessor httpContextAccessor,
        EnvConfiguration envConfig,
        ILogger<AuthService> logger,
        AuthMetrics metrics,
        TimeProvider timeProvider,
        IHttpClientFactory httpClientFactory,
        IIdentityStateResolver identityStateResolver,
        IPasswordPolicyService passwordPolicyService,
        IOtpPolicyService otpPolicyService,
        IStorageService storageService,
        IRateLimitPolicyService rateLimitPolicyService,
        IGoogleTokenValidator googleTokenValidator,
        IUsernameService usernameService,
        IWorkspaceMembershipService workspaceMembershipService)
    {
        _context = context;
        _tokenService = tokenService;
        _cacheService = cacheService;
        _accountService = accountService;
        _identityRepository = identityRepository;
        _httpContextAccessor = httpContextAccessor;
        _envConfig = envConfig;
        _logger = logger;
        _metrics = metrics;
        _timeProvider = timeProvider;
        _httpClientFactory = httpClientFactory;
        _identityStateResolver = identityStateResolver;
        _passwordPolicyService = passwordPolicyService;
        _otpPolicyService = otpPolicyService;
        _storageService = storageService;
        _rateLimitPolicyService = rateLimitPolicyService;
        _googleTokenValidator = googleTokenValidator;
        _usernameService = usernameService;
        _workspaceMembershipService = workspaceMembershipService;
    }


    private async Task<string?> GetSignedAvatarUrlAsync(string? avatarUrl, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(avatarUrl)) return null;
        if (avatarUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase) || 
            avatarUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            return avatarUrl;
        }
        try
        {
            return await _storageService.GetSignedUrlAsync(avatarUrl, TimeSpan.FromHours(24), cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to sign avatar URL key: {Key}", avatarUrl);
            return null;
        }
    }

    private async Task<AuthResponse> CreateAuthResponseAsync(User user, IEnumerable<string> roles, IEnumerable<string> permissions, bool isEmailVerified, string status, string nextStep, CancellationToken cancellationToken = default)
    {
        var signedAvatar = await GetSignedAvatarUrlAsync(user.AvatarUrl, cancellationToken);
        var passwordChangedAt = user.PasswordChangedAt;
        var hasPassword = !string.IsNullOrEmpty(user.PasswordHash);
        if (hasPassword && passwordChangedAt == null)
        {
            passwordChangedAt = user.CreatedAt;
        }
        return new AuthResponse(user.Id, user.Email, user.Username, user.FullName, signedAvatar, roles, permissions, isEmailVerified, status, nextStep, passwordChangedAt, hasPassword);
    }

    private async Task<UserProfileResponse> CreateUserProfileResponseAsync(User user, IEnumerable<string> roles, IEnumerable<string> permissions, bool isEmailVerified, string status, string nextStep, CancellationToken cancellationToken = default)
    {
        var signedAvatar = await GetSignedAvatarUrlAsync(user.AvatarUrl, cancellationToken);
        var passwordChangedAt = user.PasswordChangedAt;
        var hasPassword = !string.IsNullOrEmpty(user.PasswordHash);
        if (hasPassword && passwordChangedAt == null)
        {
            passwordChangedAt = user.CreatedAt;
        }
        return new UserProfileResponse(user.Id, user.Email, user.Username, user.FullName, signedAvatar, roles, permissions, isEmailVerified, status, nextStep, passwordChangedAt, hasPassword);
    }

    /// <summary>
    /// Authenticates a user and issues JWT and Refresh tokens in HttpOnly cookies.
    /// Handles account lockout and failed attempt tracking.
    /// </summary>
    public async Task<AuthResponse?> LoginAsync(LoginRequest request)
    {
        var normalizedEmail = NormalizeEmailPolicy(request.Email);

        var user = await _context.FindUserByVerifiedEmailAsync(normalizedEmail);

        if (user == null && normalizedEmail.EndsWith("@gmail.com", StringComparison.OrdinalIgnoreCase))
        {
            var fallbackEmail = LegacyEmailCompatibilityHelper.ApplyOldGmailNormalization(normalizedEmail);
            if (fallbackEmail != normalizedEmail)
            {
                user = await _context.FindUserByVerifiedEmailAsync(fallbackEmail);
            }
        }

        if (user == null)
        {
            _metrics.RecordLoginFailed();
            await LogAuditEventAsync(null, "USER_LOGIN_FAILED_EMAIL", $"Unknown email login attempt for {normalizedEmail}.");
            return null;
        }

        if (user.Status == UserStatus.DELETION_PENDING)
        {
            if (!VerifyPassword(user, user.PasswordHash, request.Password))
            {
                _metrics.RecordLoginFailed();
                await LogAuditEventAsync(user.Id, "USER_LOGIN_FAILED_CREDENTIALS", $"Invalid password login attempt for deactivated user {user.Email}.");
                return null;
            }

            var userRoles = await _identityRepository.GetUserRolesAsync(user.Id);
            var userPermissions = await _identityRepository.GetUserPermissionsAsync(user.Id);
            var reactivationToken = Guid.NewGuid().ToString("N");
            await _cacheService.SetAsync($"reactivate:token:{reactivationToken}", user.Id.ToString(), TimeSpan.FromMinutes(10));

            return new AuthResponse(user.Id, user.Email, user.Username, user.FullName, user.AvatarUrl, userRoles, userPermissions, user.EmailVerifiedAt.HasValue, "DELETION_PENDING", $"REACTIVATE:{reactivationToken}", null, !string.IsNullOrEmpty(user.PasswordHash));
        }

        if (_accountService.IsAccountDisabled(user))
        {
            _metrics.RecordLoginFailed();
            await LogAuditEventAsync(user.Id, "USER_LOGIN_FAILED_DISABLED", $"Disabled user account login attempt for {user.Email}.");
            throw new UnauthorizedAccessException("Account is disabled.");
        }

        if (_accountService.IsAccountLocked(user))
        {
            _metrics.RecordLoginFailed();
            await LogAuditEventAsync(user.Id, "USER_LOGIN_FAILED_LOCKED", $"Locked user account login attempt for {user.Email}.");
            throw new UnauthorizedAccessException($"Account is temporarily locked until {user.LockUntil}");
        }

        if (!VerifyPassword(user, user.PasswordHash, request.Password))
        {
            _metrics.RecordLoginFailed();
            await _accountService.HandleFailedLoginAsync(user);
            await LogAuditEventAsync(user.Id, "USER_LOGIN_FAILED_CREDENTIALS", $"Invalid password login attempt for {user.Email}.");
            return null;
        }

        await _accountService.ResetFailedAttemptsAsync(user);

        // Bootstrap workspace admin if email matches organization contact email
        await _workspaceMembershipService.BootstrapInitialAdminAsync(user.Email);

        var roles = await _identityRepository.GetUserRolesAsync(user.Id);
        var permissions = await _identityRepository.GetUserPermissionsAsync(user.Id);

        var superAdminEmail = _envConfig.SuperAdmin.Email;
        bool isSuperAdmin = string.Equals(normalizedEmail, superAdminEmail, StringComparison.OrdinalIgnoreCase);

        if (user.Status == UserStatus.EMAIL_VERIFY_PENDING && !isSuperAdmin)
        {
            await LogAuditEventAsync(user.Id, "USER_LOGIN_UNVERIFIED", $"User {user.Email} attempted to login but email is unverified.");
            return await CreateAuthResponseAsync(user, roles, permissions, false, "EMAIL_VERIFY_PENDING", "VERIFY_EMAIL");
        }

        await CacheUserAuthDataAsync(user.Id, roles, permissions);

        var sessionId = Guid.CreateVersion7();
        var jwt = _tokenService.GenerateJwtToken(user, roles, permissions, sessionId: sessionId);
        var refreshTokenStr = _tokenService.GenerateRefreshToken();

        var rememberMe = request.RememberMe;
        await SaveRefreshTokenAsync(user.Id, null, refreshTokenStr, sessionId, rememberMe);

        var refreshExpiry = rememberMe ? DateTime.UtcNow.AddDays(7) : DateTime.UtcNow.AddHours(24);
        _tokenService.SetTokenInsideCookie("access_token", jwt, DateTime.UtcNow.AddMinutes(15));
        _tokenService.SetTokenInsideCookie("refresh_token", refreshTokenStr, refreshExpiry);

        _metrics.RecordLoginSuccess();
        await LogAuditEventAsync(user.Id, "USER_LOGIN_SUCCESS", $"User {user.Email} logged in successfully.");
        return await CreateAuthResponseAsync(user, roles, permissions, true, "ACTIVE", "DASHBOARD");
    }

    /// <summary>
    /// Authenticates a Google user using their ID Token.
    /// Performs auto-registration for new users and status promotion/verification on successful token validation.
    /// </summary>
    public async Task<AuthResponse?> LoginWithGoogleAsync(GoogleLoginRequest request)
    {
        var correlationId = Guid.NewGuid().ToString("N");
        try
        {
            // Hardened Clock Tolerance settings (5 minutes safety buffer) to handle potential clock skews.
            var settings = new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = new[] { _envConfig.Auth.GoogleClientId },
                IssuedAtClockTolerance = TimeSpan.FromMinutes(5),
                ExpirationTimeClockTolerance = TimeSpan.FromMinutes(5)
            };

            var payload = await _googleTokenValidator.ValidateAsync(request.IdToken, settings);
            if (payload == null)
            {
                _metrics.RecordLoginFailed();
                throw new UnauthorizedAccessException("Google authentication failed.");
            }

            if (!payload.EmailVerified)
            {
                _metrics.RecordLoginFailed();
                throw new UnauthorizedAccessException("Google account email is not verified.");
            }

            var email = NormalizeEmailPolicy(payload.Email);

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // 1. Look up by Provider ID (Subject) first
                var user = await _context.Users
                    .Include(u => u.Roles)
                    .Include(u => u.AuthProviders)
                    .FirstOrDefaultAsync(u => u.AuthProviders.Any(ap => ap.ProviderName.ToLower() == "google" && ap.ProviderKey == payload.Subject && ap.DeletedAt == null));

                // 2. Check for soft-deleted / unlinked record of this Google identity
                if (user == null)
                {
                    var wasUnlinked = await _context.AuthProviders
                        .IgnoreQueryFilters()
                        .AnyAsync(ap => ap.ProviderName.ToLower() == "google" && ap.ProviderKey == payload.Subject && ap.DeletedAt != null);

                    if (wasUnlinked)
                    {
                        _metrics.RecordLoginFailed();
                        await LogAuditEventAsync(null, "USER_GOOGLE_LOGIN_BLOCKED", $"Blocked Google login attempt for unlinked identity Subject={payload.Subject}.");
                        throw new AuthException("GOOGLE_PROVIDER_UNLINKED", "This Google account has been explicitly unlinked. Please sign in via password or another provider.");
                    }

                    // 3. Fall back to email matching ONLY if eligible according to Fallback Eligibility Matrix
                    var matchingUser = await _context.FindUserByVerifiedEmailAsync(email);
                    if (matchingUser != null)
                    {
                        await _context.Entry(matchingUser).Collection(u => u.Roles).LoadAsync();
                        await _context.Entry(matchingUser).Collection(u => u.AuthProviders).LoadAsync();
                    }

                    if (matchingUser != null)
                    {
                        // Eligibility Matrix Enforcement:
                        // Case B: Unverified local account
                        if (matchingUser.Status == UserStatus.EMAIL_VERIFY_PENDING)
                        {
                            _metrics.RecordLoginFailed();
                            await LogAuditEventAsync(matchingUser.Id, "TAKEOVER_ATTEMPT_BLOCKED", $"Blocked Google auto-link attempt on unverified profile: {email}");
                            throw new AuthException(AuthErrorCodes.AccountConflict, "Google automatic linking is blocked for unverified profiles. Please verify your email first.");
                        }

                        // Case C & D: Active local account with password or other provider connections
                        var hasPassword = !string.IsNullOrEmpty(matchingUser.PasswordHash);

                        var hasOtherProviders = matchingUser.AuthProviders.Any(ap => ap.DeletedAt == null);

                        if (hasPassword || hasOtherProviders)
                        {
                            _metrics.RecordLoginFailed();
                            await LogAuditEventAsync(matchingUser.Id, "TAKEOVER_ATTEMPT_BLOCKED", $"Blocked Google auto-link attempt on credential-secured profile: {email}");
                            throw new AuthException(AuthErrorCodes.AccountConflict, "An account with this email address already exists. Please log in using your password/existing provider to link Google.");
                        }

                        // Case E: Account has soft-deleted Google provider
                        var hasDeletedGoogle = await _context.AuthProviders
                            .IgnoreQueryFilters()
                            .AnyAsync(ap => ap.UserId == matchingUser.Id && ap.ProviderName.ToLower() == "google" && ap.DeletedAt != null);

                        if (hasDeletedGoogle)
                        {
                            _metrics.RecordLoginFailed();
                            await LogAuditEventAsync(matchingUser.Id, "USER_GOOGLE_LOGIN_BLOCKED", $"Blocked Google login on unlinked profile: {email}");
                            throw new AuthException("GOOGLE_PROVIDER_UNLINKED", "This Google account has been unlinked. Please log in using your email/password to reconnect.");
                        }

                        user = matchingUser;
                    }
                }

                var superAdminEmail = _envConfig.SuperAdmin.Email;
                bool isSuperAdmin = string.Equals(email, superAdminEmail, StringComparison.OrdinalIgnoreCase);

                var targetRoleName = isSuperAdmin ? "SUPER_ADMIN" : "USER";
                var userRole = await _context.Roles.FirstOrDefaultAsync(r => r.Name == targetRoleName);
                if (userRole == null)
                {
                    throw new InvalidOperationException($"Default '{targetRoleName}' role not found in the database.");
                }

                if (user == null)
                {
                    // Create account instantly
                    user = new User
                    {
                        Email = email,
                        FullName = payload.Name ?? "Google User",
                        AvatarUrl = payload.Picture,
                        AvatarSource = !string.IsNullOrEmpty(payload.Picture) ? AvatarSource.Google : AvatarSource.Default,
                        Status = UserStatus.EMAIL_VERIFY_PENDING,
                        CreatedAt = _timeProvider.GetUtcNow().UtcDateTime,
                        UpdatedAt = _timeProvider.GetUtcNow().UtcDateTime,
                        Roles = new List<Role> { userRole }
                    };

                    _context.Users.Add(user);

                    // Create Google Provider row
                    var googleProvider = new AuthProvider
                    {
                        UserId = user.Id,
                        ProviderName = "Google",
                        ProviderKey = payload.Subject,
                        ProviderAccountId = payload.Email ?? payload.Name ?? payload.Subject,
                        ProviderAvatarUrl = payload.Picture,
                        CreatedAt = _timeProvider.GetUtcNow()
                    };
                    _context.AuthProviders.Add(googleProvider);

                    await ActivateUserAsync(user);

                    await LogAuditEventAsync(user.Id, "PROVIDER_LINKED", $"Linked Google provider to user {user.Email}.");
                    await LogAuditEventAsync(user.Id, "USER_GOOGLE_REGISTER", $"New user {user.Email} registered via Google OAuth.");
                }
                else
                {
                    if (user.Status == UserStatus.DELETION_PENDING)
                    {
                        var userRoles = await _identityRepository.GetUserRolesAsync(user.Id);
                        var userPermissions = await _identityRepository.GetUserPermissionsAsync(user.Id);
                        var reactivationToken = Guid.NewGuid().ToString("N");
                        await _cacheService.SetAsync($"reactivate:token:{reactivationToken}", user.Id.ToString(), TimeSpan.FromMinutes(10));

                        return new AuthResponse(user.Id, user.Email, user.Username, user.FullName, user.AvatarUrl, userRoles, userPermissions, user.EmailVerifiedAt.HasValue, "DELETION_PENDING", $"REACTIVATE:{reactivationToken}", null, !string.IsNullOrEmpty(user.PasswordHash));
                    }

                    if (_accountService.IsAccountDisabled(user))
                    {
                        _metrics.RecordLoginFailed();
                        await LogAuditEventAsync(user.Id, "USER_LOGIN_FAILED_DISABLED", $"Disabled user account Google login attempt for {user.Email}.");
                        throw new UnauthorizedAccessException("Account is disabled.");
                    }

                    if (_accountService.IsAccountLocked(user))
                    {
                        _metrics.RecordLoginFailed();
                        await LogAuditEventAsync(user.Id, "USER_LOGIN_FAILED_LOCKED", $"Locked user account Google login attempt for {user.Email}.");
                        throw new UnauthorizedAccessException($"Account is temporarily locked until {user.LockUntil}");
                    }

                    var googleProvider = user.AuthProviders.FirstOrDefault(ap => ap.ProviderName.ToLower() == "google" && ap.DeletedAt == null);

                    if (googleProvider != null)
                    {
                        googleProvider.ProviderAvatarUrl = payload.Picture;
                    }

                    if (!string.IsNullOrEmpty(payload.Picture))
                    {
                        if (user.AvatarSource == AvatarSource.Google)
                        {
                            user.AvatarUrl = payload.Picture;
                        }
                    }
                    if (!string.IsNullOrEmpty(payload.Name) && user.FullName != payload.Name && user.FullName == "Google User")
                    {
                        user.FullName = payload.Name;
                    }

                    // Dynamically map AuthProvider link if not present or needs email update
                    if (googleProvider == null)
                    {
                        googleProvider = new AuthProvider
                        {
                            UserId = user.Id,
                            ProviderName = "Google",
                            ProviderKey = payload.Subject,
                            ProviderAccountId = payload.Email ?? payload.Name ?? payload.Subject,
                            ProviderAvatarUrl = payload.Picture,
                            CreatedAt = _timeProvider.GetUtcNow()
                        };
                        _context.AuthProviders.Add(googleProvider);
                        await LogAuditEventAsync(user.Id, "PROVIDER_LINKED", $"Dynamically mapped Google provider link for existing user {user.Email}.");
                    }
                    else
                    {
                        if (googleProvider.ProviderAccountId != payload.Email)
                        {
                            googleProvider.ProviderAccountId = payload.Email ?? payload.Name ?? payload.Subject;
                        }
                        if (googleProvider.ProviderAvatarUrl != payload.Picture)
                        {
                            googleProvider.ProviderAvatarUrl = payload.Picture;
                        }
                    }

                    await ActivateUserAsync(user);
                }

                await transaction.CommitAsync();

                // Invalidate identity state cache when provider topology changes
                await _identityStateResolver.InvalidateCacheAsync(user.Email);
                if (user.Email != email)
                {
                    await _identityStateResolver.InvalidateCacheAsync(email);
                }

                var roles = await _identityRepository.GetUserRolesAsync(user.Id);
                var permissions = await _identityRepository.GetUserPermissionsAsync(user.Id);

                await CacheUserAuthDataAsync(user.Id, roles, permissions);

                var sessionId = Guid.CreateVersion7();
                var jwt = _tokenService.GenerateJwtToken(user, roles, permissions, sessionId: sessionId);
                var refreshTokenStr = _tokenService.GenerateRefreshToken();

                var rememberMe = true; 
                await SaveRefreshTokenAsync(user.Id, null, refreshTokenStr, sessionId, rememberMe);

                var refreshExpiry = DateTime.UtcNow.AddDays(7);
                _tokenService.SetTokenInsideCookie("access_token", jwt, DateTime.UtcNow.AddMinutes(15));
                _tokenService.SetTokenInsideCookie("refresh_token", refreshTokenStr, refreshExpiry);

                _metrics.RecordLoginSuccess();
                await LogAuditEventAsync(user.Id, "USER_GOOGLE_LOGIN_SUCCESS", $"User {user.Email} logged in successfully via Google OAuth.");

                return await CreateAuthResponseAsync(user, roles, permissions, true, "ACTIVE", "DASHBOARD");
            }
            catch (AuthException ex)
            {
                await transaction.RollbackAsync();
                _logger.LogWarning(ex, "[CorrelationID: {CorrelationId}] Google login transaction blocked: {Message}", correlationId, ex.Message);
                throw;
            }
            catch (UnauthorizedAccessException ex)
            {
                await transaction.RollbackAsync();
                _logger.LogWarning(ex, "[CorrelationID: {CorrelationId}] Google login transaction unauthorized: {Message}", correlationId, ex.Message);
                throw;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "[CorrelationID: {CorrelationId}] Google login transaction failed.", correlationId);
                throw;
            }
        }
        catch (InvalidJwtException ex)
        {
            _metrics.RecordLoginFailed();
            _logger.LogWarning("Invalid Google ID Token provided: {Message}", ex.Message);
            throw new UnauthorizedAccessException("Invalid Google ID Token.");
        }
    }


    /// <summary>
    /// Revokes the current refresh token and removes authentication cookies.
    /// </summary>
    public async Task LogoutAsync()
    {
        var refreshToken = _httpContextAccessor.HttpContext?.Request.Cookies["refresh_token"];
        if (!string.IsNullOrEmpty(refreshToken))
        {
            var storedToken = await _context.RefreshTokens.FirstOrDefaultAsync(t => t.Token == refreshToken);
            if (storedToken != null)
            {
                storedToken.RevokedAt = _timeProvider.GetUtcNow();
                await _context.SaveChangesAsync();
            }
        }

        _tokenService.RemoveTokenFromCookie("access_token");
        _tokenService.RemoveTokenFromCookie("refresh_token");
    }

    /// <summary>
    /// Validates the refresh token cookie and issues a new set of tokens (Token Rotation).
    /// Prevents replay attacks by revoking the old token.
    /// Incorporates a 10-second concurrency grace window for multi-tab support and isolation bounds.
    /// </summary>
    public async Task<AuthResponse?> RefreshTokenAsync()
    {
        var refreshTokenStr = _httpContextAccessor.HttpContext?.Request.Cookies["refresh_token"];
        if (string.IsNullOrEmpty(refreshTokenStr)) return null;

        // Redis Distributed Lock to avoid concurrent rotation race conditions
        var lockKey = $"lock:token:rotate:{refreshTokenStr}";
        var lockValue = Guid.NewGuid().ToString("N");
        var acquired = await _cacheService.AcquireLockAsync(lockKey, lockValue, TimeSpan.FromSeconds(10));
        var maskedToken = refreshTokenStr.Length > 8 ? $"{refreshTokenStr[..4]}...{refreshTokenStr[^4..]}" : "***MASKED***";
        if (!acquired)
        {
            _logger.LogWarning("Token rotation request rejected due to lock contention: {Token}", maskedToken);
            throw new AuthException(AuthErrorCodes.InvalidToken, "Concurrent token rotation detected.");
        }

        try
        {
            var storedToken = await _context.RefreshTokens
                .Include(t => t.User)
                .Include(t => t.Organization)
                .FirstOrDefaultAsync(t => t.Token == refreshTokenStr);

            if (storedToken == null) return null;

            // Coarse-grained distributed concurrency lock at user scope to serialize session mutations
            var lockTargetId = storedToken.UserId ?? storedToken.OrganizationId;
            var userLockKey = $"lock:user:sessions:{lockTargetId}";
            var userLockValue = Guid.NewGuid().ToString("N");
            var userLockAcquired = await _cacheService.AcquireLockAsync(userLockKey, userLockValue, TimeSpan.FromSeconds(10));
            if (!userLockAcquired)
            {
                throw new AuthException(AuthErrorCodes.InvalidToken, "Concurrent session operations detected.");
            }

            try
            {
                // Re-fetch token within the user-scoped lock to ensure it wasn't mutated or revoked concurrently
                var reFetchedToken = await _context.RefreshTokens
                    .Include(t => t.User)
                    .Include(t => t.Organization)
                    .FirstOrDefaultAsync(t => t.Id == storedToken.Id);

                var validationResult = ValidateRefreshToken(reFetchedToken);

                if (validationResult == RefreshTokenValidationResult.Invalid || validationResult == RefreshTokenValidationResult.Expired)
                {
                    return null;
                }

                if (validationResult == RefreshTokenValidationResult.Reused)
                {
                    var httpContext = _httpContextAccessor.HttpContext;
                    var currentIp = httpContext?.Connection.RemoteIpAddress?.ToString() ?? "Unknown";
                    var currentUa = httpContext?.Request.Headers["User-Agent"].ToString() ?? "Unknown";

                    // Staged Revocation / Compromise Isolation: Revoke all tokens belonging to the compromised Session ID
                    using var transaction = await _context.Database.BeginTransactionAsync();
                    try
                    {
                        await RevokeSessionChainAsync(reFetchedToken!.SessionId);
                        await transaction.CommitAsync();
                    }
                    catch
                    {
                        await transaction.RollbackAsync();
                        throw;
                    }

                    // Structured security log
                    _logger.LogWarning("SECURITY ALERT: [Event=TOKEN_REUSE_DETECTED] [SessionId={SessionId}] [UserId={UserId}] [IpAddress={IpAddress}] [UserAgent={UserAgent}]",
                        reFetchedToken.SessionId, reFetchedToken.UserId, currentIp, currentUa);

                    await LogAuditEventAsync(reFetchedToken.UserId, "TOKEN_THEFT_DETECTED",
                        $"Refresh token reuse/theft detected for token {maskedToken}. Session {reFetchedToken.SessionId} isolated and revoked. IP: {currentIp}, UA: {currentUa}");

                    throw new AuthException(AuthErrorCodes.InvalidToken, "Token reuse detected.");
                }

                if (validationResult == RefreshTokenValidationResult.WithinGracePeriod)
                {
                    // Safe concurrency: Return the active replacement token that was already generated
                    var activeReplacement = await _context.RefreshTokens
                        .FirstOrDefaultAsync(t => t.Id == reFetchedToken!.ReplacedByTokenId);

                    if (activeReplacement != null)
                    {
                        _logger.LogInformation("Safe concurrent refresh race handled. SessionId: {SessionId}.", reFetchedToken!.SessionId);

                        if (reFetchedToken.UserId.HasValue)
                        {
                            var user = reFetchedToken.User;
                            var roles = await _identityRepository.GetUserRolesAsync(user.Id);
                            var permissions = await _identityRepository.GetUserPermissionsAsync(user.Id);

                            var jwt = _tokenService.GenerateJwtToken(user, roles, permissions, sessionId: reFetchedToken.SessionId);

                            // Re-set cookies for the active rotated token
                            var refreshExpiry = activeReplacement.RememberMe ? DateTime.UtcNow.AddDays(7) : DateTime.UtcNow.AddHours(24);
                            _tokenService.SetTokenInsideCookie("access_token", jwt, DateTime.UtcNow.AddMinutes(15));
                            _tokenService.SetTokenInsideCookie("refresh_token", activeReplacement.Token, refreshExpiry);

                            return await CreateAuthResponseAsync(user, roles, permissions,
                                user.Status == UserStatus.ACTIVE, user.Status.ToString(),
                                user.Status == UserStatus.EMAIL_VERIFY_PENDING ? "VERIFY_EMAIL" : "DASHBOARD");
                        }
                        else if (reFetchedToken.OrganizationId.HasValue)
                        {
                            var credential = await _context.OrganizationCredentials
                                .Include(oc => oc.Organization)
                                .FirstOrDefaultAsync(oc => oc.OrganizationId == reFetchedToken.OrganizationId && oc.DeletedAt == null);

                            if (credential == null || credential.Organization.DeletedAt != null) return null;

                            var roles = new[] { "BUSINESS" };
                            var permissions = Enumerable.Empty<string>();

                            var jwt = _tokenService.GenerateCompanyJwtToken(credential, roles, permissions, sessionId: reFetchedToken.SessionId);

                            var refreshExpiry = activeReplacement.RememberMe ? DateTime.UtcNow.AddDays(7) : DateTime.UtcNow.AddHours(24);
                            _tokenService.SetTokenInsideCookie("access_token", jwt, DateTime.UtcNow.AddMinutes(15));
                            _tokenService.SetTokenInsideCookie("refresh_token", activeReplacement.Token, refreshExpiry);

                            return new AuthResponse(credential.OrganizationId, credential.Organization.Email, credential.Username, credential.Organization.Name, null, roles, permissions, true, "ACTIVE", "DASHBOARD");
                        }
                        return null;
                    }
                }

                // Normal path: validationResult == RefreshTokenValidationResult.Valid
                if (reFetchedToken!.UserId.HasValue)
                {
                    var oldUser = reFetchedToken.User;
                    var oldRoles = await _identityRepository.GetUserRolesAsync(oldUser.Id);
                    var oldPermissions = await _identityRepository.GetUserPermissionsAsync(oldUser.Id);

                    // Compare User-Agents for hijack warnings
                    var currentUserAgent = _httpContextAccessor.HttpContext?.Request.Headers["User-Agent"].ToString();
                    if (!string.IsNullOrWhiteSpace(reFetchedToken.UserAgent) &&
                        !string.Equals(reFetchedToken.UserAgent, currentUserAgent, StringComparison.OrdinalIgnoreCase))
                    {
                        _logger.LogWarning("SECURITY WARNING: User-Agent changed during token refresh for Session {SessionId}. Original: '{OriginalUA}', Current: '{CurrentUA}'",
                            reFetchedToken.SessionId, reFetchedToken.UserAgent, currentUserAgent);
                    }

                    var newRefreshTokenStr = _tokenService.GenerateRefreshToken();

                    using var rotationTx = await _context.Database.BeginTransactionAsync();
                    RefreshToken newRefreshToken;
                    try
                    {
                        newRefreshToken = await RotateRefreshTokenAsync(reFetchedToken, newRefreshTokenStr);
                        await rotationTx.CommitAsync();
                    }
                    catch
                    {
                        await rotationTx.RollbackAsync();
                        throw;
                    }

                    var newJwt = _tokenService.GenerateJwtToken(oldUser, oldRoles, oldPermissions, sessionId: reFetchedToken.SessionId);

                    var newRefreshExpiry = newRefreshToken.RememberMe ? DateTime.UtcNow.AddDays(7) : DateTime.UtcNow.AddHours(24);
                    _tokenService.SetTokenInsideCookie("access_token", newJwt, DateTime.UtcNow.AddMinutes(15));
                    _tokenService.SetTokenInsideCookie("refresh_token", newRefreshTokenStr, newRefreshExpiry);

                    await LogAuditEventAsync(oldUser.Id, "TOKEN_ROTATED", $"Token rotated successfully. New token issued for Session {reFetchedToken.SessionId}.");

                    return await CreateAuthResponseAsync(oldUser, oldRoles, oldPermissions,
                        oldUser.Status == UserStatus.ACTIVE, oldUser.Status.ToString(),
                        oldUser.Status == UserStatus.EMAIL_VERIFY_PENDING ? "VERIFY_EMAIL" : "DASHBOARD");
                }
                else if (reFetchedToken.OrganizationId.HasValue)
                {
                    var credential = await _context.OrganizationCredentials
                        .Include(oc => oc.Organization)
                        .FirstOrDefaultAsync(oc => oc.OrganizationId == reFetchedToken.OrganizationId && oc.DeletedAt == null);

                    if (credential == null || credential.Organization.DeletedAt != null) return null;

                    var roles = new[] { "BUSINESS" };
                    var permissions = Enumerable.Empty<string>();

                    // Compare User-Agents for hijack warnings
                    var currentUserAgent = _httpContextAccessor.HttpContext?.Request.Headers["User-Agent"].ToString();
                    if (!string.IsNullOrWhiteSpace(reFetchedToken.UserAgent) &&
                        !string.Equals(reFetchedToken.UserAgent, currentUserAgent, StringComparison.OrdinalIgnoreCase))
                    {
                        _logger.LogWarning("SECURITY WARNING: User-Agent changed during token refresh for Session {SessionId}. Original: '{OriginalUA}', Current: '{CurrentUA}'",
                            reFetchedToken.SessionId, reFetchedToken.UserAgent, currentUserAgent);
                    }

                    var newRefreshTokenStr = _tokenService.GenerateRefreshToken();

                    using var rotationTx = await _context.Database.BeginTransactionAsync();
                    RefreshToken newRefreshToken;
                    try
                    {
                        newRefreshToken = await RotateRefreshTokenAsync(reFetchedToken, newRefreshTokenStr);
                        await rotationTx.CommitAsync();
                    }
                    catch
                    {
                        await rotationTx.RollbackAsync();
                        throw;
                    }

                    var newJwt = _tokenService.GenerateCompanyJwtToken(credential, roles, permissions, sessionId: reFetchedToken.SessionId);

                    var newRefreshExpiry = newRefreshToken.RememberMe ? DateTime.UtcNow.AddDays(7) : DateTime.UtcNow.AddHours(24);
                    _tokenService.SetTokenInsideCookie("access_token", newJwt, DateTime.UtcNow.AddMinutes(15));
                    _tokenService.SetTokenInsideCookie("refresh_token", newRefreshTokenStr, newRefreshExpiry);

                    await LogAuditEventAsync(null, "COMPANY_TOKEN_ROTATED", $"Company Token rotated successfully. New token issued for Session {reFetchedToken.SessionId}.");

                    return new AuthResponse(credential.OrganizationId, credential.Organization.Email, credential.Username, credential.Organization.Name, null, roles, permissions, true, "ACTIVE", "DASHBOARD");
                }

                return null;
            }
            finally
            {
                await _cacheService.ReleaseLockAsync(userLockKey, userLockValue);
            }
        }
        finally
        {
            await _cacheService.ReleaseLockAsync(lockKey, lockValue);
        }
    }

    /// <summary>
    /// Validates a refresh token. If it is already revoked, checks if it is within
    /// the 10-second multi-tab safe concurrency grace period to avoid false positive security logouts.
    /// </summary>
    private RefreshTokenValidationResult ValidateRefreshToken(RefreshToken? storedToken)
    {
        if (storedToken == null)
        {
            return RefreshTokenValidationResult.Invalid;
        }

        var now = _timeProvider.GetUtcNow();

        if (storedToken.IsRevoked)
        {
            // Concurrent safe refresh window of 10 seconds for multi-tab scenarios
            if (storedToken.RevokedAt.HasValue && storedToken.RevokedAt.Value.AddSeconds(10) > now)
            {
                return RefreshTokenValidationResult.WithinGracePeriod;
            }

            return RefreshTokenValidationResult.Reused;
        }

        if (storedToken.IsExpired)
        {
            return RefreshTokenValidationResult.Expired;
        }

        return RefreshTokenValidationResult.Valid;
    }

    private enum RefreshTokenValidationResult
    {
        Invalid,
        Expired,
        Valid,
        Reused,
        WithinGracePeriod
    }

    private async Task<RefreshToken> RotateRefreshTokenAsync(RefreshToken oldToken, string newRefreshTokenStr)
    {
        var now = _timeProvider.GetUtcNow();
        var expiration = oldToken.RememberMe ? TimeSpan.FromDays(7) : TimeSpan.FromHours(24);

        // Revoke the old token and tie it to the new one
        oldToken.RevokedAt = now;
        oldToken.ReplacedByToken = newRefreshTokenStr;

        // Generate the new token sharing the same sessionId and rememberMe
        var httpContext = _httpContextAccessor.HttpContext;
        var userAgent = httpContext?.Request.Headers["User-Agent"].ToString();
        var ipAddress = httpContext?.Connection.RemoteIpAddress?.ToString();

        var newRefreshToken = new RefreshToken
        {
            UserId = oldToken.UserId,
            OrganizationId = oldToken.OrganizationId,
            Token = newRefreshTokenStr,
            SessionId = oldToken.SessionId,
            RememberMe = oldToken.RememberMe,
            ExpiresAt = now.Add(expiration),
            UserAgent = string.IsNullOrWhiteSpace(userAgent) ? null : (userAgent.Length > 500 ? userAgent[..500] : userAgent),
            IpAddress = string.IsNullOrWhiteSpace(ipAddress) ? null : (ipAddress.Length > 45 ? ipAddress[..45] : ipAddress)
        };

        _context.RefreshTokens.Add(newRefreshToken);
        await _context.SaveChangesAsync();

        // Update the reference of the old token's ReplacedByTokenId
        oldToken.ReplacedByTokenId = newRefreshToken.Id;
        await _context.SaveChangesAsync();

        return newRefreshToken;
    }

    private async Task RevokeSessionChainAsync(Guid sessionId)
    {
        var now = _timeProvider.GetUtcNow();
        var activeTokens = await _context.RefreshTokens
            .Where(t => t.SessionId == sessionId && t.RevokedAt == null)
            .ToListAsync();

        foreach (var token in activeTokens)
        {
            token.RevokedAt = now;
        }

        await _context.SaveChangesAsync();
    }


    public async Task<UserProfileResponse?> GetMeAsync()
    {
        var userIdClaim = _httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null) return null;

        var userId = Guid.Parse(userIdClaim.Value);

        var actorTypeClaim = _httpContextAccessor.HttpContext?.User.FindFirst("actor_type")?.Value;
        bool isBusiness = string.Equals(actorTypeClaim, "business", StringComparison.OrdinalIgnoreCase);

        if (isBusiness)
        {
            var credential = await _context.OrganizationCredentials
                .Include(oc => oc.Organization)
                .FirstOrDefaultAsync(oc => oc.OrganizationId == userId && oc.DeletedAt == null);

            if (credential == null || credential.Organization.DeletedAt != null) return null;

            return new UserProfileResponse(
                credential.OrganizationId,
                credential.Organization.Email,
                credential.Username,
                credential.Organization.Name,
                null,
                new[] { "BUSINESS" },
                Enumerable.Empty<string>(),
                true,
                "ACTIVE",
                "DASHBOARD",
                null,
                true
            );
        }

        var roles = (await _cacheService.GetSetAsync($"auth:user:{userId}:roles")).ToList();
        var permissions = (await _cacheService.GetSetAsync($"auth:user:{userId}:permissions")).ToList();

        if (!roles.Any())
        {
            roles = (await _identityRepository.GetUserRolesAsync(userId)).ToList();
            permissions = (await _identityRepository.GetUserPermissionsAsync(userId)).ToList();
            await CacheUserAuthDataAsync(userId, roles, permissions);
        }

        var user = await _context.Users.FindAsync(userId);
        if (user == null) return null;

        return await CreateUserProfileResponseAsync(user, roles, permissions, user.Status == UserStatus.ACTIVE, user.Status.ToString(), user.Status == UserStatus.EMAIL_VERIFY_PENDING ? "VERIFY_EMAIL" : "DASHBOARD");
    }

    /// <summary>
    /// Registers a new user inside an EF Core transactional consistency boundary.
    /// Normalizes emails, handles idempotency retries, enforces password constraints,
    /// and schedules email verification via Outbox pattern.
    /// </summary>
    public async Task<RegisterResponse> RegisterAsync(RegisterRequest request, string userAgent, string ipAddress, CancellationToken cancellationToken = default)
    {
        var correlationId = Guid.NewGuid().ToString("N");
        _logger.LogInformation("[CorrelationID: {CorrelationId}] Handling user registration request for {Email}.", correlationId, request.Email);

        await _passwordPolicyService.ValidateAndThrowAsync(request.Password, "Default");

        var normalizedEmail = NormalizeEmailPolicy(request.Email);

        var existingUser = await _context.FindUserByEmailAsync(normalizedEmail, cancellationToken);
        if (existingUser != null)
        {
            // Idempotency: If pending verification and matches the primary email, rotate verification token and send a new link
            if (existingUser.Email == normalizedEmail && existingUser.Status == UserStatus.EMAIL_VERIFY_PENDING)
            {
                _logger.LogWarning("[CorrelationID: {CorrelationId}] User registration is duplicate but pending email verification. Rotating verification token.", correlationId);
                var resendRequest = new ResendVerificationRequest(request.Email);
                await ResendVerificationEmailAsync(resendRequest, cancellationToken);
                return RegisterResponseFactory.Create(UserStatus.EMAIL_VERIFY_PENDING);
            }

            _logger.LogWarning("[CorrelationID: {CorrelationId}] User registration is duplicate and status is {Status}. Throwing DuplicateEmailException.", correlationId, existingUser.Status);
            throw new DuplicateEmailException("This email is already in use.");
        }

        var superAdminEmail = _envConfig.SuperAdmin.Email;
        bool isSuperAdmin = string.Equals(normalizedEmail, superAdminEmail, StringComparison.OrdinalIgnoreCase);

        var targetRoleName = isSuperAdmin ? "SUPER_ADMIN" : "USER";
        var userRole = await _context.Roles.FirstOrDefaultAsync(r => r.Name == targetRoleName, cancellationToken);
        if (userRole == null)
        {
            throw new InvalidOperationException($"Default '{targetRoleName}' role not found in the database.");
        }

        var passwordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);

        // Transaction consistency boundary
        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var newUser = new User
            {
                Email = normalizedEmail,
                PasswordHash = passwordHash,
                FullName = request.FullName,
                Status = UserStatus.EMAIL_VERIFY_PENDING,
                CreatedAt = _timeProvider.GetUtcNow().UtcDateTime,
                UpdatedAt = _timeProvider.GetUtcNow().UtcDateTime,
                Roles = new List<Role> { userRole }
            };

            _context.Users.Add(newUser);
            await _usernameService.RunWithUsernameRetryAsync(newUser, normalizedEmail, async () => 
                await _context.SaveChangesAsync(cancellationToken), cancellationToken: cancellationToken);

            // Generate secure URL-safe verification token
            var plainToken = EmailTokenGenerator.GenerateSecureToken();

            // Hash the token for database storage
            using var sha256 = SHA256.Create();
            var hashedToken = Convert.ToHexString(sha256.ComputeHash(Encoding.UTF8.GetBytes(plainToken))).ToLowerInvariant();

            var verificationToken = new VerificationToken
            {
                UserId = newUser.Id,
                TokenHash = hashedToken,
                ExpiresAt = _timeProvider.GetUtcNow().AddMinutes(5),
                CreatedAt = _timeProvider.GetUtcNow()
            };

            _context.VerificationTokens.Add(verificationToken);
            await _context.SaveChangesAsync(cancellationToken);

            // Outbox Pattern enrollment: insert verification email envelope into outbox inside transaction
            var verificationLink = _envConfig.Auth.VerifyEmailUrlFormat.Replace("{token}", plainToken);
            
            // Validate the redirect domain
            var uri = new Uri(verificationLink);
            var trusted = _envConfig.Auth.TrustedDomains.Split(';', StringSplitOptions.RemoveEmptyEntries);
            if (!trusted.Any(t => uri.Host.Equals(t, StringComparison.OrdinalIgnoreCase)))
            {
                throw new AuthException(AuthErrorCodes.UntrustedRedirect, $"Verification link uses untrusted domain '{uri.Host}'.");
            }

            var payloadObj = new
            {
                Email = newUser.Email,
                FullName = newUser.FullName,
                Link = verificationLink,
                CorrelationId = correlationId
            };

            _context.AddAndAuditOutboxMessage("EmailVerification", newUser.Email, correlationId, payloadObj, _timeProvider.GetUtcNow());
            await _context.SaveChangesAsync(cancellationToken);

            await transaction.CommitAsync(cancellationToken);

            await LogAuditEventAsync(newUser.Id, "USER_REGISTERED", $"User account {newUser.Email} registered successfully.");
            await _identityStateResolver.InvalidateCacheAsync(newUser.Email);

            _logger.LogInformation("[CorrelationID: {CorrelationId}] User {UserId} registered successfully, outbox message enqueued.", correlationId, newUser.Id);
            _metrics.RecordRegistration();
            return RegisterResponseFactory.Success();
        }
        catch (DuplicateEmailException ex)
        {
            _logger.LogWarning(ex, "[CorrelationID: {CorrelationId}] Database-level unique constraint violation caught during concurrent registration insert. Falling back to duplicate registration logic.", correlationId);
            await transaction.RollbackAsync(cancellationToken);

            // Fetch the existing user that just got created in the concurrent transaction
            var concurrentUser = await _context.FindUserByEmailAsync(normalizedEmail, cancellationToken);
            if (concurrentUser != null)
            {
                if (concurrentUser.Email == normalizedEmail && concurrentUser.Status == UserStatus.EMAIL_VERIFY_PENDING)
                {
                    var resendRequest = new ResendVerificationRequest(request.Email);
                    await ResendVerificationEmailAsync(resendRequest, cancellationToken);
                }
                return RegisterResponseFactory.Create(concurrentUser.Status);
            }
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[CorrelationID: {CorrelationId}] Failed to complete user registration transaction. Rolling back.", correlationId);
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    /// <summary>
    /// Confirms email ownership and activates pending accounts.
    /// </summary>
    public async Task<AuthResponse?> VerifyEmailAsync(VerifyEmailRequest request, CancellationToken cancellationToken = default)
    {
        var correlationId = Guid.NewGuid().ToString("N");
        _logger.LogInformation("[CorrelationID: {CorrelationId}] Processing email verification request.", correlationId);

        using var sha256 = SHA256.Create();
        var hashedToken = Convert.ToHexString(sha256.ComputeHash(Encoding.UTF8.GetBytes(request.Token))).ToLowerInvariant();

        var tokenEntity = await _context.VerificationTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.TokenHash == hashedToken, cancellationToken);

        if (tokenEntity == null)
        {
            _logger.LogWarning("[CorrelationID: {CorrelationId}] Verification failed: invalid token hash.", correlationId);
            throw new AuthException(AuthErrorCodes.InvalidToken, "The verification token is invalid.");
        }

        if (tokenEntity.IsConsumed)
        {
            _logger.LogWarning("[CorrelationID: {CorrelationId}] Verification failed: token was already consumed.", correlationId);
            throw new AuthException(AuthErrorCodes.TokenAlreadyConsumed, "This verification token has already been used.");
        }

        if (tokenEntity.IsExpired)
        {
            _logger.LogWarning("[CorrelationID: {CorrelationId}] Verification failed: token is expired.", correlationId);
            throw new AuthException(AuthErrorCodes.ExpiredToken, "This verification token has expired.");
        }

        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            tokenEntity.ConsumedAt = _timeProvider.GetUtcNow();
            
            var user = tokenEntity.User;
            await ActivateUserAsync(user);

            // Queue onboarding welcome email via Outbox Pattern
            var payloadObj = new
            {
                Email = user.Email,
                FullName = user.FullName,
                CorrelationId = correlationId
            };

            _context.AddAndAuditOutboxMessage("WelcomeNotice", user.Email, correlationId, payloadObj, _timeProvider.GetUtcNow());
            await _context.SaveChangesAsync(cancellationToken);

            await transaction.CommitAsync(cancellationToken);

            await LogAuditEventAsync(user.Id, "USER_EMAIL_VERIFIED", $"User email {user.Email} successfully verified.");
            await _identityStateResolver.InvalidateCacheAsync(user.Email);



            var roles = await _identityRepository.GetUserRolesAsync(user.Id);
            var permissions = await _identityRepository.GetUserPermissionsAsync(user.Id);

            await CacheUserAuthDataAsync(user.Id, roles, permissions);

            var sessionId = Guid.CreateVersion7();
            var jwt = _tokenService.GenerateJwtToken(user, roles, permissions, sessionId: sessionId);
            var refreshTokenStr = _tokenService.GenerateRefreshToken();

            var rememberMe = false; // default to false
            await SaveRefreshTokenAsync(user.Id, null, refreshTokenStr, sessionId, rememberMe);

            var refreshExpiry = DateTime.UtcNow.AddHours(24);
            _tokenService.SetTokenInsideCookie("access_token", jwt, DateTime.UtcNow.AddMinutes(15));
            _tokenService.SetTokenInsideCookie("refresh_token", refreshTokenStr, refreshExpiry);

            _logger.LogInformation("[CorrelationID: {CorrelationId}] Email successfully verified for user {UserId} and auto-logged in.", correlationId, user.Id);
            _metrics.RecordVerification();
            
            return await CreateAuthResponseAsync(user, roles, permissions, true, "ACTIVE", "DASHBOARD", cancellationToken);
        }

        catch (DbUpdateConcurrencyException ex)
        {
            _logger.LogWarning(ex, "[CorrelationID: {CorrelationId}] Concurrency conflict detected during verification.", correlationId);
            await transaction.RollbackAsync(cancellationToken);
            throw new AuthException(AuthErrorCodes.InvalidToken, "A concurrency conflict occurred. Please retry your request.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[CorrelationID: {CorrelationId}] Verification transaction failed. Rolling back.", correlationId);
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    /// <summary>
    /// Resends a verification email, applying strict cooldown rules and rotated token keys.
    /// </summary>
    public async Task<bool> ResendVerificationEmailAsync(ResendVerificationRequest request, CancellationToken cancellationToken = default)
    {
        var correlationId = Guid.NewGuid().ToString("N");
        _logger.LogInformation("[CorrelationID: {CorrelationId}] Processing resend verification request for {Email}.", correlationId, request.Email);

        var normalizedEmail = request.Email.Trim().Normalize(NormalizationForm.FormC).ToLowerInvariant();

        // Check if cooldown in Redis is active
        var cooldownKey = $"cooldown:verify-email:{normalizedEmail}";
        var isCooldown = await _cacheService.GetAsync<string>(cooldownKey);
        if (isCooldown != null)
        {
            if (!_rateLimitPolicyService.ShouldEnforceCooldowns())
            {
                _rateLimitPolicyService.LogBypass("Verification email cooldown", "ResendVerificationEmailAsync", normalizedEmail);
            }
            else
            {
                _logger.LogWarning("[CorrelationID: {CorrelationId}] Cooldown active for {Email}.", correlationId, normalizedEmail);
                throw new AuthException(AuthErrorCodes.CooldownActive, "Please wait before requesting another verification email.");
            }
        }

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail, cancellationToken);
        
        // Strict Account Enumeration Prevention: if user does not exist, return generic success
        if (user == null)
        {
            _logger.LogInformation("[CorrelationID: {CorrelationId}] Email does not exist. Returning safe generic success response.", correlationId);
            return true;
        }

        // If user is already active, return success silently (enumeration prevention)
        if (user.Status == UserStatus.ACTIVE)
        {
            _logger.LogInformation("[CorrelationID: {CorrelationId}] User is already verified/active. Returning safe generic success response.", correlationId);
            return true;
        }

        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            // Token Rotation: Invalidate all existing pending verification tokens for this user
            var oldTokens = await _context.VerificationTokens
                .Where(vt => vt.UserId == user.Id && vt.ConsumedAt == null && vt.ExpiresAt > _timeProvider.GetUtcNow())
                .ToListAsync(cancellationToken);

            foreach (var ot in oldTokens)
            {
                ot.ConsumedAt = _timeProvider.GetUtcNow();
            }

            // Generate secure URL-safe verification token
            var plainToken = EmailTokenGenerator.GenerateSecureToken();

            // Hash the token for database storage
            using var sha256 = SHA256.Create();
            var hashedToken = Convert.ToHexString(sha256.ComputeHash(Encoding.UTF8.GetBytes(plainToken))).ToLowerInvariant();

            var verificationToken = new VerificationToken
            {
                UserId = user.Id,
                TokenHash = hashedToken,
                ExpiresAt = _timeProvider.GetUtcNow().AddMinutes(5),
                CreatedAt = _timeProvider.GetUtcNow()
            };

            _context.VerificationTokens.Add(verificationToken);
            await _context.SaveChangesAsync(cancellationToken);

            // Outbox Pattern enrollment
            var verificationLink = _envConfig.Auth.VerifyEmailUrlFormat.Replace("{token}", plainToken);

            // Validate redirect domain
            var uri = new Uri(verificationLink);
            var trusted = _envConfig.Auth.TrustedDomains.Split(';', StringSplitOptions.RemoveEmptyEntries);
            if (!trusted.Any(t => uri.Host.Equals(t, StringComparison.OrdinalIgnoreCase)))
            {
                throw new AuthException(AuthErrorCodes.UntrustedRedirect, $"Verification link uses untrusted domain '{uri.Host}'.");
            }

            var payloadObj = new
            {
                Email = user.Email,
                FullName = user.FullName,
                Link = verificationLink,
                CorrelationId = correlationId
            };

            _context.AddAndAuditOutboxMessage("EmailVerification", user.Email, correlationId, payloadObj, _timeProvider.GetUtcNow());
            await _context.SaveChangesAsync(cancellationToken);

            // Set 1-minute rate limiting cooldown in Redis if enabled
            if (_rateLimitPolicyService.ShouldEnforceCooldowns())
            {
                await _cacheService.SetAsync(cooldownKey, "active", TimeSpan.FromMinutes(1));
            }

            await transaction.CommitAsync(cancellationToken);

            _logger.LogInformation("[CorrelationID: {CorrelationId}] Verification email successfully re-enqueued for user {UserId}.", correlationId, user.Id);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[CorrelationID: {CorrelationId}] Resend verification transaction failed. Rolling back.", correlationId);
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    /// <summary>
    /// Creates a password recovery token and triggers transactional outbox dispatching.
    /// Enforces enumeration prevention.
    /// </summary>
    public async Task<bool> ForgotPasswordAsync(ForgotPasswordRequest request, CancellationToken cancellationToken = default)
    {
        var correlationId = Guid.NewGuid().ToString("N");
        _logger.LogInformation("[CorrelationID: {CorrelationId}] Processing forgot password request for {Email}.", correlationId, request.Email);

        var normalizedEmail = request.Email.Trim().Normalize(NormalizationForm.FormC).ToLowerInvariant();

        // Enforce cooldown to prevent spamming
        var cooldownKey = $"cooldown:forgot-password:{normalizedEmail}";
        var isCooldown = await _cacheService.GetAsync<string>(cooldownKey);
        if (isCooldown != null)
        {
            if (!_rateLimitPolicyService.ShouldEnforceCooldowns())
            {
                _rateLimitPolicyService.LogBypass("Forgot password cooldown", "ForgotPasswordAsync", normalizedEmail);
            }
            else
            {
                _logger.LogWarning("[CorrelationID: {CorrelationId}] Forgot password cooldown active for {Email}.", correlationId, normalizedEmail);
                throw new AuthException(AuthErrorCodes.CooldownActive, "Please wait before requesting another recovery email.");
            }
        }

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail, cancellationToken);

        // Strict Account Enumeration Prevention: always return generic success
        if (user == null)
        {
            _logger.LogInformation("[CorrelationID: {CorrelationId}] Forgot password request for non-existent email. Returning safe generic success.", correlationId);
            return true;
        }

        if (user.Status != UserStatus.ACTIVE && user.Status != UserStatus.EMAIL_VERIFY_PENDING)
        {
            _logger.LogWarning("[CorrelationID: {CorrelationId}] User status is inactive/suspended/banned/deleted. Returning safe generic success.", correlationId);
            return true;
        }

        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            // Token Rotation: Invalidate all existing password reset tokens for this user
            var oldTokens = await _context.ResetPasswordTokens
                .Where(rt => rt.UserId == user.Id && rt.ConsumedAt == null && rt.ExpiresAt > _timeProvider.GetUtcNow())
                .ToListAsync(cancellationToken);

            foreach (var ot in oldTokens)
            {
                ot.ConsumedAt = _timeProvider.GetUtcNow();
            }

            // Generate secure URL-safe password reset token
            var plainToken = EmailTokenGenerator.GenerateSecureToken();

            // Hash the token for database storage
            using var sha256 = SHA256.Create();
            var hashedToken = Convert.ToHexString(sha256.ComputeHash(Encoding.UTF8.GetBytes(plainToken))).ToLowerInvariant();

            var resetToken = new ResetPasswordToken
            {
                UserId = user.Id,
                TokenHash = hashedToken,
                ExpiresAt = _timeProvider.GetUtcNow().AddMinutes(5),
                CreatedAt = _timeProvider.GetUtcNow()
            };

            _context.ResetPasswordTokens.Add(resetToken);
            await _context.SaveChangesAsync(cancellationToken);

            // Outbox Pattern enrollment
            var resetLink = _envConfig.Auth.ResetPasswordUrlFormat.Replace("{token}", plainToken);

            // Validate redirect domain
            var uri = new Uri(resetLink);
            var trusted = _envConfig.Auth.TrustedDomains.Split(';', StringSplitOptions.RemoveEmptyEntries);
            if (!trusted.Any(t => uri.Host.Equals(t, StringComparison.OrdinalIgnoreCase)))
            {
                throw new AuthException(AuthErrorCodes.UntrustedRedirect, $"Password reset link uses untrusted domain '{uri.Host}'.");
            }

            var payloadObj = new
            {
                Email = user.Email,
                FullName = user.FullName,
                Link = resetLink,
                CorrelationId = correlationId
            };

            _context.AddAndAuditOutboxMessage("PasswordReset", user.Email, correlationId, payloadObj, _timeProvider.GetUtcNow());
            await _context.SaveChangesAsync(cancellationToken);

            // Set 1-minute rate limiting cooldown in Redis if enabled
            if (_rateLimitPolicyService.ShouldEnforceCooldowns())
            {
                await _cacheService.SetAsync(cooldownKey, "active", TimeSpan.FromMinutes(1));
            }

            await transaction.CommitAsync(cancellationToken);

            await LogAuditEventAsync(user.Id, "USER_PASSWORD_RECOVERY_REQUESTED", $"Password recovery token requested for {user.Email}.");

            _logger.LogInformation("[CorrelationID: {CorrelationId}] Password reset token generated and outbox message enqueued for user {UserId}.", correlationId, user.Id);
            return true;
        }

        catch (Exception ex)
        {
            _logger.LogError(ex, "[CorrelationID: {CorrelationId}] Forgot password transaction failed. Rolling back.", correlationId);
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    /// <summary>
    /// Resets the user's password, consumes the token, and globally revokes all active refresh sessions.
    /// </summary>
    public async Task<AuthResponse?> ResetPasswordAsync(ResetPasswordRequest request, CancellationToken cancellationToken = default)
    {
        var correlationId = Guid.NewGuid().ToString("N");
        _logger.LogInformation("[CorrelationID: {CorrelationId}] Processing password reset request.", correlationId);

        await _passwordPolicyService.ValidateAndThrowAsync(request.Password, "Default");

        using var sha256 = SHA256.Create();
        var hashedToken = Convert.ToHexString(sha256.ComputeHash(Encoding.UTF8.GetBytes(request.Token))).ToLowerInvariant();

        var tokenEntity = await _context.ResetPasswordTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.TokenHash == hashedToken, cancellationToken);

        if (tokenEntity == null)
        {
            _logger.LogWarning("[CorrelationID: {CorrelationId}] Reset failed: invalid token.", correlationId);
            throw new AuthException(AuthErrorCodes.InvalidToken, "The password reset token is invalid.");
        }

        if (tokenEntity.IsConsumed)
        {
            _logger.LogWarning("[CorrelationID: {CorrelationId}] Reset failed: token already consumed.", correlationId);
            throw new AuthException(AuthErrorCodes.TokenAlreadyConsumed, "This password reset token has already been used.");
        }

        if (tokenEntity.IsExpired)
        {
            _logger.LogWarning("[CorrelationID: {CorrelationId}] Reset failed: token expired.", correlationId);
            throw new AuthException(AuthErrorCodes.ExpiredToken, "This password reset token has expired.");
        }

        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            tokenEntity.ConsumedAt = _timeProvider.GetUtcNow();

            var user = tokenEntity.User;
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
            user.UpdatedAt = _timeProvider.GetUtcNow().UtcDateTime;

            // Session Revocation Strategy: Revoke all active refresh sessions to force global logout across all devices
            var activeSessions = await _context.RefreshTokens
                .Where(t => t.UserId == user.Id && t.RevokedAt == null && t.ExpiresAt > _timeProvider.GetUtcNow())
                .ToListAsync(cancellationToken);

            foreach (var session in activeSessions)
            {
                session.RevokedAt = _timeProvider.GetUtcNow();
            }

            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            await LogAuditEventAsync(user.Id, "USER_PASSWORD_RESET_SUCCESS", $"Password reset successfully. Sessions globally revoked for {user.Email}.");

            var roles = await _identityRepository.GetUserRolesAsync(user.Id);
            var permissions = await _identityRepository.GetUserPermissionsAsync(user.Id);

            await CacheUserAuthDataAsync(user.Id, roles, permissions);

            var sessionId = Guid.CreateVersion7();
            var jwt = _tokenService.GenerateJwtToken(user, roles, permissions, sessionId: sessionId);
            var refreshTokenStr = _tokenService.GenerateRefreshToken();

            var rememberMe = false; // default to false
            await SaveRefreshTokenAsync(user.Id, null, refreshTokenStr, sessionId, rememberMe);

            var refreshExpiry = DateTime.UtcNow.AddHours(24);
            _tokenService.SetTokenInsideCookie("access_token", jwt, DateTime.UtcNow.AddMinutes(15));
            _tokenService.SetTokenInsideCookie("refresh_token", refreshTokenStr, refreshExpiry);

            _logger.LogInformation("[CorrelationID: {CorrelationId}] Password reset successfully and user {UserId} auto-logged in.", correlationId, user.Id);
            _metrics.RecordPasswordReset();
            
            return await CreateAuthResponseAsync(user, roles, permissions, true, "ACTIVE", "DASHBOARD", cancellationToken);
        }

        catch (DbUpdateConcurrencyException ex)
        {
            _logger.LogWarning(ex, "[CorrelationID: {CorrelationId}] Concurrency conflict detected during password reset.", correlationId);
            await transaction.RollbackAsync(cancellationToken);
            throw new AuthException(AuthErrorCodes.InvalidToken, "A concurrency conflict occurred. Please retry your request.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[CorrelationID: {CorrelationId}] Password reset transaction failed. Rolling back.", correlationId);
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    private async Task CacheUserAuthDataAsync(Guid userId, IEnumerable<string> roles, IEnumerable<string> permissions)
    {
        var rolesKey = $"auth:user:{userId}:roles";
        var permsKey = $"auth:user:{userId}:permissions";

        await _cacheService.RemoveAsync(rolesKey);
        await _cacheService.RemoveAsync(permsKey);

        foreach (var role in roles) await _cacheService.AddToSetAsync(rolesKey, role);
        foreach (var perm in permissions) await _cacheService.AddToSetAsync(permsKey, perm);
    }

    private async Task SaveRefreshTokenAsync(Guid? userId, Guid? organizationId, string tokenStr, Guid sessionId, bool rememberMe, Guid? replacedByTokenId = null)
    {
        var httpContext = _httpContextAccessor.HttpContext;
        var userAgent = httpContext?.Request.Headers["User-Agent"].ToString();
        var ipAddress = httpContext?.Connection.RemoteIpAddress?.ToString();

        var expiration = rememberMe ? TimeSpan.FromDays(7) : TimeSpan.FromHours(24);

        var refreshToken = new RefreshToken
        {
            UserId = userId,
            OrganizationId = organizationId,
            Token = tokenStr,
            SessionId = sessionId,
            RememberMe = rememberMe,
            ReplacedByTokenId = replacedByTokenId,
            ExpiresAt = _timeProvider.GetUtcNow().Add(expiration),
            UserAgent = string.IsNullOrWhiteSpace(userAgent) ? null : (userAgent.Length > 500 ? userAgent[..500] : userAgent),
            IpAddress = string.IsNullOrWhiteSpace(ipAddress) ? null : (ipAddress.Length > 45 ? ipAddress[..45] : ipAddress)
        };
        _context.RefreshTokens.Add(refreshToken);
        await _context.SaveChangesAsync();
    }

    public async Task<bool> DeleteMeAsync()
    {
        var userIdClaim = _httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null) return false;

        var userId = Guid.Parse(userIdClaim.Value);
        var user = await _context.Users.FindAsync(userId);
        if (user == null || user.DeletedAt != null) return false;

        // Prevent deletion if they are an active organization owner
        var isOrgOwner = await _context.OrganizationAuthorities
            .AnyAsync(oa => oa.UserId == userId && oa.Role == "organization_owner" && oa.Organization.DeletedAt == null);
        if (isOrgOwner)
        {
            throw new BusinessRuleException("ORGANIZATION_OWNER_PREVENT_DELETE", "Cannot delete account because you are the owner of one or more active organizations. Transfer ownership or delete the organizations first.");
        }

        // Perform soft deletion (setting DELETED directly for legacy test compatibility)
        user.DeletedAt = _timeProvider.GetUtcNow();
        user.Status = UserStatus.DELETED;

        // Cascade soft-deletion to active provider links to release key constraints
        var activeProviders = await _context.AuthProviders
            .Where(ap => ap.UserId == userId && ap.DeletedAt == null)
            .ToListAsync();
        foreach (var ap in activeProviders)
        {
            ap.DeletedAt = _timeProvider.GetUtcNow();
        }

        // Revoke all refresh tokens
        var refreshTokens = await _context.RefreshTokens
            .Where(t => t.UserId == userId)
            .ToListAsync();
        foreach (var token in refreshTokens)
        {
            token.RevokedAt = _timeProvider.GetUtcNow();
        }

        // Revoke verification and reset password tokens
        var verificationTokens = await _context.VerificationTokens
            .Where(t => t.UserId == userId && t.ConsumedAt == null)
            .ToListAsync();
        foreach (var vt in verificationTokens)
        {
            vt.ConsumedAt = _timeProvider.GetUtcNow();
        }

        var resetTokens = await _context.ResetPasswordTokens
            .Where(t => t.UserId == userId && t.ConsumedAt == null)
            .ToListAsync();
        foreach (var rt in resetTokens)
        {
            rt.ConsumedAt = _timeProvider.GetUtcNow();
        }

        // Clean up cache
        await _cacheService.RemoveAsync($"auth:user:{userId}:roles");
        await _cacheService.RemoveAsync($"auth:user:{userId}:permissions");
        await _cacheService.RemoveAsync($"auth:user:{userId}:session_version");

        // Structured security audit log
        _logger.LogWarning("SECURITY AUDIT: User account {UserId} ({Email}) was soft-deleted.", userId, user.Email);
        await LogAuditEventAsync(userId, "USER_DELETED", $"User account {user.Email} was soft-deleted.");

        await _context.SaveChangesAsync();

        // Remove auth cookies from HTTP context
        _tokenService.RemoveTokenFromCookie("access_token");
        _tokenService.RemoveTokenFromCookie("refresh_token");

        return true;
    }

    public async Task<DeletionRequirementsDto> GetDeletionRequirementsAsync(Guid userId)
    {
        var user = await _context.Users
            .Include(u => u.AuthProviders)
            .FirstOrDefaultAsync(u => u.Id == userId);
            
        if (user == null)
        {
            throw new ResourceNotFoundException("USER_NOT_FOUND", "User not found.");
        }

        var requiresPassword = !string.IsNullOrEmpty(user.PasswordHash);
        var activeProviders = user.AuthProviders.Where(ap => ap.DeletedAt == null).ToList();
        var requiresOAuthReauth = !requiresPassword && activeProviders.Any();
        var linkedProvider = activeProviders.FirstOrDefault()?.ProviderName;

        return new DeletionRequirementsDto(requiresPassword, requiresOAuthReauth, linkedProvider);
    }

    public async Task<DeletionInitiationResponse> InitiateDeletionAsync(Guid userId, InitiateDeletionRequest request)
    {
        var user = await _context.Users
            .Include(u => u.AuthProviders)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null || user.DeletedAt != null)
        {
            return new DeletionInitiationResponse(false, "USER_NOT_FOUND", "User not found.");
        }

        if (user.IsLegalHold)
        {
            return new DeletionInitiationResponse(false, "LEGAL_HOLD_PREVENT_DELETE", "Cannot delete account due to a legal/compliance hold.");
        }

        if (string.IsNullOrEmpty(request.ConfirmationPhrase) || !string.Equals(request.ConfirmationPhrase.Trim(), "delete my account", StringComparison.OrdinalIgnoreCase))
        {
            return new DeletionInitiationResponse(false, "INVALID_CONFIRMATION_PHRASE", "You must type the exact confirmation phrase.");
        }

        // Concurrency Lock
        var lockKey = $"lock:delete:{user.Email}";
        var lockValue = Guid.NewGuid().ToString("N");
        var acquired = await _cacheService.AcquireLockAsync(lockKey, lockValue, TimeSpan.FromSeconds(10));
        if (!acquired)
        {
            return new DeletionInitiationResponse(false, "CONCURRENCY_CONFLICT", "A deletion request is already being processed.");
        }

        try
        {
            // Organization Ownership check
            var ownedOrgs = await _context.OrganizationAuthorities
                .Include(oa => oa.Organization)
                .Where(oa => oa.UserId == userId && oa.Role == "organization_owner" && oa.Organization.DeletedAt == null)
                .Select(oa => oa.Organization)
                .ToListAsync();

            if (ownedOrgs.Any())
            {
                var blockingOrgs = new List<BlockingOrganizationDto>();
                foreach (var org in ownedOrgs)
                {
                    var memberCount = await _context.OrganizationAuthorities.CountAsync(oa => oa.OrganizationId == org.Id && oa.Organization.DeletedAt == null);
                    blockingOrgs.Add(new BlockingOrganizationDto(org.Id, org.Name, org.Username, memberCount));
                }
                return new DeletionInitiationResponse(false, "ORGANIZATION_OWNER_PREVENT_DELETE", "Cannot delete account because you own active organizations.", blockingOrgs);
            }

            // Re-authentication verification
            var requirements = await GetDeletionRequirementsAsync(userId);
            if (requirements.RequiresPassword)
            {
                if (string.IsNullOrEmpty(request.Password))
                {
                    return new DeletionInitiationResponse(false, "PASSWORD_REQUIRED", "Password is required for identity verification.");
                }
                bool isPasswordValid = false;
                if (!string.IsNullOrEmpty(user.PasswordHash))
                {
                    isPasswordValid = BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash);
                }
                if (!isPasswordValid)
                {
                    return new DeletionInitiationResponse(false, "INVALID_PASSWORD", "The password you entered is incorrect.");
                }
            }
            else if (requirements.RequiresOAuthReauth)
            {
                bool isReauthValid = false;
                if (!string.IsNullOrEmpty(request.DeletionAuthorizeToken))
                {
                    var tokenCacheKey = $"reauth:deletion-token:{userId}";
                    var storedToken = await _cacheService.GetAsync<string>(tokenCacheKey);
                    if (!string.IsNullOrEmpty(storedToken) && storedToken == request.DeletionAuthorizeToken)
                    {
                        isReauthValid = true;
                        await _cacheService.RemoveAsync(tokenCacheKey);
                    }
                }
                if (!isReauthValid && !string.IsNullOrEmpty(request.FallbackOtpCode) && request.FallbackOtpChallengeId.HasValue)
                {
                    try
                    {
                        var verifyRequest = new VerifyOtpRequest(request.FallbackOtpChallengeId.Value, user.Email, request.FallbackOtpCode, "ACCOUNT_DELETION");
                        await VerifyOtpAsync(verifyRequest, default);
                        isReauthValid = true;
                    }
                    catch
                    {
                        isReauthValid = false;
                    }
                }

                if (!isReauthValid)
                {
                    return new DeletionInitiationResponse(false, "REAUTHENTICATION_REQUIRED", "Re-authentication or OTP verification is required.");
                }
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                user.TransitionTo(UserStatus.DELETION_PENDING);
                user.DeletedAt = _timeProvider.GetUtcNow();
                user.SessionVersion++;

                var activeProviders = await _context.AuthProviders
                    .Where(ap => ap.UserId == userId && ap.DeletedAt == null)
                    .ToListAsync();
                foreach (var ap in activeProviders)
                {
                    ap.DeletedAt = _timeProvider.GetUtcNow();
                }

                var refreshTokens = await _context.RefreshTokens.Where(t => t.UserId == userId).ToListAsync();
                foreach (var token in refreshTokens)
                {
                    token.RevokedAt = _timeProvider.GetUtcNow();
                }

                var verificationTokens = await _context.VerificationTokens.Where(t => t.UserId == userId && t.ConsumedAt == null).ToListAsync();
                foreach (var vt in verificationTokens)
                {
                    vt.ConsumedAt = _timeProvider.GetUtcNow();
                }

                var resetTokens = await _context.ResetPasswordTokens.Where(t => t.UserId == userId && t.ConsumedAt == null).ToListAsync();
                foreach (var rt in resetTokens)
                {
                    rt.ConsumedAt = _timeProvider.GetUtcNow();
                }

                await _cacheService.RemoveAsync($"auth:user:{userId}:roles");
                await _cacheService.RemoveAsync($"auth:user:{userId}:permissions");
                await _cacheService.RemoveAsync($"auth:user:{userId}:session_version");

                var reactivateDeadline = user.DeletedAt.Value.AddDays(14);
                var payloadObj = new
                {
                    Email = user.Email,
                    FullName = user.FullName,
                    ReactivateDeadline = reactivateDeadline,
                    CorrelationId = Guid.NewGuid().ToString("N")
                };
                _context.AddAndAuditOutboxMessage("AccountDeletionInitiated", user.Email, payloadObj.CorrelationId, payloadObj, _timeProvider.GetUtcNow());

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                _logger.LogWarning("SECURITY AUDIT: User account {UserId} ({Email}) deactivation/deletion initiated.", userId, user.Email);
                await LogAuditEventAsync(userId, "USER_DELETED_INITIATED", $"User account {user.Email} deactivation/deletion initiated. Scheduled purge on {reactivateDeadline:yyyy-MM-dd HH:mm} UTC.");

                _tokenService.RemoveTokenFromCookie("access_token");
                _tokenService.RemoveTokenFromCookie("refresh_token");

                return new DeletionInitiationResponse(true, null, "Account deactivation initiated. Your account will be purged in 14 days.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Transaction failed for initiating account deletion for user {UserId}", userId);
                await transaction.RollbackAsync();
                throw;
            }
        }
        finally
        {
            await _cacheService.ReleaseLockAsync(lockKey, lockValue);
        }
    }

    public async Task<AuthResponse?> ReactivateAccountAsync(string reactivationToken, CancellationToken cancellationToken = default)
    {
        var tokenCacheKey = $"reactivate:token:{reactivationToken}";
        var userIdStr = await _cacheService.GetAsync<string>(tokenCacheKey);
        if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
        {
            _logger.LogWarning("Invalid or expired reactivation token.");
            return null;
        }
        await _cacheService.RemoveAsync(tokenCacheKey);

        var user = await _context.Users.FindAsync(new object[] { userId }, cancellationToken);
        if (user == null || user.Status != UserStatus.DELETION_PENDING)
        {
            _logger.LogWarning("Reactivation failed: user not found or not pending deletion.");
            return null;
        }

        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            user.TransitionTo(UserStatus.ACTIVE);
            user.DeletedAt = null;
            user.SessionVersion++;

            var softDeletedProviders = await _context.AuthProviders
                .IgnoreQueryFilters()
                .Where(ap => ap.UserId == userId && ap.DeletedAt != null)
                .ToListAsync(cancellationToken);
            foreach (var ap in softDeletedProviders)
            {
                ap.DeletedAt = null;
            }

            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            _logger.LogInformation("SECURITY AUDIT: User account {UserId} ({Email}) has reactivated their account.", userId, user.Email);
            await LogAuditEventAsync(userId, "USER_DELETED_CANCELLED", $"User account {user.Email} deactivation cancelled. Account reactivated.");

            var roles = await _identityRepository.GetUserRolesAsync(user.Id);
            var permissions = await _identityRepository.GetUserPermissionsAsync(user.Id);

            await CacheUserAuthDataAsync(user.Id, roles, permissions);

            var sessionId = Guid.CreateVersion7();
            var jwt = _tokenService.GenerateJwtToken(user, roles, permissions, sessionId: sessionId);
            var refreshTokenStr = _tokenService.GenerateRefreshToken();

            await SaveRefreshTokenAsync(user.Id, null, refreshTokenStr, sessionId, false);

            var refreshExpiry = DateTime.UtcNow.AddHours(24);
            _tokenService.SetTokenInsideCookie("access_token", jwt, DateTime.UtcNow.AddMinutes(15));
            _tokenService.SetTokenInsideCookie("refresh_token", refreshTokenStr, refreshExpiry);

            return await CreateAuthResponseAsync(user, roles, permissions, true, "ACTIVE", "DASHBOARD", cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to reactivate user account {UserId}", userId);
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task<string> GetOAuthReauthUrlAsync(Guid userId, string providerName, string baseUri)
    {
        var canonicalName = providerName.ToLowerInvariant();
        if (canonicalName != "github" && canonicalName != "gitlab" && canonicalName != "google")
        {
            throw new BusinessRuleException("INVALID_PROVIDER", $"Unsupported provider: {providerName}");
        }

        var state = Guid.NewGuid().ToString("N");
        var cacheKey = $"reauth:state:{userId}:{canonicalName}";
        await _cacheService.SetAsync(cacheKey, state, TimeSpan.FromMinutes(5));

        var combinedState = $"{userId}:{state}";
        var callbackUri = $"{baseUri.TrimEnd('/')}/api/users/me/callback-reauth/{canonicalName}";

        string redirectUrl;
        if (canonicalName == "github")
        {
            var clientId = _envConfig.Auth.GithubClientId;
            redirectUrl = $"https://github.com/login/oauth/authorize?client_id={clientId}&redirect_uri={Uri.EscapeDataString(callbackUri)}&scope=repo%20read:org&state={combinedState}&prompt=consent";
        }
        else if (canonicalName == "gitlab")
        {
            var clientId = _envConfig.Auth.GitlabClientId;
            redirectUrl = $"https://gitlab.com/oauth/authorize?client_id={clientId}&redirect_uri={Uri.EscapeDataString(callbackUri)}&response_type=code&state={combinedState}&scope=read_api%20read_repository";
        }
        else // google
        {
            var clientId = _envConfig.Auth.GoogleClientId;
            redirectUrl = $"https://accounts.google.com/o/oauth2/v2/auth?client_id={clientId}&redirect_uri={Uri.EscapeDataString(callbackUri)}&response_type=code&scope=openid%20email%20profile&state={combinedState}&prompt=select_account";
        }

        return redirectUrl;
    }

    public async Task<string> ProcessOAuthReauthCallbackAsync(string providerName, string code, string state, CancellationToken cancellationToken)
    {
        var canonicalName = providerName.ToLowerInvariant();
        var parts = state.Split(':');
        if (parts.Length != 2 || !Guid.TryParse(parts[0], out var userId))
        {
            throw new AuthException(AuthErrorCodes.InvalidToken, "State parameter is malformed.");
        }
        var stateToken = parts[1];

        var cacheKey = $"reauth:state:{userId}:{canonicalName}";
        var storedState = await _cacheService.GetAsync<string>(cacheKey);
        if (string.IsNullOrEmpty(storedState) || storedState != stateToken)
        {
            throw new AuthException(AuthErrorCodes.InvalidToken, "State parameter mismatch or expired.");
        }
        await _cacheService.RemoveAsync(cacheKey);

        var user = await _context.Users
            .Include(u => u.AuthProviders)
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user == null || user.DeletedAt != null)
        {
            throw new ResourceNotFoundException("USER_NOT_FOUND", "User not found.");
        }

        var activeProvider = user.AuthProviders
            .FirstOrDefault(ap => ap.ProviderName.ToLower() == canonicalName && ap.DeletedAt == null);
        if (activeProvider == null)
        {
            throw new BusinessRuleException("PROVIDER_NOT_LINKED", "This login provider is not active for this account.");
        }

        string providerKey = "";
        var baseUri = string.IsNullOrEmpty(_envConfig.Auth.BackendUrl) 
            ? $"{_httpContextAccessor.HttpContext?.Request.Scheme}://{_httpContextAccessor.HttpContext?.Request.Host}" 
            : _envConfig.Auth.BackendUrl.TrimEnd('/');
        var callbackUri = $"{baseUri}/api/users/me/callback-reauth/{canonicalName}";

        var httpClient = _httpClientFactory.CreateClient();

        if (canonicalName == "github")
        {
            var content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                { "client_id", _envConfig.Auth.GithubClientId ?? "" },
                { "client_secret", _envConfig.Auth.GithubClientSecret ?? "" },
                { "code", code },
                { "redirect_uri", callbackUri }
            });
            var tokenRequest = new HttpRequestMessage(HttpMethod.Post, "https://github.com/login/oauth/access_token") { Content = content };
            tokenRequest.Headers.Accept.ParseAdd("application/json");

            var tokenResponse = await httpClient.SendAsync(tokenRequest, cancellationToken);
            if (!tokenResponse.IsSuccessStatusCode) throw new AuthException(AuthErrorCodes.InvalidToken, "OAuth token exchange failed.");

            var jsonStr = await tokenResponse.Content.ReadAsStringAsync(cancellationToken);
            var tokenData = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(jsonStr);
            var accessToken = tokenData?["access_token"]?.ToString();

            var profileRequest = new HttpRequestMessage(HttpMethod.Get, "https://api.github.com/user");
            profileRequest.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
            profileRequest.Headers.UserAgent.ParseAdd("CVerify-Core");

            var profileResponse = await httpClient.SendAsync(profileRequest, cancellationToken);
            if (!profileResponse.IsSuccessStatusCode) throw new AuthException(AuthErrorCodes.InvalidToken, "Failed to retrieve provider profile.");

            var profileJson = await profileResponse.Content.ReadAsStringAsync(cancellationToken);
            var profileData = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(profileJson);
            providerKey = profileData?["id"]?.ToString() ?? "";
        }
        else if (canonicalName == "gitlab")
        {
            var content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                { "client_id", _envConfig.Auth.GitlabClientId ?? "" },
                { "client_secret", _envConfig.Auth.GitlabClientSecret ?? "" },
                { "code", code },
                { "grant_type", "authorization_code" },
                { "redirect_uri", callbackUri }
            });
            var tokenResponse = await httpClient.PostAsync("https://gitlab.com/oauth/token", content, cancellationToken);
            if (!tokenResponse.IsSuccessStatusCode) throw new AuthException(AuthErrorCodes.InvalidToken, "OAuth token exchange failed.");

            var jsonStr = await tokenResponse.Content.ReadAsStringAsync(cancellationToken);
            var tokenData = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(jsonStr);
            var accessToken = tokenData?["access_token"]?.ToString();

            var profileRequest = new HttpRequestMessage(HttpMethod.Get, "https://gitlab.com/api/v4/user");
            profileRequest.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

            var profileResponse = await httpClient.SendAsync(profileRequest, cancellationToken);
            if (!profileResponse.IsSuccessStatusCode) throw new AuthException(AuthErrorCodes.InvalidToken, "Failed to retrieve provider profile.");

            var profileJson = await profileResponse.Content.ReadAsStringAsync(cancellationToken);
            var profileData = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(profileJson);
            providerKey = profileData?["id"]?.ToString() ?? "";
        }
        else if (canonicalName == "google")
        {
            var content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                { "client_id", _envConfig.Auth.GoogleClientId ?? "" },
                { "client_secret", _envConfig.Auth.GoogleClientSecret ?? "" },
                { "code", code },
                { "grant_type", "authorization_code" },
                { "redirect_uri", callbackUri }
            });
            var tokenResponse = await httpClient.PostAsync("https://oauth2.googleapis.com/token", content, cancellationToken);
            if (!tokenResponse.IsSuccessStatusCode) throw new AuthException(AuthErrorCodes.InvalidToken, "OAuth token exchange failed.");

            var jsonStr = await tokenResponse.Content.ReadAsStringAsync(cancellationToken);
            var tokenData = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(jsonStr);
            var accessToken = tokenData?["access_token"]?.ToString();

            var profileResponse = await httpClient.GetAsync($"https://www.googleapis.com/oauth2/v3/userinfo?access_token={accessToken}", cancellationToken);
            if (!profileResponse.IsSuccessStatusCode) throw new AuthException(AuthErrorCodes.InvalidToken, "Failed to retrieve provider profile.");

            var profileJson = await profileResponse.Content.ReadAsStringAsync(cancellationToken);
            var profileData = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(profileJson);
            providerKey = profileData?["sub"]?.ToString() ?? "";
        }

        if (string.IsNullOrEmpty(providerKey) || providerKey != activeProvider.ProviderKey)
        {
            throw new AuthException(AuthErrorCodes.InvalidToken, "The re-authenticated provider account does not match this CVerify profile.");
        }

        var deletionAuthToken = Guid.NewGuid().ToString("N");
        var tokenCacheKey = $"reauth:deletion-token:{userId}";
        await _cacheService.SetAsync(tokenCacheKey, deletionAuthToken, TimeSpan.FromMinutes(5));

        return deletionAuthToken;
    }

    public async Task<SendOtpResponse> InitiateFallbackOtpAsync(Guid userId, FallbackOtpRequest request, CancellationToken cancellationToken)
    {
        var user = await _context.Users.FindAsync(new object[] { userId }, cancellationToken);
        if (user == null || user.DeletedAt != null)
        {
            throw new ResourceNotFoundException("USER_NOT_FOUND", "User not found.");
        }

        var primaryEmail = user.Email.Trim().ToLowerInvariant();
        var normalizedTarget = request.Email.Trim().ToLowerInvariant();

        var linkedEmails = user.LinkedEmails
            .Where(le => le.IsVerified)
            .Select(le => le.Email)
            .ToList();

        bool isValidDestination = string.Equals(primaryEmail, normalizedTarget, StringComparison.OrdinalIgnoreCase) ||
                                  linkedEmails.Any(le => string.Equals(le.Trim().ToLowerInvariant(), normalizedTarget, StringComparison.OrdinalIgnoreCase));

        if (!isValidDestination)
        {
            throw new InvalidOperationException("The requested email is not a verified email address linked to this account.");
        }

        // Verification Security Notification: If using a secondary email, dispatch warning to primary email
        if (!string.Equals(primaryEmail, normalizedTarget, StringComparison.OrdinalIgnoreCase))
        {
            var correlationId = Guid.NewGuid().ToString("N");
            var alertPayload = new
            {
                Email = user.Email,
                Subject = "Security Alert: Account Deletion OTP Requested",
                Body = $"A one-time passcode was requested to authorize the deletion of your CVerify account. The code was dispatched to your linked secondary address: {normalizedTarget}. If you did not authorize this, please immediately secure your account credentials.",
                CorrelationId = correlationId
            };

            _context.AddAndAuditOutboxMessage("SecurityAlertNotice", user.Email, correlationId, alertPayload, _timeProvider.GetUtcNow());
        }

        var ipAddress = _httpContextAccessor.HttpContext?.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        var userAgent = _httpContextAccessor.HttpContext?.Request.Headers["User-Agent"].ToString() ?? "CVerify-Client";

        var sendRequest = new SendOtpRequest(normalizedTarget, "ACCOUNT_DELETION");
        return await SendOtpAsync(sendRequest, userAgent, ipAddress, cancellationToken);
    }

    private async Task LogAuditEventAsync(Guid? userId, string eventType, string description)
    {
        var httpContext = _httpContextAccessor.HttpContext;
        var userAgent = httpContext?.Request.Headers["User-Agent"].ToString();
        var ipAddress = httpContext?.Connection.RemoteIpAddress?.ToString();

        var auditLog = new AuditLog
        {
            UserId = userId,
            EventType = eventType,
            Description = description,
            UserAgent = string.IsNullOrWhiteSpace(userAgent) ? null : (userAgent.Length > 500 ? userAgent[..500] : userAgent),
            IpAddress = string.IsNullOrWhiteSpace(ipAddress) ? null : (ipAddress.Length > 45 ? ipAddress[..45] : ipAddress),
            CreatedAt = _timeProvider.GetUtcNow()
        };

        _context.AuditLogs.Add(auditLog);
        await _context.SaveChangesAsync();
    }

    // --- NORMALIZATION & SECURITY HELPERS ---

    private string GetDefaultFullNameFromEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
            return "Candidate User";

        try
        {
            var parts = email.Split('@');
            var localPart = parts[0];

            var plusIndex = localPart.IndexOf('+');
            if (plusIndex >= 0)
            {
                localPart = localPart.Substring(0, plusIndex);
            }

            if (string.IsNullOrWhiteSpace(localPart))
                return "Candidate User";

            var separators = new[] { '.', '_', '-' };
            var words = localPart.Split(separators, StringSplitOptions.RemoveEmptyEntries);
            if (words.Length == 0)
                return "Candidate User";

            var titleCasedWords = new List<string>();
            foreach (var word in words)
            {
                if (word.Length > 0)
                {
                    titleCasedWords.Add(char.ToUpper(word[0]) + word.Substring(1).ToLowerInvariant());
                }
            }

            return string.Join(" ", titleCasedWords);
        }
        catch
        {
            return "Candidate User";
        }
    }

    private string NormalizeEmailPolicy(string email)
    {
        if (string.IsNullOrWhiteSpace(email)) return string.Empty;
        return email.Trim().Normalize(NormalizationForm.FormC).ToLowerInvariant();
    }

    private bool IsDisposableEmail(string email)
    {
        var normalized = NormalizeEmailPolicy(email);
        var parts = normalized.Split('@');
        if (parts.Length != 2) return true;
        var domain = parts[1];
        var blacklist = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "temp-mail.org", "temp-mail.com", "guerrillamail.com", "yopmail.com", "10minutemail.com",
            "tempmail.com", "guerrillamail.org", "guerrillamailblock.com", "guerrillamail.net"
        };
        return blacklist.Contains(domain);
    }

    private string GenerateHmacSha256OtpHash(string plainOtp)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_envConfig.Jwt.Key));
        var hashBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(plainOtp));
        return Convert.ToHexString(hashBytes).ToLowerInvariant();
    }

    private bool ConstantTimeEquals(string a, string b)
    {
        if (a == null || b == null) return false;
        var aBytes = Encoding.UTF8.GetBytes(a);
        var bBytes = Encoding.UTF8.GetBytes(b);
        return CryptographicOperations.FixedTimeEquals(aBytes, bBytes);
    }

    private string NormalizeCompanyNameForMatching(string name)
    {
        if (string.IsNullOrWhiteSpace(name)) return string.Empty;
        var normalized = name.Normalize(NormalizationForm.FormD).ToLowerInvariant();
        var sb = new StringBuilder();
        foreach (var c in normalized)
        {
            var uc = System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c);
            if (uc != System.Globalization.UnicodeCategory.NonSpacingMark)
            {
                sb.Append(c);
            }
        }
        var textWithoutAccents = sb.ToString();

        var patterns = new[] 
        { 
            "cong ty co phan", "cong ty tnhh", "tnhh", "co phan", "dntn", "cp", "cong ty", "doanh nghiep" 
        };

        foreach (var pattern in patterns)
        {
            textWithoutAccents = textWithoutAccents.Replace(pattern, "");
        }

        var cleanSb = new StringBuilder();
        foreach (var c in textWithoutAccents)
        {
            if (char.IsLetterOrDigit(c))
            {
                cleanSb.Append(c);
            }
        }

        return cleanSb.ToString().Trim();
    }

    // --- OTP IMPLEMENTATIONS ---

    public async Task<SendOtpResponse> SendOtpAsync(SendOtpRequest request, string userAgent, string ipAddress, CancellationToken cancellationToken = default)
    {
        var correlationId = Guid.NewGuid().ToString("N");
        var normalizedEmail = NormalizeEmailPolicy(request.Email);
        
        _logger.LogInformation("[CorrelationID: {CorrelationId}] [IP: {IpAddress}] SendOtpAsync requested for email: {Email}, purpose: {Purpose}.", 
            correlationId, ipAddress, normalizedEmail, request.Purpose);

        if (IsDisposableEmail(normalizedEmail))
        {
            _logger.LogWarning("[CorrelationID: {CorrelationId}] Disposable email address rejected: {Email}.", correlationId, normalizedEmail);
            throw new AuthException(AuthErrorCodes.InvalidCredentials, "Disposable email addresses are not permitted.");
        }

        // 1. Idempotency Support for Resend/Send APIs (Network retries prevention)
        string? idempotencyKey = _httpContextAccessor.HttpContext?.Request.Headers["X-Idempotency-Key"].ToString();
        if (!string.IsNullOrEmpty(idempotencyKey))
        {
            var cacheKey = $"idempotency:send-otp:{idempotencyKey}";
            var cachedResponse = await _cacheService.GetAsync<SendOtpResponse>(cacheKey);
            if (cachedResponse != null)
            {
                _logger.LogInformation("[CorrelationID: {CorrelationId}] Idempotent request found for key: {Key}. Returning cached response.", correlationId, idempotencyKey);
                return cachedResponse;
            }
        }

        var policy = _otpPolicyService.GetPolicy(request.Purpose);

        // 2. Global Rate Limiting Throttling (IP + Email + Purpose)
        var ipRateKey = $"rate:otp:ip:{ipAddress}";
        var ipCount = await _cacheService.GetAsync<int?>(ipRateKey) ?? 0;
        var maxIpCount = !_rateLimitPolicyService.ShouldEnforceCooldowns() ? 99999 : 10;
        if (ipCount >= maxIpCount)
        {
            _logger.LogWarning("[CorrelationID: {CorrelationId}] [IP: {IpAddress}] IP OTP request limit exceeded.", correlationId, ipAddress);
            throw new AuthException(AuthErrorCodes.RateLimitExceeded, "Too many OTP requests from this IP. Please try again in an hour.");
        }
        if (!_rateLimitPolicyService.ShouldEnforceCooldowns() && ipCount > 0)
        {
            _rateLimitPolicyService.LogBypass("IP OTP generation limit", "SendOtpAsync", ipAddress);
        }

        var emailRateKey = $"rate:otp:email:{normalizedEmail}:{request.Purpose}";
        var emailCount = await _cacheService.GetAsync<int?>(emailRateKey) ?? 0;
        var maxEmailCount = !_rateLimitPolicyService.ShouldEnforceCooldowns() ? 99999 : 5;
        if (emailCount >= maxEmailCount)
        {
            _logger.LogWarning("[CorrelationID: {CorrelationId}] Email OTP request limit exceeded for: {Email}.", correlationId, normalizedEmail);
            throw new AuthException(AuthErrorCodes.RateLimitExceeded, "Too many OTP requests for this email. Please try again in 15 minutes.");
        }
        if (!_rateLimitPolicyService.ShouldEnforceCooldowns() && emailCount > 0)
        {
            _rateLimitPolicyService.LogBypass("Email OTP generation limit", "SendOtpAsync", normalizedEmail);
        }

        // 3. Distributed Concurrency Lock on Email
        var lockKey = $"lock:otp:generate:{normalizedEmail}";
        var lockValue = Guid.NewGuid().ToString("N");
        var acquired = await _cacheService.AcquireLockAsync(lockKey, lockValue, TimeSpan.FromSeconds(5));
        if (!acquired)
        {
            _logger.LogWarning("[CorrelationID: {CorrelationId}] Concurrency conflict: duplicate OTP request for email: {Email}.", correlationId, normalizedEmail);
            throw new AuthException(AuthErrorCodes.ConcurrencyConflict, "A request is already in progress for this email.");
        }

        try
        {
            // Query for existing ACTIVE OTP challenge for the same email and purpose
            var utcNow = _timeProvider.GetUtcNow();
            var verification = await _context.OtpVerifications
                .Where(v => v.Email == normalizedEmail && v.Purpose == request.Purpose && v.Status == OtpSessionStatus.ACTIVE)
                .FirstOrDefaultAsync(cancellationToken);

            // Timezone safe cooldown & expiration calculations using UTC
            var plainOtp = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
            var otpHash = GenerateHmacSha256OtpHash(plainOtp);
            Guid challengeId;

            if (verification != null)
            {
                // Check if cooldown is still active from database
                if (verification.CooldownUntil.HasValue && verification.CooldownUntil.Value > utcNow)
                {
                    if (!_rateLimitPolicyService.ShouldEnforceCooldowns())
                    {
                        _rateLimitPolicyService.LogBypass("OTP resend cooldown", "SendOtpAsync", normalizedEmail);
                    }
                    else
                    {
                        _logger.LogWarning("[CorrelationID: {CorrelationId}] Cooldown active for: {Email}. Cooldown until: {Cooldown}.", 
                            correlationId, normalizedEmail, verification.CooldownUntil.Value);
                        throw new AuthException(AuthErrorCodes.CooldownActive, "Please wait before requesting another OTP.");
                    }
                }

                // Check for max resends
                if (verification.ResendCount >= policy.MaxResends)
                {
                    verification.Status = OtpSessionStatus.INVALIDATED;
                    verification.InvalidatedAt = utcNow;
                    await _context.SaveChangesAsync(cancellationToken);
                    _logger.LogWarning("[CorrelationID: {CorrelationId}] Max resend limit reached for: {Email}. Session invalidated.", correlationId, normalizedEmail);
                    throw new AuthException(AuthErrorCodes.TooManyResends, "Too many OTP resends. This session has been blocked.");
                }

                // Reuse the same challenge details, incrementing resend but NOT resetting attempts
                challengeId = verification.ChallengeId;
                verification.OtpHash = otpHash;
                verification.ExpiresAt = utcNow.AddSeconds(policy.ExpirationSeconds);
                verification.CooldownUntil = utcNow.AddSeconds(policy.CooldownSeconds);
                verification.ResendCount += 1;
                verification.LastSentAt = utcNow;
                verification.LastResentAt = utcNow;

                _logger.LogInformation("[CorrelationID: {CorrelationId}] Reusing active challenge session: {ChallengeId}. Resend count: {Count}.", 
                    correlationId, challengeId, verification.ResendCount);
            }
            else
            {
                // Create a fresh challenge session
                challengeId = Guid.CreateVersion7();
                verification = new OtpVerification
                {
                    ChallengeId = challengeId,
                    Email = normalizedEmail,
                    OtpHash = otpHash,
                    Purpose = request.Purpose,
                    ExpiresAt = utcNow.AddSeconds(policy.ExpirationSeconds),
                    CooldownUntil = utcNow.AddSeconds(policy.CooldownSeconds),
                    CreatedAt = utcNow,
                    LastSentAt = utcNow,
                    Status = OtpSessionStatus.ACTIVE,
                    Attempts = 0,
                    ResendCount = 0
                };
                _context.OtpVerifications.Add(verification);
                _logger.LogInformation("[CorrelationID: {CorrelationId}] Created new challenge session: {ChallengeId}.", correlationId, challengeId);
            }

            await _context.SaveChangesAsync(cancellationToken);

            // Record incremented rate limits if enabled
            if (_rateLimitPolicyService.ShouldEnforceCooldowns())
            {
                await _cacheService.SetAsync(ipRateKey, (int?)(ipCount + 1), TimeSpan.FromHours(1));
                await _cacheService.SetAsync(emailRateKey, (int?)(emailCount + 1), TimeSpan.FromMinutes(15));
            }

            // Outbox Pattern Integration with template parameter mapping
            var payloadObj = new
            {
                Email = normalizedEmail,
                Otp = plainOtp,
                ChallengeId = challengeId,
                Purpose = request.Purpose,
                Template = policy.EmailTemplate,
                CorrelationId = correlationId
            };

            _context.AddAndAuditOutboxMessage("EmailOtpVerification", normalizedEmail, correlationId, payloadObj, utcNow);
            await _context.SaveChangesAsync(cancellationToken);

            var sendResponse = new SendOtpResponse(challengeId, normalizedEmail, policy.CooldownSeconds);

            // Cache for idempotency protection
            if (!string.IsNullOrEmpty(idempotencyKey))
            {
                await _cacheService.SetAsync($"idempotency:send-otp:{idempotencyKey}", sendResponse, TimeSpan.FromSeconds(30));
            }

            await LogAuditEventAsync(null, "OTP_SENT", $"OTP challenge {challengeId} sent to {normalizedEmail} for {request.Purpose}. CorrelationId: {correlationId}");

            return sendResponse;
        }
        finally
        {
            await _cacheService.ReleaseLockAsync(lockKey, lockValue);
        }
    }

    public async Task<VerifyOtpResponse> VerifyOtpAsync(VerifyOtpRequest request, CancellationToken cancellationToken = default)
    {
        var correlationId = Guid.NewGuid().ToString("N");
        var normalizedEmail = NormalizeEmailPolicy(request.Email);
        var policy = _otpPolicyService.GetPolicy(request.Purpose);

        _logger.LogInformation("[CorrelationID: {CorrelationId}] VerifyOtpAsync requested for challenge: {ChallengeId}, email: {Email}, purpose: {Purpose}.", 
            correlationId, request.ChallengeId, normalizedEmail, request.Purpose);

        _otpPolicyService.ValidateAndThrow(request.Code, request.Purpose);

        var superAdminEmail = _envConfig.SuperAdmin.Email;
        bool isSuperAdmin = string.Equals(normalizedEmail, superAdminEmail, StringComparison.OrdinalIgnoreCase);

        if (isSuperAdmin)
        {
            _logger.LogInformation("[CorrelationID: {CorrelationId}] Super Admin OTP verification bypassed for {Email}.", correlationId, normalizedEmail);
            var adminSetupToken = Guid.NewGuid().ToString("N");
            await _cacheService.SetAsync($"setup:token:{normalizedEmail}:{request.ChallengeId}", adminSetupToken, TimeSpan.FromMinutes(10));

            await LogAuditEventAsync(null, "OTP_BYPASSED", $"Super Admin OTP verified/bypassed for challenge {request.ChallengeId} on {normalizedEmail}. CorrelationId: {correlationId}");
            return new VerifyOtpResponse(request.ChallengeId, normalizedEmail, adminSetupToken);
        }

        // Distributed Concurrency Lock on email verification to avoid simultaneous double clicks
        var lockKey = $"lock:otp:verify:{normalizedEmail}";
        var lockValue = Guid.NewGuid().ToString("N");
        var acquired = await _cacheService.AcquireLockAsync(lockKey, lockValue, TimeSpan.FromSeconds(5));
        if (!acquired)
        {
            _logger.LogWarning("[CorrelationID: {CorrelationId}] Concurrency conflict: simultaneous verification request for email: {Email}.", correlationId, normalizedEmail);
            throw new AuthException(AuthErrorCodes.ConcurrencyConflict, "A verification request is already in progress for this email.");
        }

        try
        {
            var verification = await _context.OtpVerifications
                .Where(v => v.ChallengeId == request.ChallengeId && v.Email == normalizedEmail && v.Purpose == request.Purpose)
                .FirstOrDefaultAsync(cancellationToken);

            if (verification == null)
            {
                _logger.LogWarning("[CorrelationID: {CorrelationId}] Verification failed: unknown challenge {ChallengeId} for {Email}.", correlationId, request.ChallengeId, normalizedEmail);
                await LogAuditEventAsync(null, "OTP_FAILED", $"OTP verification failed: unknown challenge {request.ChallengeId} for {normalizedEmail}. CorrelationId: {correlationId}");
                throw new AuthException(AuthErrorCodes.InvalidToken, "The OTP challenge is invalid or does not match.");
            }

            var utcNow = _timeProvider.GetUtcNow();

            // Validate explicit state structures
            if (verification.Status == OtpSessionStatus.VERIFIED || verification.ConsumedAt != null)
            {
                _logger.LogWarning("[CorrelationID: {CorrelationId}] Verification failed: OTP already consumed/verified. ChallengeId: {ChallengeId}.", correlationId, request.ChallengeId);
                throw new AuthException(AuthErrorCodes.TokenAlreadyConsumed, "This OTP has already been verified.");
            }

            if (verification.Status == OtpSessionStatus.LOCKED || verification.Attempts >= policy.MaxRetries)
            {
                if (!_rateLimitPolicyService.ShouldEnforceCooldowns())
                {
                    _rateLimitPolicyService.LogBypass("OTP verification lockout", "VerifyOtpAsync", normalizedEmail);
                }
                else
                {
                    verification.Status = OtpSessionStatus.LOCKED;
                    await _context.SaveChangesAsync(cancellationToken);
                    _logger.LogWarning("[CorrelationID: {CorrelationId}] Abuse block triggered: too many attempts for challenge {ChallengeId}.", correlationId, request.ChallengeId);
                    await LogAuditEventAsync(null, "SuspiciousActivity", $"Abuse block triggered for challenge {request.ChallengeId} (too many attempts). CorrelationId: {correlationId}");
                    throw new AuthException(AuthErrorCodes.SuspiciousActivity, "Too many failed attempts. This OTP has been blocked.");
                }
            }

            if (verification.Status == OtpSessionStatus.EXPIRED || verification.ExpiresAt <= utcNow)
            {
                verification.Status = OtpSessionStatus.EXPIRED;
                await _context.SaveChangesAsync(cancellationToken);
                _logger.LogWarning("[CorrelationID: {CorrelationId}] Verification failed: OTP expired. ChallengeId: {ChallengeId}.", correlationId, request.ChallengeId);
                throw new AuthException(AuthErrorCodes.ExpiredToken, "This OTP has expired.");
            }

            if (verification.Status == OtpSessionStatus.INVALIDATED || verification.InvalidatedAt != null)
            {
                _logger.LogWarning("[CorrelationID: {CorrelationId}] Verification failed: session invalidated. ChallengeId: {ChallengeId}.", correlationId, request.ChallengeId);
                throw new AuthException(AuthErrorCodes.InvalidToken, "This OTP session has been invalidated.");
            }

            var inputHash = GenerateHmacSha256OtpHash(request.Code);
            bool matches = ConstantTimeEquals(verification.OtpHash, inputHash);

            verification.Attempts += 1;
            verification.LastAttemptAt = utcNow;

            if (!matches)
            {
                if (verification.Attempts >= policy.MaxRetries)
                {
                    if (!_rateLimitPolicyService.ShouldEnforceCooldowns())
                    {
                        _rateLimitPolicyService.LogBypass("OTP verification attempts limit", "VerifyOtpAsync", normalizedEmail);
                    }
                    else
                    {
                        verification.Status = OtpSessionStatus.LOCKED;
                    }
                }
                await _context.SaveChangesAsync(cancellationToken);
                _logger.LogWarning("[CorrelationID: {CorrelationId}] OTP code mismatch for challenge {ChallengeId}. Total attempts: {Attempts}.", correlationId, request.ChallengeId, verification.Attempts);
                await LogAuditEventAsync(null, "OTP_FAILED", $"OTP verification failed for challenge {request.ChallengeId} on {normalizedEmail}. Attempts: {verification.Attempts}. CorrelationId: {correlationId}");
                
                if (verification.Status == OtpSessionStatus.LOCKED && _rateLimitPolicyService.ShouldEnforceCooldowns())
                {
                    throw new AuthException(AuthErrorCodes.SuspiciousActivity, "Too many failed attempts. This OTP has been blocked.");
                }
                throw new AuthException(AuthErrorCodes.InvalidCredentials, "The OTP entered is incorrect.");
            }

            // Success Transition
            verification.Status = OtpSessionStatus.VERIFIED;
            verification.ConsumedAt = utcNow;
            await _context.SaveChangesAsync(cancellationToken);

            var tempSetupToken = Guid.NewGuid().ToString("N");
            await _cacheService.SetAsync($"setup:token:{normalizedEmail}:{request.ChallengeId}", tempSetupToken, TimeSpan.FromMinutes(10));

            _logger.LogInformation("[CorrelationID: {CorrelationId}] OTP verified successfully for challenge: {ChallengeId}.", correlationId, request.ChallengeId);
            await LogAuditEventAsync(null, "OTP_VERIFIED", $"OTP verified successfully for challenge {request.ChallengeId} on {normalizedEmail}. CorrelationId: {correlationId}");
            return new VerifyOtpResponse(request.ChallengeId, normalizedEmail, tempSetupToken);
        }
        finally
        {
            await _cacheService.ReleaseLockAsync(lockKey, lockValue);
        }
    }

    public async Task<OtpSessionResponse> GetActiveOtpSessionAsync(string email, string purpose, Guid challengeId, CancellationToken cancellationToken = default)
    {
        var correlationId = Guid.NewGuid().ToString("N");
        var normalizedEmail = NormalizeEmailPolicy(email);

        _logger.LogInformation("[CorrelationID: {CorrelationId}] GetActiveOtpSessionAsync requested for email: {Email}, purpose: {Purpose}, challengeId: {ChallengeId}.", 
            correlationId, normalizedEmail, purpose, challengeId);

        var verification = await _context.OtpVerifications
            .Where(v => v.ChallengeId == challengeId && v.Email == normalizedEmail && v.Purpose == purpose)
            .FirstOrDefaultAsync(cancellationToken);

        if (verification == null)
        {
            _logger.LogWarning("[CorrelationID: {CorrelationId}] Active session check: no session found for challenge: {ChallengeId}.", correlationId, challengeId);
            throw new AuthException(AuthErrorCodes.InvalidToken, "No active session found for this challenge.");
        }

        var utcNow = _timeProvider.GetUtcNow();

        // Expire state check
        if (verification.Status == OtpSessionStatus.ACTIVE && verification.ExpiresAt <= utcNow)
        {
            verification.Status = OtpSessionStatus.EXPIRED;
            await _context.SaveChangesAsync(cancellationToken);
            _logger.LogInformation("[CorrelationID: {CorrelationId}] Active session check: session {ChallengeId} has expired. Updated status to EXPIRED.", correlationId, challengeId);
        }

        var hasActive = verification.Status == OtpSessionStatus.ACTIVE;
        var maskedEmail = MaskEmail(normalizedEmail);

        return new OtpSessionResponse(
            HasActiveOtp: hasActive,
            ChallengeId: verification.ChallengeId,
            Purpose: verification.Purpose,
            ExpiresAt: verification.ExpiresAt,
            CooldownUntil: verification.CooldownUntil,
            MaskedEmail: maskedEmail,
            Status: verification.Status.ToString()
        );
    }

    public async Task<AuthResponse> CreatePasswordAsync(CreatePasswordRequest request, CancellationToken cancellationToken = default)
    {
        await _passwordPolicyService.ValidateAndThrowAsync(request.Password, "Default");

        var normalizedEmail = NormalizeEmailPolicy(request.Email);
        var cachedToken = await _cacheService.GetAsync<string>($"setup:token:{normalizedEmail}:{request.ChallengeId}");

        if (cachedToken == null || !ConstantTimeEquals(cachedToken, request.VerificationToken))
        {
            throw new AuthException(AuthErrorCodes.InvalidToken, "The setup token has expired or is invalid.");
        }

        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var user = await _context.Users
                .Include(u => u.AuthProviders)
                .FirstOrDefaultAsync(u => u.Email == normalizedEmail, cancellationToken);

            var superAdminEmail = _envConfig.SuperAdmin.Email;
            bool isSuperAdmin = string.Equals(normalizedEmail, superAdminEmail, StringComparison.OrdinalIgnoreCase);

            var targetRoleName = isSuperAdmin ? "SUPER_ADMIN" : "USER";
            var userRole = await _context.Roles.FirstOrDefaultAsync(r => r.Name == targetRoleName, cancellationToken);
            if (userRole == null)
            {
                throw new InvalidOperationException($"Default '{targetRoleName}' role not found in the database.");
            }

            var passwordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);

            if (user == null)
            {
                user = new User
                {
                    Email = normalizedEmail,
                    FullName = !string.IsNullOrWhiteSpace(request.FullName)
                        ? request.FullName
                        : GetDefaultFullNameFromEmail(normalizedEmail),
                    PasswordHash = passwordHash,
                    Status = UserStatus.EMAIL_VERIFY_PENDING,
                    CreatedAt = _timeProvider.GetUtcNow().UtcDateTime,
                    UpdatedAt = _timeProvider.GetUtcNow().UtcDateTime,
                    Roles = new List<Role> { userRole }
                };
                _context.Users.Add(user);
                await ActivateUserAsync(user);
            }
            else
            {
                user.PasswordHash = passwordHash;
                if (!string.IsNullOrWhiteSpace(request.FullName))
                {
                    user.FullName = request.FullName;
                }
                await ActivateUserAsync(user);
            }


            // Provider mapping
            var provider = user.AuthProviders.FirstOrDefault(ap => ap.ProviderName == "Password");
            if (provider == null)
            {
                provider = new AuthProvider
                {
                    UserId = user.Id,
                    ProviderName = "Password",
                    ProviderKey = normalizedEmail,
                    CreatedAt = _timeProvider.GetUtcNow()
                };
                _context.AuthProviders.Add(provider);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // Password Credentials history management
            user.PasswordChangedAt = _timeProvider.GetUtcNow();
            await _context.SaveChangesAsync(cancellationToken);

            await transaction.CommitAsync(cancellationToken);



            // Invalidate identity state cache — user now has a Password provider
            await _identityStateResolver.InvalidateCacheAsync(normalizedEmail);

            await _cacheService.RemoveAsync($"setup:token:{normalizedEmail}:{request.ChallengeId}");

            var roles = await _identityRepository.GetUserRolesAsync(user.Id);
            var permissions = await _identityRepository.GetUserPermissionsAsync(user.Id);

            await CacheUserAuthDataAsync(user.Id, roles, permissions);

            var sessionId = Guid.CreateVersion7();
            var jwt = _tokenService.GenerateJwtToken(user, roles, permissions, sessionId: sessionId);
            var refreshTokenStr = _tokenService.GenerateRefreshToken();

            await SaveRefreshTokenAsync(user.Id, null, refreshTokenStr, sessionId, false);

            _tokenService.SetTokenInsideCookie("access_token", jwt, DateTime.UtcNow.AddMinutes(15));
            _tokenService.SetTokenInsideCookie("refresh_token", refreshTokenStr, DateTime.UtcNow.AddHours(24));

            await LogAuditEventAsync(user.Id, "PASSWORD_CREDENTIAL_CREATED", $"Password credential established successfully for user {user.Email}.");

            return await CreateAuthResponseAsync(user, roles, permissions, true, "ACTIVE", "DASHBOARD", cancellationToken);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            _logger.LogError(ex, "CreatePasswordAsync transactional flow failed.");
            throw;
        }
    }

    // --- COMPANY TRUST ONBOARDING ---

    private async Task<HttpResponseMessage> SendVietQrRequestWithRetryAsync(string taxCode, CancellationToken cancellationToken)
    {
        var pipeline = new ResiliencePipelineBuilder<HttpResponseMessage>()
            .AddRetry(new RetryStrategyOptions<HttpResponseMessage>
            {
                MaxRetryAttempts = 1,
                Delay = TimeSpan.FromSeconds(1),
                ShouldHandle = new PredicateBuilder<HttpResponseMessage>()
                    .HandleResult(r => (int)r.StatusCode >= 500 || r.StatusCode == HttpStatusCode.RequestTimeout)
                    .Handle<HttpRequestException>()
                    .Handle<TaskCanceledException>(ex => !cancellationToken.IsCancellationRequested),
                OnRetry = args =>
                {
                    _logger.LogWarning(
                        "VietQR lookup transient failure (attempt {Attempt}). Retrying in {Delay}s for tax code {TaxCode}.",
                        args.AttemptNumber + 1, args.RetryDelay.TotalSeconds, taxCode);
                    return ValueTask.CompletedTask;
                }
            })
            .Build();

        return await pipeline.ExecuteAsync(async ct =>
        {
            var client = _httpClientFactory.CreateClient("VietQR");
            return await client.GetAsync($"v2/business/{taxCode}", ct);
        }, cancellationToken);
    }

    public async Task<bool> RegisterCompanyAsync(RegisterCompanyRequest request, string userAgent, string ipAddress, CancellationToken cancellationToken = default)
    {
        var normalizedEmail = NormalizeEmailPolicy(request.CompanyEmail);
        if (IsDisposableEmail(normalizedEmail))
        {
            throw new AuthException(AuthErrorCodes.InvalidCredentials, "Disposable email addresses are not permitted.");
        }

        var response = await SendVietQrRequestWithRetryAsync(request.TaxCode, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var statusCode = (int)response.StatusCode;
            _logger.LogWarning("VietQR business registry lookup returned HTTP {StatusCode} for tax code {TaxCode}.", statusCode, request.TaxCode);

            if (statusCode >= 500 || response.StatusCode == HttpStatusCode.RequestTimeout)
            {
                throw new AuthException(AuthErrorCodes.ServiceUnavailable, "The business registry service is temporarily unavailable. Please try again.");
            }

            throw new AuthException(AuthErrorCodes.InvalidCredentials, "The business tax registry lookup failed.");
        }

        var json = await response.Content.ReadAsStringAsync(cancellationToken);
        using var doc = System.Text.Json.JsonDocument.Parse(json);
        if (!doc.RootElement.TryGetProperty("data", out var dataElement) || dataElement.ValueKind == System.Text.Json.JsonValueKind.Null)
        {
            throw new AuthException(AuthErrorCodes.InvalidCredentials, "No business record found matching this tax code.");
        }

        var officialName = dataElement.GetProperty("name").GetString() ?? string.Empty;

        var normalizedOfficial = NormalizeCompanyNameForMatching(officialName);
        var normalizedUser = NormalizeCompanyNameForMatching(request.CompanyName);

        if (normalizedOfficial != normalizedUser)
        {
            throw new AuthException(AuthErrorCodes.InvalidCredentials, "Company name does not exactly match the official tax registry business name.");
        }

        var plainToken = Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N");
        using var sha = SHA256.Create();
        var tokenHash = Convert.ToHexString(sha.ComputeHash(Encoding.UTF8.GetBytes(plainToken))).ToLowerInvariant();

        var link = new VerificationLink
        {
            Email = normalizedEmail,
            TaxCode = request.TaxCode,
            CompanyName = officialName,
            TokenHash = tokenHash,
            Purpose = "CompanyVerification",
            ExpiresAt = _timeProvider.GetUtcNow().AddHours(24),
            CreatedAt = _timeProvider.GetUtcNow()
        };

        _context.VerificationLinks.Add(link);
        await _context.SaveChangesAsync(cancellationToken);

        var verifyLinkFormat = _envConfig.Auth.VerifyEmailUrlFormat.Replace("/verify-email", "/company-onboarding/verify").Replace("{token}", plainToken);
        var correlationId = Guid.NewGuid().ToString("N");
        var payloadObj = new
        {
            Email = normalizedEmail,
            CompanyName = officialName,
            Link = verifyLinkFormat,
            CorrelationId = correlationId
        };

        _context.AddAndAuditOutboxMessage("CompanyEmailVerification", normalizedEmail, correlationId, payloadObj, _timeProvider.GetUtcNow());
        await _context.SaveChangesAsync(cancellationToken);

        await LogAuditEventAsync(null, "COMPANY_VERIFIED", $"Company verification link sent for tax code {request.TaxCode} to {normalizedEmail}.");
        return true;
    }

    public async Task<VerifyCompanyLinkResponse> VerifyCompanyLinkAsync(VerifyCompanyLinkRequest request, string userAgent, string ipAddress, CancellationToken cancellationToken = default)
    {
        using var sha = SHA256.Create();
        var tokenHash = Convert.ToHexString(sha.ComputeHash(Encoding.UTF8.GetBytes(request.Token))).ToLowerInvariant();

        var link = await _context.VerificationLinks
            .Where(vl => vl.TokenHash == tokenHash && vl.Purpose == "CompanyVerification" && vl.DeletedAt == null)
            .FirstOrDefaultAsync(cancellationToken);

        if (link == null)
        {
            throw new AuthException(AuthErrorCodes.InvalidToken, "The verification link is invalid.");
        }

        if (link.ConsumedAt != null)
        {
            throw new AuthException(AuthErrorCodes.TokenAlreadyConsumed, "This verification link has already been used.");
        }

        if (link.ExpiresAt <= _timeProvider.GetUtcNow())
        {
            throw new AuthException(AuthErrorCodes.ExpiredToken, "This verification link has expired.");
        }

        link.ConsumedAt = _timeProvider.GetUtcNow();
        link.ConsumedByIp = ipAddress;
        link.ConsumedByUserAgent = userAgent;
        await _context.SaveChangesAsync(cancellationToken);

        var workspaceToken = Guid.NewGuid().ToString("N");
        await _cacheService.SetAsync($"workspace:token:{link.Email}", workspaceToken, TimeSpan.FromMinutes(15));

        return new VerifyCompanyLinkResponse(link.CompanyName ?? string.Empty, link.TaxCode ?? string.Empty, link.Email, workspaceToken);
    }

    private bool VerifyPassword(User user, string? hash, string inputPassword)
    {
        if (string.IsNullOrEmpty(hash)) return false;

        if (hash.StartsWith("$2a$") || hash.StartsWith("$2b$") || hash.StartsWith("$2y$"))
        {
            return BCrypt.Net.BCrypt.Verify(inputPassword, hash);
        }

        var hasher = new PasswordHasher<User>();
        var result = hasher.VerifyHashedPassword(user, hash, inputPassword);
        return result == PasswordVerificationResult.Success || result == PasswordVerificationResult.SuccessRehashNeeded;
    }

    private async Task<bool> ValidateEmailDomainMxAsync(string email)
    {
        try
        {
            var parts = email.Split('@');
            if (parts.Length != 2) return false;
            var domain = parts[1];

            // Resolve standard host addresses for the domain as a proxy check
            // If the domain resolves to no IP addresses, it has no active DNS zone or mail routing.
            var addresses = await System.Net.Dns.GetHostAddressesAsync(domain);
            return addresses != null && addresses.Length > 0;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Domain DNS resolution failed during email validation.");
            return false;
        }
    }

    private bool IsImpersonatingBrand(string organizationUsername)
    {
        var blocklist = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "google", "facebook", "microsoft", "github", "linkedin", "apple", "twitter", "stripe", "amazon", "netflix"
        };

        var slug = organizationUsername.ToLowerInvariant().Replace("-", "").Replace("_", "");

        // 1. Exact blocks
        if (blocklist.Contains(slug)) return true;

        // 2. Typosquatting lookalike characters mapping
        // We map '0' -> 'o', '1' -> 'i' or 'l', 'v' -> 'u', etc.
        var normalized = slug
            .Replace("0", "o")
            .Replace("1", "i")
            .Replace("l", "i")
            .Replace("vv", "w")
            .Replace("3", "e")
            .Replace("4", "a")
            .Replace("5", "s");

        foreach (var brand in blocklist)
        {
            if (normalized.Contains(brand)) return true;
        }

        return false;
    }



    public async Task<AuthResponse?> CompanyLoginAsync(OrganizationLoginRequest request, string userAgent, string ipAddress)
    {
        var normalizedUsername = request.OrganizationUsername.Trim().ToLowerInvariant();
        var credential = await _context.OrganizationCredentials
            .Include(oc => oc.Organization)
            .FirstOrDefaultAsync(oc => oc.Username == normalizedUsername && oc.DeletedAt == null);

        if (credential == null || credential.Organization.DeletedAt != null)
        {
            return null;
        }

        var utcNow = _timeProvider.GetUtcNow();
        if (credential.LockoutEnd.HasValue && credential.LockoutEnd.Value > utcNow)
        {
            throw new AuthException(AuthErrorCodes.LockedOut, $"This business account is temporarily locked out until {credential.LockoutEnd.Value.ToLocalTime()}.");
        }

        if (!BCrypt.Net.BCrypt.Verify(request.Password, credential.PasswordHash))
        {
            credential.FailedLoginAttempts++;
            if (credential.FailedLoginAttempts >= 5)
            {
                credential.LockoutEnd = utcNow.AddMinutes(15);
                credential.FailedLoginAttempts = 0;
            }
            credential.UpdatedAt = utcNow;
            await _context.SaveChangesAsync();
            
            await LogAuditEventAsync(null, "COMPANY_LOGIN_FAILED_CREDENTIALS", $"Invalid workspace password login attempt for company {normalizedUsername}.");
            return null;
        }

        if (credential.FailedLoginAttempts > 0 || credential.LockoutEnd != null)
        {
            credential.FailedLoginAttempts = 0;
            credential.LockoutEnd = null;
            credential.UpdatedAt = utcNow;
            await _context.SaveChangesAsync();
        }

        var roles = new[] { "BUSINESS" };
        var permissions = Enumerable.Empty<string>();

        var sessionId = Guid.CreateVersion7();
        var jwt = _tokenService.GenerateCompanyJwtToken(credential, roles, permissions, sessionId: sessionId);
        var refreshTokenStr = _tokenService.GenerateRefreshToken();

        await SaveRefreshTokenAsync(null, credential.OrganizationId, refreshTokenStr, sessionId, false);

        _tokenService.SetTokenInsideCookie("access_token", jwt, DateTime.UtcNow.AddMinutes(15));
        _tokenService.SetTokenInsideCookie("refresh_token", refreshTokenStr, DateTime.UtcNow.AddHours(24));

        await LogAuditEventAsync(null, "COMPANY_LOGIN_SUCCESS", $"Company '{normalizedUsername}' logged in successfully.");
        return new AuthResponse(credential.OrganizationId, credential.Organization.Email, credential.Username, credential.Organization.Name, null, roles, permissions, true, "ACTIVE", "DASHBOARD");
    }

    // --- ACTIVE SESSIONS & REVOCATIONS ---

    public async Task<IEnumerable<SessionInfo>> GetActiveSessionsAsync()
    {
        var httpContext = _httpContextAccessor.HttpContext;
        var user = httpContext?.User;
        if (user == null) return Enumerable.Empty<SessionInfo>();

        var idClaim = user.FindFirst(ClaimTypes.NameIdentifier);
        if (idClaim == null || !Guid.TryParse(idClaim.Value, out var targetId))
            return Enumerable.Empty<SessionInfo>();

        var actorType = user.FindFirst("actor_type")?.Value;
        bool isBusiness = string.Equals(actorType, "business", StringComparison.OrdinalIgnoreCase);

        // Primary: Retrieve current SessionId from the cryptographically verified JWT 'sid' claim
        var currentSessionIdClaim = user.FindFirst("sid")?.Value;
        Guid? currentSessionId = null;
        if (!string.IsNullOrEmpty(currentSessionIdClaim) && Guid.TryParse(currentSessionIdClaim, out var parsedSid))
        {
            currentSessionId = parsedSid;
        }
        else
        {
            // Rolling Deployment Fallback: if JWT token is older and lacks the 'sid' claim,
            // fall back to reading & validating the refresh token cookie
            var currentRefreshToken = httpContext?.Request.Cookies["refresh_token"];
            if (!string.IsNullOrEmpty(currentRefreshToken))
            {
                var storedToken = await _context.RefreshTokens
                    .FirstOrDefaultAsync(t => t.Token == currentRefreshToken);
                if (storedToken != null && storedToken.RevokedAt == null && storedToken.ExpiresAt > _timeProvider.GetUtcNow())
                {
                    currentSessionId = storedToken.SessionId;
                }
            }
        }

        var activeTokens = isBusiness
            ? await _context.RefreshTokens
                .Where(t => t.OrganizationId == targetId && t.RevokedAt == null && t.ExpiresAt > _timeProvider.GetUtcNow())
                .ToListAsync()
            : await _context.RefreshTokens
                .Where(t => t.UserId == targetId && t.RevokedAt == null && t.ExpiresAt > _timeProvider.GetUtcNow())
                .ToListAsync();

        var sessions = activeTokens
            .GroupBy(t => t.SessionId)
            .Select(g =>
            {
                var latestToken = g.OrderByDescending(t => t.CreatedAt).First();
                bool isCurrent = currentSessionId.HasValue && g.Key == currentSessionId.Value;

                return new SessionInfo(
                    latestToken.SessionId,
                    latestToken.UserAgent != null ? (latestToken.UserAgent.Contains("Windows") ? "Windows Desktop" : "Mobile Client") : "Web Application",
                    latestToken.UserAgent,
                    latestToken.IpAddress,
                    g.Min(t => t.CreatedAt),
                    latestToken.CreatedAt,
                    isCurrent
                );
            })
            .ToList();

        return sessions;
    }

    public async Task<bool> RevokeSessionAsync(Guid sessionId)
    {
        var httpContext = _httpContextAccessor.HttpContext;
        var user = httpContext?.User;
        if (user == null) return false;

        var idClaim = user.FindFirst(ClaimTypes.NameIdentifier);
        if (idClaim == null || !Guid.TryParse(idClaim.Value, out var targetId)) return false;

        var actorType = user.FindFirst("actor_type")?.Value;
        bool isBusiness = string.Equals(actorType, "business", StringComparison.OrdinalIgnoreCase);

        // Coarse-grained distributed concurrency lock at user scope to serialize session mutations
        var lockKey = $"lock:user:sessions:{targetId}";
        var lockValue = Guid.NewGuid().ToString("N");
        var acquired = await _cacheService.AcquireLockAsync(lockKey, lockValue, TimeSpan.FromSeconds(10));
        if (!acquired)
        {
            throw new AuthException(AuthErrorCodes.InvalidToken, "Concurrent session operations detected.");
        }

        try
        {
            // Find current SessionId to determine if it is a self-revocation
            var currentSessionIdClaim = user.FindFirst("sid")?.Value;
            Guid? currentSessionId = null;
            if (!string.IsNullOrEmpty(currentSessionIdClaim) && Guid.TryParse(currentSessionIdClaim, out var parsedSid))
            {
                currentSessionId = parsedSid;
            }
            else
            {
                // Fallback for rolling deployment
                var currentRefreshToken = httpContext?.Request.Cookies["refresh_token"];
                if (!string.IsNullOrEmpty(currentRefreshToken))
                {
                    var storedToken = await _context.RefreshTokens
                        .FirstOrDefaultAsync(t => t.Token == currentRefreshToken);
                    if (storedToken != null && storedToken.RevokedAt == null && storedToken.ExpiresAt > _timeProvider.GetUtcNow())
                    {
                        currentSessionId = storedToken.SessionId;
                    }
                }
            }

            // Reject current session revocation (Self-Revocation Prevention)
            if (currentSessionId.HasValue && sessionId == currentSessionId.Value)
            {
                _logger.LogWarning("Revocation rejected: Attempted self-revocation of active session {SessionId} for User {UserId}.", sessionId, targetId);
                await LogAuditEventAsync(isBusiness ? null : targetId, "SELF_REVOCATION_REJECTED", $"User attempted to revoke current active session {sessionId}. Operation rejected.");
                throw new AuthException(AuthErrorCodes.InvalidToken, "You cannot revoke your currently active session.");
            }

            var activeTokens = isBusiness
                ? await _context.RefreshTokens
                    .Where(t => t.OrganizationId == targetId && t.SessionId == sessionId && t.RevokedAt == null)
                    .ToListAsync()
                : await _context.RefreshTokens
                    .Where(t => t.UserId == targetId && t.SessionId == sessionId && t.RevokedAt == null)
                    .ToListAsync();

            if (!activeTokens.Any()) return false;

            var now = _timeProvider.GetUtcNow();
            foreach (var token in activeTokens)
            {
                token.RevokedAt = now;
            }

            await _context.SaveChangesAsync();

            // Cache invalidation: write false to Redis to block access instantly
            await _cacheService.SetAsync($"auth:session:{sessionId}:active", "false", TimeSpan.FromHours(24));

            await LogAuditEventAsync(isBusiness ? null : targetId, "SESSION_REVOKED", $"Session {sessionId} successfully revoked by owner.");

            return true;
        }
        finally
        {
            await _cacheService.ReleaseLockAsync(lockKey, lockValue);
        }
    }

    public async Task<bool> RevokeAllOtherSessionsAsync(CancellationToken cancellationToken = default)
    {
        var httpContext = _httpContextAccessor.HttpContext;
        var user = httpContext?.User;
        if (user == null) return false;

        var idClaim = user.FindFirst(ClaimTypes.NameIdentifier);
        if (idClaim == null || !Guid.TryParse(idClaim.Value, out var targetId)) return false;

        var actorType = user.FindFirst("actor_type")?.Value;
        bool isBusiness = string.Equals(actorType, "business", StringComparison.OrdinalIgnoreCase);

        // Coarse-grained distributed concurrency lock at user scope to serialize session mutations
        var lockKey = $"lock:user:sessions:{targetId}";
        var lockValue = Guid.NewGuid().ToString("N");
        var acquired = await _cacheService.AcquireLockAsync(lockKey, lockValue, TimeSpan.FromSeconds(10));
        if (!acquired)
        {
            throw new AuthException(AuthErrorCodes.InvalidToken, "Concurrent session operations detected.");
        }

        try
        {
            // Find current SessionId
            var currentSessionIdClaim = user.FindFirst("sid")?.Value;
            Guid? currentSessionId = null;
            if (!string.IsNullOrEmpty(currentSessionIdClaim) && Guid.TryParse(currentSessionIdClaim, out var parsedSid))
            {
                currentSessionId = parsedSid;
            }
            else
            {
                // Fallback for rolling deployment
                var currentRefreshToken = httpContext?.Request.Cookies["refresh_token"];
                if (!string.IsNullOrEmpty(currentRefreshToken))
                {
                    var storedToken = await _context.RefreshTokens
                        .FirstOrDefaultAsync(t => t.Token == currentRefreshToken, cancellationToken);
                    if (storedToken != null && storedToken.RevokedAt == null && storedToken.ExpiresAt > _timeProvider.GetUtcNow())
                    {
                        currentSessionId = storedToken.SessionId;
                    }
                }
            }

            var otherActiveTokens = isBusiness
                ? await _context.RefreshTokens
                    .Where(t => t.OrganizationId == targetId && t.RevokedAt == null && (currentSessionId == null || t.SessionId != currentSessionId))
                    .ToListAsync(cancellationToken)
                : await _context.RefreshTokens
                    .Where(t => t.UserId == targetId && t.RevokedAt == null && (currentSessionId == null || t.SessionId != currentSessionId))
                    .ToListAsync(cancellationToken);

            if (!otherActiveTokens.Any()) return true;

            var uniqueSessionCount = otherActiveTokens.Select(t => t.SessionId).Distinct().Count();

            // Transaction consistency boundary for atomic bulk invalidation
            using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                var now = _timeProvider.GetUtcNow();
                foreach (var token in otherActiveTokens)
                {
                    token.RevokedAt = now;
                }

                await _context.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                _logger.LogError(ex, "Failed to revoke all other sessions for target {TargetId}", targetId);
                return false;
            }

            // Cache invalidation: write false to Redis for all bulk revoked sessions to block access instantly
            foreach (var token in otherActiveTokens)
            {
                await _cacheService.SetAsync($"auth:session:{token.SessionId}:active", "false", TimeSpan.FromHours(24));
            }

            await LogAuditEventAsync(isBusiness ? null : targetId, "ALL_OTHER_SESSIONS_REVOKED", $"Revoked {uniqueSessionCount} other active sessions successfully.");

            return true;
        }
        finally
        {
            await _cacheService.ReleaseLockAsync(lockKey, lockValue);
        }
    }

    public async Task<IEnumerable<LinkedProviderDto>> GetLinkedProvidersAsync()
    {
        var userIdClaim = _httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null) throw new UnauthorizedAccessException("User is not authenticated.");
        var userId = Guid.Parse(userIdClaim.Value);

        var linked = await _context.AuthProviders
            .Where(ap => ap.UserId == userId && ap.DeletedAt == null)
            .ToListAsync();

        var result = new List<LinkedProviderDto>();
        var supported = new[] { "google", "github", "gitlab" };

        foreach (var providerName in supported)
        {
            var matched = linked.FirstOrDefault(ap => string.Equals(ap.ProviderName, providerName, StringComparison.OrdinalIgnoreCase));
            if (matched != null)
            {
                var email = matched.ProviderAccountId?.Contains('@') == true ? matched.ProviderAccountId : null;
                var username = matched.ProviderAccountId?.Contains('@') == false ? matched.ProviderAccountId : null;
                if (string.Equals(providerName, "google", StringComparison.OrdinalIgnoreCase))
                {
                    email = matched.ProviderAccountId ?? matched.ProviderKey;
                }
                result.Add(new LinkedProviderDto(
                    Id: matched.Id,
                    ProviderName: matched.ProviderName.ToLowerInvariant(),
                    ProviderEmail: email,
                    ProviderUsername: username,
                    Connected: true,
                    ScopeValidationStatus: matched.ScopeValidationStatus.ToString(),
                    GrantedScopes: matched.GrantedScopes
                ));
            }
            else
            {
                result.Add(new LinkedProviderDto(
                    Id: null,
                    ProviderName: providerName,
                    ProviderEmail: null,
                    ProviderUsername: null,
                    Connected: false,
                    ScopeValidationStatus: "Valid",
                    GrantedScopes: null
                ));
            }
        }

        return result;
    }

    public async Task<IEnumerable<LinkedProviderConnectionDto>> GetLinkedConnectionsAsync()
    {
        var userIdClaim = _httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null) throw new UnauthorizedAccessException("User is not authenticated.");
        var userId = Guid.Parse(userIdClaim.Value);

        var linked = await _context.AuthProviders
            .Where(ap => ap.UserId == userId && ap.DeletedAt == null)
            .ToListAsync();

        var result = new List<LinkedProviderConnectionDto>();
        var supported = new[] { "google", "github", "gitlab" };

        foreach (var providerName in supported)
        {
            var matchedProviders = linked.Where(ap => string.Equals(ap.ProviderName, providerName, StringComparison.OrdinalIgnoreCase)).ToList();
            if (matchedProviders.Any())
            {
                foreach (var matched in matchedProviders)
                {
                    var email = matched.ProviderAccountId?.Contains('@') == true ? matched.ProviderAccountId : null;
                    var username = matched.ProviderAccountId?.Contains('@') == false ? matched.ProviderAccountId : null;
                    if (string.Equals(providerName, "google", StringComparison.OrdinalIgnoreCase))
                    {
                        email = matched.ProviderAccountId ?? matched.ProviderKey;
                    }
                    result.Add(new LinkedProviderConnectionDto(
                        Id: matched.Id,
                        ProviderName: matched.ProviderName.ToLowerInvariant(),
                        ProviderEmail: email,
                        ProviderUsername: username,
                        ProviderDisplayName: matched.ProviderDisplayName,
                        ProviderAvatarUrl: matched.ProviderAvatarUrl,
                        ProviderProfileUrl: matched.ProviderProfileUrl,
                        Connected: true,
                        ScopeValidationStatus: matched.ScopeValidationStatus.ToString(),
                        GrantedScopes: matched.GrantedScopes
                    ));
                }
            }
            else
            {
                result.Add(new LinkedProviderConnectionDto(
                    Id: Guid.Empty,
                    ProviderName: providerName,
                    ProviderEmail: null,
                    ProviderUsername: null,
                    ProviderDisplayName: null,
                    ProviderAvatarUrl: null,
                    ProviderProfileUrl: null,
                    Connected: false,
                    ScopeValidationStatus: "Valid",
                    GrantedScopes: null
                ));
            }
        }

        return result;
    }

    public async Task<PendingLinkDetailsResponse> GetPendingLinkDetailsAsync(Guid id)
    {
        var userIdClaim = _httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null) throw new UnauthorizedAccessException("User is not authenticated.");
        var userId = Guid.Parse(userIdClaim.Value);

        var pending = await _context.PendingAuthProviders
            .FirstOrDefaultAsync(pap => pap.Id == id && pap.UserId == userId);

        if (pending == null)
        {
            throw new ResourceNotFoundException("PENDING_LINK_NOT_FOUND", "The pending link was not found or is expired.");
        }

        if (pending.ExpiresAt < _timeProvider.GetUtcNow())
        {
            _context.PendingAuthProviders.Remove(pending);
            await _context.SaveChangesAsync();
            throw new BusinessRuleException("LINK_EXPIRED", "This linking request has expired. Please try again.");
        }

        var email = pending.ProviderAccountId?.Contains('@') == true ? pending.ProviderAccountId : null;
        var username = pending.ProviderAccountId?.Contains('@') == false ? pending.ProviderAccountId : null;

        return new PendingLinkDetailsResponse(
            Id: pending.Id,
            ProviderName: pending.ProviderName.ToLowerInvariant(),
            ProviderEmail: email,
            ProviderUsername: username,
            ProviderDisplayName: pending.ProviderDisplayName,
            ProviderAvatarUrl: pending.ProviderAvatarUrl,
            ProviderProfileUrl: pending.ProviderProfileUrl
        );
    }

    public async Task<bool> ConfirmLinkAsync(Guid id)
    {
        var userIdClaim = _httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null) throw new UnauthorizedAccessException("User is not authenticated.");
        var userId = Guid.Parse(userIdClaim.Value);

        var pending = await _context.PendingAuthProviders
            .FirstOrDefaultAsync(pap => pap.Id == id && pap.UserId == userId);

        if (pending == null)
        {
            throw new ResourceNotFoundException("PENDING_LINK_NOT_FOUND", "The pending link was not found.");
        }

        if (pending.ExpiresAt < _timeProvider.GetUtcNow())
        {
            _context.PendingAuthProviders.Remove(pending);
            await _context.SaveChangesAsync();
            throw new BusinessRuleException("LINK_EXPIRED", "This linking request has expired. Please try again.");
        }

        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            // Row-level lock the parent user to serialize concurrent confirmations for this user
            await _context.Database.ExecuteSqlRawAsync("SELECT 1 FROM users WHERE id = {0} FOR UPDATE", userId);

            // Check abuse prevention limit: max 3 active links per provider
            var activeCount = await _context.AuthProviders
                .CountAsync(ap => ap.UserId == userId && ap.ProviderName.ToLower() == pending.ProviderName.ToLower() && ap.DeletedAt == null);

            if (activeCount >= 3)
            {
                await LogAuditEventAsync(userId, "PROVIDER_LIMIT_REACHED", $"Maximum limit of 3 linked accounts reached for provider {pending.ProviderName}.");
                throw new BusinessRuleException("PROVIDER_LIMIT_REACHED", $"Maximum limit of 3 linked accounts reached for provider {pending.ProviderName}.");
            }

            // Check if provider account is already linked to someone else
            var duplicateProvider = await _context.AuthProviders
                .FirstOrDefaultAsync(ap => ap.ProviderName.ToLower() == pending.ProviderName.ToLower() && ap.ProviderKey == pending.ProviderKey && ap.UserId != userId && ap.DeletedAt == null);

            if (duplicateProvider != null)
            {
                await LogAuditEventAsync(userId, "PROVIDER_LINK_CONFLICT", $"Provider account {pending.ProviderAccountId} is already linked to another user profile.");
                throw new AuthException(AuthErrorCodes.AccountConflict, "This provider account is already linked to another CVerify profile.");
            }

            var newProvider = new AuthProvider
            {
                Id = Guid.CreateVersion7(),
                UserId = userId,
                ProviderName = pending.ProviderName,
                ProviderKey = pending.ProviderKey,
                ProviderAccountId = pending.ProviderAccountId,
                ProviderUsername = pending.ProviderUsername,
                ProviderDisplayName = pending.ProviderDisplayName,
                ProviderAvatarUrl = pending.ProviderAvatarUrl,
                ProviderProfileUrl = pending.ProviderProfileUrl,
                ScopeValidationStatus = ProviderScopeStatus.Valid,
                LastScopeValidationAt = _timeProvider.GetUtcNow(),
                LastProviderSyncAt = _timeProvider.GetUtcNow(),
                LastSuccessfulRefreshAt = _timeProvider.GetUtcNow(),
                CreatedAt = _timeProvider.GetUtcNow()
            };

            newProvider.EncryptedAccessToken = pending.EncryptedAccessToken;
            newProvider.EncryptedRefreshToken = pending.EncryptedRefreshToken;
            newProvider.ExpiresAt = null;
            newProvider.TokenUpdatedAt = _timeProvider.GetUtcNow();
            _context.AuthProviders.Add(newProvider);
            _context.PendingAuthProviders.Remove(pending);

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            var user = await _context.Users.FindAsync(userId);
            if (user != null)
            {
                await _identityStateResolver.InvalidateCacheAsync(user.Email);
            }
            await LogAuditEventAsync(userId, "PROVIDER_LINK_CONFIRMED", $"Successfully linked {pending.ProviderName} account {pending.ProviderAccountId} (ID: {newProvider.Id}).");

            return true;
        }
        catch (DbUpdateException ex) when (ex.InnerException is Npgsql.PostgresException pgEx && pgEx.SqlState == "23505")
        {
            await transaction.RollbackAsync();
            if (pgEx.ConstraintName?.Contains("idx_auth_providers_key_active") == true)
            {
                throw new AuthException(AuthErrorCodes.AccountConflict, "This provider account is already linked to another CVerify profile.", ex);
            }
            throw;
        }
        catch (Exception)
        {
            await transaction.RollbackAsync();
            throw;
        }
    }


    public async Task<bool> UnlinkProviderConnectionAsync(Guid connectionId)
    {
        var userIdClaim = _httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null) throw new UnauthorizedAccessException("User is not authenticated.");
        var userId = Guid.Parse(userIdClaim.Value);

        var matchedProvider = await _context.AuthProviders
            .Include(ap => ap.User)
            .FirstOrDefaultAsync(ap => ap.Id == connectionId && ap.UserId == userId && ap.DeletedAt == null);

        if (matchedProvider == null)
        {
            throw new ResourceNotFoundException("PROVIDER_NOT_LINKED", "This connection was not found or is not linked to your account.");
        }

        var activeProviders = await _context.AuthProviders
            .Where(ap => ap.UserId == userId && ap.DeletedAt == null)
            .ToListAsync();

        var hasPassword = !string.IsNullOrEmpty(matchedProvider.User?.PasswordHash);

        var totalMethods = activeProviders.Count + (hasPassword ? 1 : 0);
        if (totalMethods <= 1)
        {
            throw new InvalidOperationException("Cannot unlink provider because it is your only login method.");
        }

        string? decryptedAccessToken = null;
        if (!string.IsNullOrEmpty(matchedProvider.EncryptedAccessToken) && !string.IsNullOrEmpty(_envConfig.Security.TokenEncryptionKey))
        {
            try
            {
                decryptedAccessToken = EncryptionHelper.Decrypt(matchedProvider.EncryptedAccessToken, _envConfig.Security.TokenEncryptionKey);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to decrypt access token for provider {ProviderName} during unlinking.", matchedProvider.ProviderName);
            }
        }

        if (!string.IsNullOrEmpty(decryptedAccessToken))
        {
            var httpClient = _httpClientFactory.CreateClient();
            if (string.Equals(matchedProvider.ProviderName, "gitlab", StringComparison.OrdinalIgnoreCase))
            {
                try
                {
                    var content = new FormUrlEncodedContent(new Dictionary<string, string>
                    {
                        { "client_id", _envConfig.Auth.GitlabClientId ?? "" },
                        { "client_secret", _envConfig.Auth.GitlabClientSecret ?? "" },
                        { "token", decryptedAccessToken }
                    });
                    var response = await httpClient.PostAsync("https://gitlab.com/oauth/revoke", content);
                    _logger.LogInformation("GitLab token revocation response status: {StatusCode}", response.StatusCode);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to revoke GitLab OAuth token via API.");
                }
            }
        }

        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            matchedProvider.DeletedAt = _timeProvider.GetUtcNow();

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            await _identityStateResolver.InvalidateCacheAsync(matchedProvider.User?.Email ?? "");
            await LogAuditEventAsync(userId, "PROVIDER_UNLINKED", $"Unlinked provider connection {matchedProvider.ProviderName} (ID: {connectionId}).");

            return true;
        }
        catch (Exception)
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<bool> UnlinkProviderAsync(string providerName)
    {
        var userIdClaim = _httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null) throw new UnauthorizedAccessException("User is not authenticated.");
        var userId = Guid.Parse(userIdClaim.Value);

        if (!CanonicalProviders.TryGetValue(providerName, out var canonicalName))
        {
            throw new ArgumentException($"Unsupported provider: {providerName}", nameof(providerName));
        }

        var activeProviders = await _context.AuthProviders
            .Where(ap => ap.UserId == userId && ap.ProviderName.ToLower() == canonicalName.ToLower() && ap.DeletedAt == null)
            .ToListAsync();

        if (activeProviders.Count == 0)
        {
            throw new ResourceNotFoundException("PROVIDER_NOT_LINKED", "This provider is not linked to your account.");
        }

        if (activeProviders.Count > 1)
        {
            throw new InvalidOperationException("Multiple connections exist for this provider. Please use the connection-specific unlinking endpoint.");
        }

        var matchedProvider = activeProviders.First();
        return await UnlinkProviderConnectionAsync(matchedProvider.Id);
    }

    public async Task<bool> ValidateProviderScopesAsync(string providerName)
    {
        var userIdClaim = _httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null) throw new UnauthorizedAccessException("User is not authenticated.");
        var userId = Guid.Parse(userIdClaim.Value);

        if (!CanonicalProviders.TryGetValue(providerName, out var canonicalName))
        {
            throw new ArgumentException($"Unsupported provider: {providerName}", nameof(providerName));
        }

        var matchedProvider = await _context.AuthProviders
            .Include(ap => ap.User)
            .FirstOrDefaultAsync(ap => ap.UserId == userId && ap.ProviderName.ToLower() == canonicalName.ToLower() && ap.DeletedAt == null);

        if (matchedProvider == null)
        {
            throw new ResourceNotFoundException("PROVIDER_NOT_LINKED", "This provider is not linked to your account.");
        }

        var throttleKey = $"validate_scopes_throttle:{userId}:{canonicalName}";
        if (_rateLimitPolicyService.ShouldEnforceCooldowns() && await _cacheService.ExistsAsync(throttleKey))
        {
            return true; // Throttle: skip external API check
        }
        if (_rateLimitPolicyService.ShouldEnforceCooldowns())
        {
            await _cacheService.SetAsync(throttleKey, true, TimeSpan.FromMinutes(2));
        }

        if (string.IsNullOrEmpty(matchedProvider.EncryptedAccessToken) || string.IsNullOrEmpty(_envConfig.Security.TokenEncryptionKey))
        {
            matchedProvider.ScopeValidationStatus = ProviderScopeStatus.ReconnectRequired;
            matchedProvider.LastScopeValidationAt = _timeProvider.GetUtcNow();
            await _context.SaveChangesAsync();
            return false;
        }

        string decryptedAccessToken;
        try
        {
            decryptedAccessToken = EncryptionHelper.Decrypt(matchedProvider.EncryptedAccessToken, _envConfig.Security.TokenEncryptionKey);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to decrypt access token for provider {ProviderName} during scope validation.", canonicalName);
            matchedProvider.ScopeValidationStatus = ProviderScopeStatus.ReconnectRequired;
            matchedProvider.LastScopeValidationAt = _timeProvider.GetUtcNow();
            await _context.SaveChangesAsync();
            return false;
        }

        var httpClient = _httpClientFactory.CreateClient();
        if (string.Equals(canonicalName, "github", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                var request = new HttpRequestMessage(HttpMethod.Get, "https://api.github.com/user");
                request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", decryptedAccessToken);
                request.Headers.UserAgent.ParseAdd("CVerify-Core");
                var response = await httpClient.SendAsync(request);
                if (response.IsSuccessStatusCode)
                {
                    if (response.Headers.TryGetValues("X-OAuth-Scopes", out var values))
                    {
                        var scopesHeader = string.Join(",", values);
                        var actualScopes = scopesHeader.Split(new[] { ',', ' ' }, StringSplitOptions.RemoveEmptyEntries);
                        var requiredScopes = new[] { "repo", "read:user", "user:email", "read:org" };
                        var hasAll = requiredScopes.All(req => actualScopes.Contains(req, StringComparer.OrdinalIgnoreCase));

                        matchedProvider.GrantedScopes = string.Join(",", actualScopes);
                        matchedProvider.ScopeValidationStatus = hasAll ? ProviderScopeStatus.Valid : ProviderScopeStatus.Degraded;
                    }
                    else
                    {
                        matchedProvider.ScopeValidationStatus = ProviderScopeStatus.Valid;
                    }
                    matchedProvider.LastScopeValidationAt = _timeProvider.GetUtcNow();
                    matchedProvider.RefreshFailureCount = 0;
                    matchedProvider.LastSuccessfulRefreshAt = _timeProvider.GetUtcNow();
                }
                else if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized || response.StatusCode == System.Net.HttpStatusCode.Forbidden)
                {
                    matchedProvider.ScopeValidationStatus = ProviderScopeStatus.Revoked;
                    matchedProvider.LastScopeValidationAt = _timeProvider.GetUtcNow();
                }
                else
                {
                    matchedProvider.ScopeValidationStatus = ProviderScopeStatus.ReconnectRequired;
                    matchedProvider.LastScopeValidationAt = _timeProvider.GetUtcNow();
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error occurred validating GitHub token scopes.");
                matchedProvider.ScopeValidationStatus = ProviderScopeStatus.ReconnectRequired;
                matchedProvider.LastScopeValidationAt = _timeProvider.GetUtcNow();
            }
        }
        else if (string.Equals(canonicalName, "gitlab", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                var request = new HttpRequestMessage(HttpMethod.Get, "https://gitlab.com/api/v4/user");
                request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", decryptedAccessToken);
                var response = await httpClient.SendAsync(request);
                if (response.IsSuccessStatusCode)
                {
                    matchedProvider.ScopeValidationStatus = ProviderScopeStatus.Valid;
                    matchedProvider.LastScopeValidationAt = _timeProvider.GetUtcNow();
                    matchedProvider.RefreshFailureCount = 0;
                    matchedProvider.LastSuccessfulRefreshAt = _timeProvider.GetUtcNow();
                }
                else if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized || response.StatusCode == System.Net.HttpStatusCode.Forbidden)
                {
                    matchedProvider.ScopeValidationStatus = ProviderScopeStatus.Revoked;
                    matchedProvider.LastScopeValidationAt = _timeProvider.GetUtcNow();
                }
                else
                {
                    matchedProvider.ScopeValidationStatus = ProviderScopeStatus.ReconnectRequired;
                    matchedProvider.LastScopeValidationAt = _timeProvider.GetUtcNow();
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error occurred validating GitLab token scopes.");
                matchedProvider.ScopeValidationStatus = ProviderScopeStatus.ReconnectRequired;
                matchedProvider.LastScopeValidationAt = _timeProvider.GetUtcNow();
            }
        }

        await _context.SaveChangesAsync();
        return matchedProvider.ScopeValidationStatus == ProviderScopeStatus.Valid;
    }

    public async Task<bool> ChangePasswordAsync(ChangePasswordRequest request, CancellationToken cancellationToken = default)
    {
        var userIdClaim = _httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null) throw new UnauthorizedAccessException("User is not authenticated.");
        var userId = Guid.Parse(userIdClaim.Value);

        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == userId && u.DeletedAt == null, cancellationToken);

        if (user == null)
        {
            throw new ResourceNotFoundException("USER_NOT_FOUND", "User not found.");
        }

        string? currentPasswordHash = user.PasswordHash;

        if (string.IsNullOrEmpty(currentPasswordHash))
        {
            throw new AuthException(AuthErrorCodes.InvalidCredentials, "No active password credential found to change.");
        }

        if (!VerifyPassword(user, currentPasswordHash, request.CurrentPassword))
        {
            throw new AuthException(AuthErrorCodes.InvalidCredentials, "Incorrect current password.");
        }

        if (VerifyPassword(user, currentPasswordHash, request.NewPassword))
        {
            throw new AuthException(AuthErrorCodes.PasswordPolicyViolation, "New password cannot be the same as your current password.");
        }

        await _passwordPolicyService.ValidateAndThrowAsync(request.NewPassword, "Default");

        var newHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);

        // Update primary User entity password hash to ensure login flows utilize the new credentials
        user.PasswordHash = newHash;
        user.PasswordChangedAt = _timeProvider.GetUtcNow();
        user.UpdatedAt = _timeProvider.GetUtcNow();

        // Revoke all other refresh tokens for user
        var currentRefreshToken = _httpContextAccessor.HttpContext?.Request.Cookies["refresh_token"];
        var activeTokens = await _context.RefreshTokens
            .Where(t => t.UserId == user.Id && t.RevokedAt == null)
            .ToListAsync(cancellationToken);

        foreach (var token in activeTokens)
        {
            if (token.Token != currentRefreshToken)
            {
                token.RevokedAt = _timeProvider.GetUtcNow();
            }
        }

        await _context.SaveChangesAsync(cancellationToken);
        await LogAuditEventAsync(user.Id, "PASSWORD_CHANGED", "User successfully changed their password. Other active sessions revoked.");

        return true;
    }

    public async Task<bool> LinkGoogleAccountAsync(LinkGoogleRequest request, CancellationToken cancellationToken = default)
    {
        var userIdClaim = _httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null) throw new UnauthorizedAccessException("User is not authenticated.");
        var userId = Guid.Parse(userIdClaim.Value);

        var user = await _context.Users
            .Include(u => u.AuthProviders)
            .FirstOrDefaultAsync(u => u.Id == userId && u.DeletedAt == null, cancellationToken);

        if (user == null)
        {
            throw new ResourceNotFoundException("USER_NOT_FOUND", "User not found.");
        }

        GoogleJsonWebSignature.Payload payload;
        try
        {
            var settings = new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = new[] { _envConfig.Auth.GoogleClientId }
            };
            payload = await _googleTokenValidator.ValidateAsync(request.IdToken, settings);
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Invalid Google ID Token provided for linking: {Message}", ex.Message);
            throw new AuthException(AuthErrorCodes.InvalidCredentials, "Google ID token validation failed.");
        }

        if (payload == null)
        {
            throw new AuthException(AuthErrorCodes.InvalidCredentials, "Google ID token validation failed.");
        }

        if (!payload.EmailVerified)
        {
            throw new AuthException(AuthErrorCodes.InvalidCredentials, "Google email is not verified.");
        }

        var conflictProvider = await _context.AuthProviders
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(ap => ap.ProviderName.ToLower() == "google" && ap.ProviderKey == payload.Subject, cancellationToken);
        if (conflictProvider != null && conflictProvider.UserId != user.Id)
        {
            await LogAuditEventAsync(user.Id, "PROVIDER_LINK_CONFLICT", $"Blocked attempt to link already-bound Google identity: Subject={payload.Subject}");
            throw new AuthException(AuthErrorCodes.AccountConflict, "This Google account is already linked to another CVerify profile.");
        }

        var googleProvider = await _context.AuthProviders
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(ap => ap.UserId == user.Id && ap.ProviderName.ToLower() == "google" && ap.ProviderKey == payload.Subject, cancellationToken);

        if (googleProvider == null)
        {
            googleProvider = new AuthProvider
            {
                Id = Guid.CreateVersion7(),
                UserId = user.Id,
                ProviderName = "google",
                ProviderKey = payload.Subject,
                ProviderAccountId = payload.Email ?? payload.Name ?? payload.Subject,
                ProviderUsername = payload.Email,
                ProviderAvatarUrl = payload.Picture,
                ScopeValidationStatus = ProviderScopeStatus.Valid,
                LastScopeValidationAt = _timeProvider.GetUtcNow(),
                LastProviderSyncAt = _timeProvider.GetUtcNow(),
                LastSuccessfulRefreshAt = _timeProvider.GetUtcNow(),
                CreatedAt = _timeProvider.GetUtcNow(),
            };
            _context.AuthProviders.Add(googleProvider);
        }
        else
        {
            var wasSoftDeleted = googleProvider.DeletedAt != null;
            googleProvider.DeletedAt = null; // Reactivate!
            googleProvider.ProviderKey = payload.Subject;
            googleProvider.ProviderAccountId = payload.Email ?? payload.Name ?? payload.Subject;
            googleProvider.ProviderUsername = payload.Email;
            googleProvider.ProviderAvatarUrl = payload.Picture;
            googleProvider.ScopeValidationStatus = ProviderScopeStatus.Valid;
            googleProvider.LastScopeValidationAt = _timeProvider.GetUtcNow();
            googleProvider.LastProviderSyncAt = _timeProvider.GetUtcNow();
            googleProvider.LastSuccessfulRefreshAt = _timeProvider.GetUtcNow();

            if (wasSoftDeleted)
            {
                await LogAuditEventAsync(user.Id, "PROVIDER_LINK_REACTIVATED", $"Reactivated soft-deleted Google provider connection (ID: {googleProvider.Id}).");
            }
        }

        await _context.SaveChangesAsync(cancellationToken);
        await LogAuditEventAsync(user.Id, "PROVIDER_LINK_CONFIRMED", "Successfully linked/re-linked Google account via client-side ID Token flow.");

        return true;
    }

    private string MaskEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email)) return string.Empty;
        var parts = email.Split('@');
        if (parts.Length != 2) return email;
        var local = parts[0];
        var domain = parts[1];
        if (local.Length <= 2) return $"*@{domain}";
        return $"{local[0]}***{local[^1]}@{domain}";
    }

    public async Task ClaimPendingRelationshipsAsync(Guid userId)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            _logger.LogWarning("ClaimPendingRelationshipsAsync: User {UserId} not found.", userId);
            return;
        }

        await _workspaceMembershipService.DiscoverPendingInvitationsAsync(userId);
    }

    private async Task ActivateUserAsync(User user)
    {
        if (user.Status != UserStatus.ACTIVE)
        {
            user.TransitionTo(UserStatus.ACTIVE);
        }
        if (!user.EmailVerifiedAt.HasValue)
        {
            user.EmailVerifiedAt = _timeProvider.GetUtcNow().UtcDateTime;
        }
        user.UpdatedAt = _timeProvider.GetUtcNow().UtcDateTime;

        if (string.IsNullOrEmpty(user.Username))
        {
            await _usernameService.RunWithUsernameRetryAsync(user, user.Email, async () =>
                await _context.SaveChangesAsync());
        }
        else
        {
            await _context.SaveChangesAsync();
        }

        await ClaimPendingRelationshipsAsync(user.Id);
    }
}

