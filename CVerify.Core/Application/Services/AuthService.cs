using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using CVerify.API.Application.DTOs;
using CVerify.API.Application.Exceptions;
using CVerify.API.Application.Interfaces;
using CVerify.API.Application.Security.PasswordPolicies;
using CVerify.API.Application.Security.OtpPolicies;
using CVerify.API.Core.Entities;
using CVerify.API.Infrastructure.Configuration;
using CVerify.API.Infrastructure.Diagnostics;
using CVerify.API.Infrastructure.Persistence;
using CVerify.API.Infrastructure.Security;
using Google.Apis.Auth;
using Microsoft.AspNetCore.Identity;
using CVerify.API.Application.Storage.Interfaces;

namespace CVerify.API.Application.Services;

/// <summary>
/// Orchestrates advanced authentication flows including register, login, verification, and password recovery.
/// </summary>
public class AuthService : IAuthService
{
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
        IStorageService storageService)
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
        return new AuthResponse(user.Id, user.Email, user.FullName, signedAvatar, roles, permissions, isEmailVerified, status, nextStep);
    }

    private async Task<UserProfileResponse> CreateUserProfileResponseAsync(User user, IEnumerable<string> roles, IEnumerable<string> permissions, bool isEmailVerified, string status, string nextStep, CancellationToken cancellationToken = default)
    {
        var signedAvatar = await GetSignedAvatarUrlAsync(user.AvatarUrl, cancellationToken);
        return new UserProfileResponse(user.Id, user.Email, user.FullName, signedAvatar, roles, permissions, isEmailVerified, status, nextStep);
    }

    /// <summary>
    /// Authenticates a user and issues JWT and Refresh tokens in HttpOnly cookies.
    /// Handles account lockout and failed attempt tracking.
    /// </summary>
    public async Task<AuthResponse?> LoginAsync(LoginRequest request)
    {
        var normalizedEmail = NormalizeEmailPolicy(request.Email);

        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Email == normalizedEmail);

        if (user == null)
        {
            _metrics.RecordLoginFailed();
            await LogAuditEventAsync(null, "USER_LOGIN_FAILED_EMAIL", $"Unknown email login attempt for {normalizedEmail}.");
            return null;
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

        var jwt = _tokenService.GenerateJwtToken(user, roles, permissions);
        var refreshTokenStr = _tokenService.GenerateRefreshToken();

        var sessionId = Guid.CreateVersion7();
        var rememberMe = request.RememberMe;
        await SaveRefreshTokenAsync(user.Id, refreshTokenStr, sessionId, rememberMe);

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

            var payload = await GoogleJsonWebSignature.ValidateAsync(request.IdToken, settings);
            if (payload == null)
            {
                _metrics.RecordLoginFailed();
                throw new UnauthorizedAccessException("Google authentication failed.");
            }

            var email = NormalizeEmailPolicy(payload.Email);

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var user = await _context.Users
                    .Include(u => u.Roles)
                    .Include(u => u.AuthProviders)
                    .FirstOrDefaultAsync(u => u.Email == email);

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
                        Status = UserStatus.ACTIVE,
                        EmailVerifiedAt = _timeProvider.GetUtcNow().UtcDateTime,
                        CreatedAt = _timeProvider.GetUtcNow().UtcDateTime,
                        UpdatedAt = _timeProvider.GetUtcNow().UtcDateTime,
                        Roles = new List<Role> { userRole }
                    };

                    _context.Users.Add(user);
                    await _context.SaveChangesAsync();

                    // Create Google Provider row
                    var googleProvider = new AuthProvider
                    {
                        UserId = user.Id,
                        ProviderName = "Google",
                        ProviderKey = payload.Subject,
                        CreatedAt = _timeProvider.GetUtcNow()
                    };
                    _context.AuthProviders.Add(googleProvider);
                    await _context.SaveChangesAsync();

                    await LogAuditEventAsync(user.Id, "PROVIDER_LINKED", $"Linked Google provider to user {user.Email}.");
                    await LogAuditEventAsync(user.Id, "USER_GOOGLE_REGISTER", $"New user {user.Email} registered via Google OAuth.");
                }
                else
                {
                    if (_accountService.IsAccountDisabled(user))
                    {
                        _metrics.RecordLoginFailed();
                        await LogAuditEventAsync(user.Id, "USER_LOGIN_FAILED_DISABLED", $"Disabled user account Google login attempt for {user.Email}.");
                        throw new UnauthorizedAccessException("Account is disabled.");
                    }

                    if (!string.IsNullOrEmpty(payload.Picture) && user.AvatarUrl != payload.Picture)
                    {
                        user.AvatarUrl = payload.Picture;
                    }
                    if (!string.IsNullOrEmpty(payload.Name) && user.FullName != payload.Name && user.FullName == "Google User")
                    {
                        user.FullName = payload.Name;
                    }

                    if (user.Status == UserStatus.EMAIL_VERIFY_PENDING)
                    {
                        user.TransitionTo(UserStatus.ACTIVE);
                        user.EmailVerifiedAt = _timeProvider.GetUtcNow().UtcDateTime;
                    }

                    user.UpdatedAt = _timeProvider.GetUtcNow().UtcDateTime;
                    await _context.SaveChangesAsync();

                    // Dynamically map AuthProvider link if not present
                    var googleProvider = user.AuthProviders.FirstOrDefault(ap => ap.ProviderName == "Google");
                    if (googleProvider == null)
                    {
                        googleProvider = new AuthProvider
                        {
                            UserId = user.Id,
                            ProviderName = "Google",
                            ProviderKey = payload.Subject,
                            CreatedAt = _timeProvider.GetUtcNow()
                        };
                        _context.AuthProviders.Add(googleProvider);
                        await _context.SaveChangesAsync();
                        await LogAuditEventAsync(user.Id, "PROVIDER_LINKED", $"Dynamically mapped Google provider link for existing user {user.Email}.");
                    }
                }

                await transaction.CommitAsync();

                // Invalidate identity state cache when provider topology changes
                await _identityStateResolver.InvalidateCacheAsync(email);

                var roles = await _identityRepository.GetUserRolesAsync(user.Id);
                var permissions = await _identityRepository.GetUserPermissionsAsync(user.Id);

                await CacheUserAuthDataAsync(user.Id, roles, permissions);

                var jwt = _tokenService.GenerateJwtToken(user, roles, permissions);
                var refreshTokenStr = _tokenService.GenerateRefreshToken();

                var sessionId = Guid.CreateVersion7();
                var rememberMe = true; 
                await SaveRefreshTokenAsync(user.Id, refreshTokenStr, sessionId, rememberMe);

                var refreshExpiry = DateTime.UtcNow.AddDays(7);
                _tokenService.SetTokenInsideCookie("access_token", jwt, DateTime.UtcNow.AddMinutes(15));
                _tokenService.SetTokenInsideCookie("refresh_token", refreshTokenStr, refreshExpiry);

                _metrics.RecordLoginSuccess();
                await LogAuditEventAsync(user.Id, "USER_GOOGLE_LOGIN_SUCCESS", $"User {user.Email} logged in successfully via Google OAuth.");

                return await CreateAuthResponseAsync(user, roles, permissions, true, "ACTIVE", "DASHBOARD");
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
                .FirstOrDefaultAsync(t => t.Token == refreshTokenStr);

            var validationResult = ValidateRefreshToken(storedToken);

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
                    await RevokeSessionChainAsync(storedToken!.SessionId);
                    await transaction.CommitAsync();
                }
                catch
                {
                    await transaction.RollbackAsync();
                    throw;
                }

                // Structured security log
                _logger.LogWarning("SECURITY ALERT: [Event=TOKEN_REUSE_DETECTED] [SessionId={SessionId}] [UserId={UserId}] [IpAddress={IpAddress}] [UserAgent={UserAgent}]",
                    storedToken.SessionId, storedToken.UserId, currentIp, currentUa);

                await LogAuditEventAsync(storedToken.UserId, "TOKEN_THEFT_DETECTED",
                    $"Refresh token reuse/theft detected for token {maskedToken}. Session {storedToken.SessionId} isolated and revoked. IP: {currentIp}, UA: {currentUa}");

                throw new AuthException(AuthErrorCodes.InvalidToken, "Token reuse detected.");
            }

            if (validationResult == RefreshTokenValidationResult.WithinGracePeriod)
            {
                // Safe concurrency: Return the active replacement token that was already generated
                var activeReplacement = await _context.RefreshTokens
                    .FirstOrDefaultAsync(t => t.Id == storedToken!.ReplacedByTokenId);

                if (activeReplacement != null)
                {
                    _logger.LogInformation("Safe concurrent refresh race handled. SessionId: {SessionId}.", storedToken!.SessionId);

                    var user = storedToken.User;
                    var roles = await _identityRepository.GetUserRolesAsync(user.Id);
                    var permissions = await _identityRepository.GetUserPermissionsAsync(user.Id);

                    var jwt = _tokenService.GenerateJwtToken(user, roles, permissions);

                    // Re-set cookies for the active rotated token
                    var refreshExpiry = activeReplacement.RememberMe ? DateTime.UtcNow.AddDays(7) : DateTime.UtcNow.AddHours(24);
                    _tokenService.SetTokenInsideCookie("access_token", jwt, DateTime.UtcNow.AddMinutes(15));
                    _tokenService.SetTokenInsideCookie("refresh_token", activeReplacement.Token, refreshExpiry);

                    return await CreateAuthResponseAsync(user, roles, permissions,
                        user.Status == UserStatus.ACTIVE, user.Status.ToString(),
                        user.Status == UserStatus.EMAIL_VERIFY_PENDING ? "VERIFY_EMAIL" : "DASHBOARD");
                }
            }

            // Normal path: validationResult == RefreshTokenValidationResult.Valid
            var oldUser = storedToken!.User;
            var oldRoles = await _identityRepository.GetUserRolesAsync(oldUser.Id);
            var oldPermissions = await _identityRepository.GetUserPermissionsAsync(oldUser.Id);

            // Compare User-Agents for hijack warnings
            var currentUserAgent = _httpContextAccessor.HttpContext?.Request.Headers["User-Agent"].ToString();
            if (!string.IsNullOrWhiteSpace(storedToken.UserAgent) &&
                !string.Equals(storedToken.UserAgent, currentUserAgent, StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("SECURITY WARNING: User-Agent changed during token refresh for Session {SessionId}. Original: '{OriginalUA}', Current: '{CurrentUA}'",
                    storedToken.SessionId, storedToken.UserAgent, currentUserAgent);
            }

            var newRefreshTokenStr = _tokenService.GenerateRefreshToken();

            using var rotationTx = await _context.Database.BeginTransactionAsync();
            RefreshToken newRefreshToken;
            try
            {
                newRefreshToken = await RotateRefreshTokenAsync(storedToken, newRefreshTokenStr);
                await rotationTx.CommitAsync();
            }
            catch
            {
                await rotationTx.RollbackAsync();
                throw;
            }

            var newJwt = _tokenService.GenerateJwtToken(oldUser, oldRoles, oldPermissions);

            var newRefreshExpiry = newRefreshToken.RememberMe ? DateTime.UtcNow.AddDays(7) : DateTime.UtcNow.AddHours(24);
            _tokenService.SetTokenInsideCookie("access_token", newJwt, DateTime.UtcNow.AddMinutes(15));
            _tokenService.SetTokenInsideCookie("refresh_token", newRefreshTokenStr, newRefreshExpiry);

            await LogAuditEventAsync(oldUser.Id, "TOKEN_ROTATED", $"Token rotated successfully. New token issued for Session {storedToken.SessionId}.");

            return await CreateAuthResponseAsync(oldUser, oldRoles, oldPermissions,
                oldUser.Status == UserStatus.ACTIVE, oldUser.Status.ToString(),
                oldUser.Status == UserStatus.EMAIL_VERIFY_PENDING ? "VERIFY_EMAIL" : "DASHBOARD");
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

        var existingUser = await _context.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail, cancellationToken);
        if (existingUser != null)
        {
            // Idempotency: If pending verification, rotate verification token and send a new link
            if (existingUser.Status == UserStatus.EMAIL_VERIFY_PENDING)
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
            await _context.SaveChangesAsync(cancellationToken);

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

            var outboxMessage = new OutboxMessage
            {
                Type = "EmailVerification",
                Payload = System.Text.Json.JsonSerializer.Serialize(payloadObj),
                CreatedAt = _timeProvider.GetUtcNow()
            };

            _context.OutboxMessages.Add(outboxMessage);
            await _context.SaveChangesAsync(cancellationToken);

            await transaction.CommitAsync(cancellationToken);

            await LogAuditEventAsync(newUser.Id, "USER_REGISTERED", $"User account {newUser.Email} registered successfully.");

            _logger.LogInformation("[CorrelationID: {CorrelationId}] User {UserId} registered successfully, outbox message enqueued.", correlationId, newUser.Id);
            _metrics.RecordRegistration();
            return RegisterResponseFactory.Success();
        }
        catch (DuplicateEmailException ex)
        {
            _logger.LogWarning(ex, "[CorrelationID: {CorrelationId}] Database-level unique constraint violation caught during concurrent registration insert. Falling back to duplicate registration logic.", correlationId);
            await transaction.RollbackAsync(cancellationToken);

            // Fetch the existing user that just got created in the concurrent transaction
            var concurrentUser = await _context.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail, cancellationToken);
            if (concurrentUser != null)
            {
                if (concurrentUser.Status == UserStatus.EMAIL_VERIFY_PENDING)
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
            user.TransitionTo(UserStatus.ACTIVE);
            user.EmailVerifiedAt = _timeProvider.GetUtcNow().UtcDateTime;
            user.UpdatedAt = _timeProvider.GetUtcNow().UtcDateTime;

            await _context.SaveChangesAsync(cancellationToken);

            // Queue onboarding welcome email via Outbox Pattern
            var payloadObj = new
            {
                Email = user.Email,
                FullName = user.FullName,
                CorrelationId = correlationId
            };

            var outboxMessage = new OutboxMessage
            {
                Type = "WelcomeNotice",
                Payload = System.Text.Json.JsonSerializer.Serialize(payloadObj),
                CreatedAt = _timeProvider.GetUtcNow()
            };

            _context.OutboxMessages.Add(outboxMessage);
            await _context.SaveChangesAsync(cancellationToken);

            await transaction.CommitAsync(cancellationToken);

            await LogAuditEventAsync(user.Id, "USER_EMAIL_VERIFIED", $"User email {user.Email} successfully verified.");

            var roles = await _identityRepository.GetUserRolesAsync(user.Id);
            var permissions = await _identityRepository.GetUserPermissionsAsync(user.Id);

            await CacheUserAuthDataAsync(user.Id, roles, permissions);

            var jwt = _tokenService.GenerateJwtToken(user, roles, permissions);
            var refreshTokenStr = _tokenService.GenerateRefreshToken();

            var sessionId = Guid.CreateVersion7();
            var rememberMe = false; // default to false
            await SaveRefreshTokenAsync(user.Id, refreshTokenStr, sessionId, rememberMe);

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
            _logger.LogWarning("[CorrelationID: {CorrelationId}] Cooldown active for {Email}.", correlationId, normalizedEmail);
            throw new AuthException(AuthErrorCodes.CooldownActive, "Please wait before requesting another verification email.");
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

            var outboxMessage = new OutboxMessage
            {
                Type = "EmailVerification",
                Payload = System.Text.Json.JsonSerializer.Serialize(payloadObj),
                CreatedAt = _timeProvider.GetUtcNow()
            };

            _context.OutboxMessages.Add(outboxMessage);
            await _context.SaveChangesAsync(cancellationToken);

            // Set 1-minute rate limiting cooldown in Redis
            await _cacheService.SetAsync(cooldownKey, "active", TimeSpan.FromMinutes(1));

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
            _logger.LogWarning("[CorrelationID: {CorrelationId}] Forgot password cooldown active for {Email}.", correlationId, normalizedEmail);
            throw new AuthException(AuthErrorCodes.CooldownActive, "Please wait before requesting another recovery email.");
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

            var outboxMessage = new OutboxMessage
            {
                Type = "PasswordReset",
                Payload = System.Text.Json.JsonSerializer.Serialize(payloadObj),
                CreatedAt = _timeProvider.GetUtcNow()
            };

            _context.OutboxMessages.Add(outboxMessage);
            await _context.SaveChangesAsync(cancellationToken);

            // Set 1-minute rate limiting cooldown in Redis
            await _cacheService.SetAsync(cooldownKey, "active", TimeSpan.FromMinutes(1));

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

            var jwt = _tokenService.GenerateJwtToken(user, roles, permissions);
            var refreshTokenStr = _tokenService.GenerateRefreshToken();

            var sessionId = Guid.CreateVersion7();
            var rememberMe = false; // default to false
            await SaveRefreshTokenAsync(user.Id, refreshTokenStr, sessionId, rememberMe);

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

    private async Task SaveRefreshTokenAsync(Guid userId, string tokenStr, Guid sessionId, bool rememberMe, Guid? replacedByTokenId = null)
    {
        var httpContext = _httpContextAccessor.HttpContext;
        var userAgent = httpContext?.Request.Headers["User-Agent"].ToString();
        var ipAddress = httpContext?.Connection.RemoteIpAddress?.ToString();

        var expiration = rememberMe ? TimeSpan.FromDays(7) : TimeSpan.FromHours(24);

        var refreshToken = new RefreshToken
        {
            UserId = userId,
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

        // Perform soft deletion
        user.DeletedAt = _timeProvider.GetUtcNow();
        user.Status = UserStatus.DELETED;

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

        // Structured security audit log
        _logger.LogWarning("SECURITY AUDIT: User account {UserId} ({Email}) was soft-deleted.", userId, user.Email);
        await LogAuditEventAsync(userId, "USER_DELETED", $"User account {user.Email} was soft-deleted.");

        await _context.SaveChangesAsync();

        // Remove auth cookies from HTTP context
        _tokenService.RemoveTokenFromCookie("access_token");
        _tokenService.RemoveTokenFromCookie("refresh_token");

        return true;
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
        var trimmed = email.Trim().Normalize(NormalizationForm.FormC).ToLowerInvariant();
        var parts = trimmed.Split('@');
        if (parts.Length != 2) return trimmed;
        var local = parts[0];
        var domain = parts[1];
        if (domain == "gmail.com")
        {
            var plusIndex = local.IndexOf('+');
            if (plusIndex >= 0)
            {
                local = local.Substring(0, plusIndex);
            }
            local = local.Replace(".", "");
        }
        return $"{local}@{domain}";
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
        var normalizedEmail = NormalizeEmailPolicy(request.Email);
        if (IsDisposableEmail(normalizedEmail))
        {
            throw new AuthException(AuthErrorCodes.InvalidCredentials, "Disposable email addresses are not permitted.");
        }

        var cooldownKey = $"cooldown:otp:{normalizedEmail}:{request.Purpose}";
        var isCooldown = await _cacheService.GetAsync<string>(cooldownKey);
        if (isCooldown != null)
        {
            throw new AuthException(AuthErrorCodes.CooldownActive, "Please wait before requesting another OTP.");
        }

        var plainOtp = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
        var otpHash = GenerateHmacSha256OtpHash(plainOtp);

        var challengeId = Guid.CreateVersion7();
        var expiresAt = _timeProvider.GetUtcNow().AddMinutes(5);

        var verification = new OtpVerification
        {
            ChallengeId = challengeId,
            Email = normalizedEmail,
            OtpHash = otpHash,
            Purpose = request.Purpose,
            ExpiresAt = expiresAt,
            CreatedAt = _timeProvider.GetUtcNow(),
            LastSentAt = _timeProvider.GetUtcNow()
        };

        _context.OtpVerifications.Add(verification);
        await _context.SaveChangesAsync(cancellationToken);

        // Outbox Pattern Integration
        var payloadObj = new
        {
            Email = normalizedEmail,
            Otp = plainOtp,
            ChallengeId = challengeId,
            Purpose = request.Purpose
        };

        var outboxMessage = new OutboxMessage
        {
            Type = "EmailOtpVerification",
            Payload = System.Text.Json.JsonSerializer.Serialize(payloadObj),
            CreatedAt = _timeProvider.GetUtcNow()
        };

        _context.OutboxMessages.Add(outboxMessage);
        await _context.SaveChangesAsync(cancellationToken);

        await _cacheService.SetAsync(cooldownKey, "active", TimeSpan.FromSeconds(60));
        await LogAuditEventAsync(null, "OTP_SENT", $"OTP challenge {challengeId} sent to {normalizedEmail} for {request.Purpose}.");

        return new SendOtpResponse(challengeId, normalizedEmail, 60);
    }

    public async Task<VerifyOtpResponse> VerifyOtpAsync(VerifyOtpRequest request, CancellationToken cancellationToken = default)
    {
        _otpPolicyService.ValidateAndThrow(request.Code, "Default");
        var normalizedEmail = NormalizeEmailPolicy(request.Email);

        var superAdminEmail = _envConfig.SuperAdmin.Email;
        bool isSuperAdmin = string.Equals(normalizedEmail, superAdminEmail, StringComparison.OrdinalIgnoreCase);

        if (isSuperAdmin)
        {
            _logger.LogInformation("Super Admin OTP verification bypassed for {Email}.", normalizedEmail);
            var adminSetupToken = Guid.NewGuid().ToString("N");
            await _cacheService.SetAsync($"setup:token:{normalizedEmail}:{request.ChallengeId}", adminSetupToken, TimeSpan.FromMinutes(10));

            await LogAuditEventAsync(null, "OTP_BYPASSED", $"Super Admin OTP verified/bypassed for challenge {request.ChallengeId} on {normalizedEmail}.");
            return new VerifyOtpResponse(request.ChallengeId, normalizedEmail, adminSetupToken);
        }

        var verification = await _context.OtpVerifications
            .Where(v => v.ChallengeId == request.ChallengeId && v.Email == normalizedEmail && v.Purpose == request.Purpose)
            .FirstOrDefaultAsync(cancellationToken);

        if (verification == null)
        {
            await LogAuditEventAsync(null, "OTP_FAILED", $"OTP verification failed: unknown challenge {request.ChallengeId} for {normalizedEmail}.");
            throw new AuthException(AuthErrorCodes.InvalidToken, "The OTP challenge is invalid or does not match.");
        }

        if (verification.ConsumedAt != null)
        {
            throw new AuthException(AuthErrorCodes.TokenAlreadyConsumed, "This OTP has already been verified.");
        }

        if (verification.ExpiresAt <= _timeProvider.GetUtcNow())
        {
            throw new AuthException(AuthErrorCodes.ExpiredToken, "This OTP has expired.");
        }

        if (verification.Attempts >= 5)
        {
            await LogAuditEventAsync(null, "SuspiciousActivity", $"Abuse block triggered for challenge {request.ChallengeId} (too many attempts).");
            throw new AuthException(AuthErrorCodes.SuspiciousActivity, "Too many failed attempts. This OTP has been blocked.");
        }

        var inputHash = GenerateHmacSha256OtpHash(request.Code);
        bool matches = ConstantTimeEquals(verification.OtpHash, inputHash);

        verification.Attempts += 1;
        verification.LastAttemptAt = _timeProvider.GetUtcNow();

        if (!matches)
        {
            await _context.SaveChangesAsync(cancellationToken);
            await LogAuditEventAsync(null, "OTP_FAILED", $"OTP verification failed for challenge {request.ChallengeId} on {normalizedEmail}.");
            throw new AuthException(AuthErrorCodes.InvalidCredentials, "The OTP entered is incorrect.");
        }

        verification.ConsumedAt = _timeProvider.GetUtcNow();
        await _context.SaveChangesAsync(cancellationToken);

        var tempSetupToken = Guid.NewGuid().ToString("N");
        await _cacheService.SetAsync($"setup:token:{normalizedEmail}:{request.ChallengeId}", tempSetupToken, TimeSpan.FromMinutes(10));

        await LogAuditEventAsync(null, "OTP_VERIFIED", $"OTP verified successfully for challenge {request.ChallengeId} on {normalizedEmail}.");
        return new VerifyOtpResponse(request.ChallengeId, normalizedEmail, tempSetupToken);
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
                .Include(u => u.PasswordCredentials)
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
                    Status = UserStatus.ACTIVE,
                    EmailVerifiedAt = _timeProvider.GetUtcNow().UtcDateTime,
                    CreatedAt = _timeProvider.GetUtcNow().UtcDateTime,
                    UpdatedAt = _timeProvider.GetUtcNow().UtcDateTime,
                    Roles = new List<Role> { userRole }
                };
                _context.Users.Add(user);
                await _context.SaveChangesAsync(cancellationToken);
            }
            else
            {
                user.PasswordHash = passwordHash;
                if (!string.IsNullOrWhiteSpace(request.FullName))
                {
                    user.FullName = request.FullName;
                }
                user.EmailVerifiedAt = _timeProvider.GetUtcNow().UtcDateTime;
                user.TransitionTo(UserStatus.ACTIVE);
                user.UpdatedAt = _timeProvider.GetUtcNow().UtcDateTime;
                await _context.SaveChangesAsync(cancellationToken);
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
            var activeCredentials = user.PasswordCredentials.Where(pc => pc.IsActive && pc.DeletedAt == null).ToList();
            foreach (var cred in activeCredentials)
            {
                cred.IsActive = false;
                cred.RevokedAt = _timeProvider.GetUtcNow();
                cred.RevokedReason = "Password updated/rotated";
                cred.UpdatedAt = _timeProvider.GetUtcNow().UtcDateTime;
            }

            var newCred = new PasswordCredential
            {
                UserId = user.Id,
                PasswordHash = passwordHash,
                IsActive = true,
                PasswordChangedAt = _timeProvider.GetUtcNow(),
                CreatedAt = _timeProvider.GetUtcNow(),
                UpdatedAt = _timeProvider.GetUtcNow()
            };
            _context.PasswordCredentials.Add(newCred);
            await _context.SaveChangesAsync(cancellationToken);

            await transaction.CommitAsync(cancellationToken);

            // Invalidate identity state cache — user now has a Password provider
            await _identityStateResolver.InvalidateCacheAsync(normalizedEmail);

            await _cacheService.RemoveAsync($"setup:token:{normalizedEmail}:{request.ChallengeId}");

            var roles = await _identityRepository.GetUserRolesAsync(user.Id);
            var permissions = await _identityRepository.GetUserPermissionsAsync(user.Id);

            await CacheUserAuthDataAsync(user.Id, roles, permissions);

            var jwt = _tokenService.GenerateJwtToken(user, roles, permissions);
            var refreshTokenStr = _tokenService.GenerateRefreshToken();

            var sessionId = Guid.CreateVersion7();
            await SaveRefreshTokenAsync(user.Id, refreshTokenStr, sessionId, false);

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

    public async Task<bool> RegisterCompanyAsync(RegisterCompanyRequest request, string userAgent, string ipAddress, CancellationToken cancellationToken = default)
    {
        var normalizedEmail = NormalizeEmailPolicy(request.CompanyEmail);
        if (IsDisposableEmail(normalizedEmail))
        {
            throw new AuthException(AuthErrorCodes.InvalidCredentials, "Disposable email addresses are not permitted.");
        }

        var client = _httpClientFactory.CreateClient();
        var response = await client.GetAsync($"https://api.vietqr.io/v2/business/{request.TaxCode}", cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
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
        var payloadObj = new
        {
            Email = normalizedEmail,
            CompanyName = officialName,
            Link = verifyLinkFormat
        };

        var outboxMessage = new OutboxMessage
        {
            Type = "CompanyEmailVerification",
            Payload = System.Text.Json.JsonSerializer.Serialize(payloadObj),
            CreatedAt = _timeProvider.GetUtcNow()
        };

        _context.OutboxMessages.Add(outboxMessage);
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

    public async Task<AuthResponse> SetupWorkspaceAsync(SetupWorkspaceRequest request, string userAgent, string ipAddress, CancellationToken cancellationToken = default)
    {
        await _passwordPolicyService.ValidateAndThrowAsync(request.Password, "Enterprise");

        var normalizedEmail = NormalizeEmailPolicy(request.CompanyEmail);
        var cachedToken = await _cacheService.GetAsync<string>($"workspace:token:{normalizedEmail}");

        if (cachedToken == null || !ConstantTimeEquals(cachedToken, request.VerificationToken))
        {
            throw new AuthException(AuthErrorCodes.InvalidToken, "The workspace setup session has expired or is invalid.");
        }

        // Reservation blocklist
        var reservedUsernames = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "admin", "support", "api", "auth", "login", "billing", "security", "careers", "jobs", "cverify", "system", "root", "portal"
        };
        var normalizedUsername = request.OrganizationUsername.Trim().ToLowerInvariant();
        if (reservedUsernames.Contains(normalizedUsername))
        {
            throw new AuthException(AuthErrorCodes.InvalidCredentials, $"The workspace username '{request.OrganizationUsername}' is reserved.");
        }

        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var existingOrg = await _context.Organizations
                .FirstOrDefaultAsync(o => o.Username == normalizedUsername && o.DeletedAt == null, cancellationToken);
            if (existingOrg != null)
            {
                throw new AuthException(AuthErrorCodes.InvalidCredentials, "This organization workspace username is already taken.");
            }

            var link = await _context.VerificationLinks
                .Where(vl => vl.Email == normalizedEmail && vl.Purpose == "CompanyVerification" && vl.DeletedAt == null)
                .OrderByDescending(vl => vl.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);

            if (link == null)
            {
                throw new AuthException(AuthErrorCodes.InvalidToken, "Company ownership details not found.");
            }

            var org = new Organization
            {
                Name = link.CompanyName ?? "Default Organization",
                TaxCode = link.TaxCode ?? string.Empty,
                Email = normalizedEmail,
                Username = normalizedUsername,
                IsVerified = true,
                CreatedAt = _timeProvider.GetUtcNow(),
                UpdatedAt = _timeProvider.GetUtcNow()
            };
            _context.Organizations.Add(org);
            await _context.SaveChangesAsync(cancellationToken);

            var user = await _context.Users
                .Include(u => u.PasswordCredentials)
                .Include(u => u.AuthProviders)
                .FirstOrDefaultAsync(u => u.Email == normalizedEmail && u.DeletedAt == null, cancellationToken);

            var ownerRole = await _context.Roles.FirstOrDefaultAsync(r => r.Name == "USER", cancellationToken);
            if (ownerRole == null)
            {
                throw new InvalidOperationException("Default owner role not found in database.");
            }

            var passwordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);

            if (user == null)
            {
                user = new User
                {
                    Email = normalizedEmail,
                    FullName = $"{org.Name} Owner",
                    Status = UserStatus.ACTIVE,
                    EmailVerifiedAt = _timeProvider.GetUtcNow().UtcDateTime,
                    CreatedAt = _timeProvider.GetUtcNow().UtcDateTime,
                    UpdatedAt = _timeProvider.GetUtcNow().UtcDateTime,
                    Roles = new List<Role> { ownerRole }
                };
                _context.Users.Add(user);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // Create Password linkage
            var provider = await _context.AuthProviders
                .FirstOrDefaultAsync(ap => ap.UserId == user.Id && ap.ProviderName == "Password" && ap.DeletedAt == null, cancellationToken);
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

            // Deactivate existing active credentials
            var activeCredentials = user.PasswordCredentials.Where(pc => pc.IsActive && pc.DeletedAt == null).ToList();
            foreach (var cred in activeCredentials)
            {
                cred.IsActive = false;
                cred.RevokedAt = _timeProvider.GetUtcNow();
                cred.RevokedReason = "Password updated/rotated during workspace setup";
                cred.UpdatedAt = _timeProvider.GetUtcNow().UtcDateTime;
            }

            // Add active PasswordCredential
            var newCred = new PasswordCredential
            {
                UserId = user.Id,
                PasswordHash = passwordHash,
                IsActive = true,
                PasswordChangedAt = _timeProvider.GetUtcNow(),
                CreatedAt = _timeProvider.GetUtcNow(),
                UpdatedAt = _timeProvider.GetUtcNow()
            };
            _context.PasswordCredentials.Add(newCred);
            await _context.SaveChangesAsync(cancellationToken);

            // Member mapping
            var authority = new OrganizationAuthority
            {
                OrganizationId = org.Id,
                UserId = user.Id,
                Role = "organization_owner",
                JoinedAt = _timeProvider.GetUtcNow()
            };
            _context.OrganizationAuthorities.Add(authority);

            // Create Workspace presentation details
            var workspace = new Workspace
            {
                OrganizationId = org.Id,
                DisplayName = org.Name,
                Slug = org.Username,
                Status = "active",
                CreatedAt = _timeProvider.GetUtcNow(),
                UpdatedAt = _timeProvider.GetUtcNow()
            };
            _context.Workspaces.Add(workspace);
            await _context.SaveChangesAsync(cancellationToken);

            // Create WorkspaceMember
            var workspaceMember = new WorkspaceMember
            {
                WorkspaceId = workspace.Id,
                UserId = user.Id,
                Role = "workspace_admin",
                JoinedAt = _timeProvider.GetUtcNow()
            };
            _context.WorkspaceMembers.Add(workspaceMember);
            await _context.SaveChangesAsync(cancellationToken);

            // Map Verification Link ownership for audits
            link.UserId = user.Id;
            link.OrganizationId = org.Id;
            await _context.SaveChangesAsync(cancellationToken);

            await transaction.CommitAsync(cancellationToken);

            await _cacheService.RemoveAsync($"workspace:token:{normalizedEmail}");

            var roles = await _identityRepository.GetUserRolesAsync(user.Id);
            var permissions = await _identityRepository.GetUserPermissionsAsync(user.Id);

            await CacheUserAuthDataAsync(user.Id, roles, permissions);

            var workspaceRoles = roles.Contains("BUSINESS") ? roles : roles.Concat(new[] { "BUSINESS" }).ToList();

            var jwt = _tokenService.GenerateJwtToken(user, workspaceRoles, permissions, org.Id, org.Username);
            var refreshTokenStr = _tokenService.GenerateRefreshToken();

            var sessionId = Guid.CreateVersion7();
            await SaveRefreshTokenAsync(user.Id, refreshTokenStr, sessionId, false);

            _tokenService.SetTokenInsideCookie("access_token", jwt, DateTime.UtcNow.AddMinutes(15));
            _tokenService.SetTokenInsideCookie("refresh_token", refreshTokenStr, DateTime.UtcNow.AddHours(24));

            await LogAuditEventAsync(user.Id, "ORGANIZATION_CREATED", $"Workspace organization '{normalizedUsername}' registered successfully.");
            return new AuthResponse(org.Id, org.Email, org.Name, null, workspaceRoles, permissions, true, "ACTIVE", "DASHBOARD");
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            _logger.LogError(ex, "Workspace setup flow failed.");
            throw;
        }
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

    // --- 3-STEP UNIFIED ONBOARDING IMPLEMENTATION ---

    private static int GetLevenshteinDistance(string s, string t)
    {
        if (string.IsNullOrEmpty(s)) return string.IsNullOrEmpty(t) ? 0 : t.Length;
        if (string.IsNullOrEmpty(t)) return s.Length;

        int n = s.Length;
        int m = t.Length;
        int[,] d = new int[n + 1, m + 1];

        for (int i = 0; i <= n; d[i, 0] = i++) { }
        for (int j = 0; j <= m; d[0, j] = j++) { }

        for (int i = 1; i <= n; i++)
        {
            for (int j = 1; j <= m; j++)
            {
                int cost = (t[j - 1] == s[i - 1]) ? 0 : 1;
                d[i, j] = Math.Min(
                    Math.Min(d[i - 1, j] + 1, d[i, j - 1] + 1),
                    d[i - 1, j - 1] + cost);
            }
        }
        return d[n, m];
    }

    private bool IsFuzzyMatch(string officialName, string inputName)
    {
        var normOfficial = NormalizeCompanyNameForMatching(officialName);
        var normUser = NormalizeCompanyNameForMatching(inputName);

        if (normOfficial == normUser) return true;

        // Allow minor typo tolerance (up to Levenshtein distance 2 or 15% mismatch)
        var distance = GetLevenshteinDistance(normOfficial, normUser);
        var maxLength = Math.Max(normOfficial.Length, normUser.Length);
        if (maxLength == 0) return false;

        double errorRate = (double)distance / maxLength;
        return distance <= 2 || errorRate <= 0.15;
    }

    public async Task<VerifyCompanyOnboardingResponse> VerifyCompanyOnboardingAsync(VerifyCompanyOnboardingRequest request, CancellationToken cancellationToken = default)
    {
        var taxCode = request.TaxCode.Trim();
        if (!System.Text.RegularExpressions.Regex.IsMatch(taxCode, @"^\d{10}(-\d{3})?$"))
        {
            throw new AuthException(AuthErrorCodes.InvalidCredentials, "Tax code format is invalid.");
        }

        var client = _httpClientFactory.CreateClient();
        var response = await client.GetAsync($"https://api.vietqr.io/v2/business/{taxCode}", cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            throw new AuthException(AuthErrorCodes.InvalidCredentials, "The business tax registry lookup failed.");
        }

        var json = await response.Content.ReadAsStringAsync(cancellationToken);
        using var doc = System.Text.Json.JsonDocument.Parse(json);
        var root = doc.RootElement;
        
        if (!root.TryGetProperty("code", out var codeProp) || codeProp.GetString() != "00")
        {
            throw new AuthException(AuthErrorCodes.InvalidCredentials, "Invalid business tax code.");
        }

        if (!root.TryGetProperty("data", out var dataElement) || dataElement.ValueKind == System.Text.Json.JsonValueKind.Null)
        {
            throw new AuthException(AuthErrorCodes.InvalidCredentials, "No business record found matching this tax code.");
        }

        var officialName = dataElement.GetProperty("name").GetString() ?? string.Empty;
        var status = dataElement.GetProperty("status").GetString() ?? string.Empty;

        if (!status.Contains("đang hoạt động", StringComparison.OrdinalIgnoreCase))
        {
            throw new AuthException(AuthErrorCodes.InvalidCredentials, $"This company is inactive/suspended: {status}.");
        }

        if (!IsFuzzyMatch(officialName, request.CompanyName))
        {
            throw new AuthException(AuthErrorCodes.InvalidCredentials, "Company name does not match the official tax registry business name.");
        }

        // Check if organization already exists in database
        var existingOrg = await _context.Organizations
            .FirstOrDefaultAsync(o => o.TaxCode == taxCode && o.DeletedAt == null, cancellationToken);

        if (existingOrg == null)
        {
            var normalizedOfficial = NormalizeCompanyNameForMatching(officialName);
            var allActiveOrgs = await _context.Organizations
                .Where(o => o.DeletedAt == null)
                .ToListAsync(cancellationToken);

            existingOrg = allActiveOrgs.FirstOrDefault(o => NormalizeCompanyNameForMatching(o.Name) == normalizedOfficial);
        }

        if (existingOrg != null)
        {
            return new VerifyCompanyOnboardingResponse(
                SignedToken: null,
                OfficialCompanyName: existingOrg.Name,
                TaxCode: existingOrg.TaxCode,
                OrganizationExists: true,
                OrganizationDisplayName: existingOrg.Name,
                OrganizationSlug: existingOrg.Username,
                RecoveryRequired: true
            );
        }

        var signedToken = OnboardingTokenHelper.GenerateStep1Token(taxCode, officialName, _envConfig.Jwt.Key);

        return new VerifyCompanyOnboardingResponse(signedToken, officialName, taxCode);
    }

    public async Task<VerifyOtpResponse> VerifyOnboardingOtpAsync(VerifyOtpRequest request, string step1Token, CancellationToken cancellationToken = default)
    {
        var step1Payload = OnboardingTokenHelper.VerifyToken(step1Token, _envConfig.Jwt.Key);
        if (step1Payload == null || step1Payload["step"] != "1")
        {
            throw new AuthException(AuthErrorCodes.InvalidToken, "Company verification context is invalid or expired.");
        }

        var taxCode = step1Payload["taxCode"];
        var companyName = step1Payload["companyName"];

        var normalizedEmail = NormalizeEmailPolicy(request.Email);
        if (!await ValidateEmailDomainMxAsync(normalizedEmail))
        {
            throw new AuthException(AuthErrorCodes.InvalidCredentials, "Email domain does not resolve to active mail hosts.");
        }

        var otpResult = await VerifyOtpAsync(request, cancellationToken);

        var signedStep2Token = OnboardingTokenHelper.GenerateStep2Token(taxCode, companyName, normalizedEmail, false, _envConfig.Jwt.Key);

        return new VerifyOtpResponse(request.ChallengeId, normalizedEmail, signedStep2Token);
    }

    public async Task<VerifyOtpResponse> VerifyOnboardingGoogleAsync(GoogleOnboardingLinkRequest request, CancellationToken cancellationToken = default)
    {
        var step1Payload = OnboardingTokenHelper.VerifyToken(request.Step1Token, _envConfig.Jwt.Key);
        if (step1Payload == null || step1Payload["step"] != "1")
        {
            throw new AuthException(AuthErrorCodes.InvalidToken, "Company verification context is invalid or expired.");
        }

        var taxCode = step1Payload["taxCode"];
        var companyName = step1Payload["companyName"];

        var settings = new GoogleJsonWebSignature.ValidationSettings
        {
            Audience = new[] { _envConfig.Auth.GoogleClientId },
            IssuedAtClockTolerance = TimeSpan.FromMinutes(5),
            ExpirationTimeClockTolerance = TimeSpan.FromMinutes(5)
        };

        var payload = await GoogleJsonWebSignature.ValidateAsync(request.IdToken, settings);
        if (payload == null)
        {
            throw new AuthException(AuthErrorCodes.InvalidCredentials, "Google ID token validation failed.");
        }

        var googleEmail = NormalizeEmailPolicy(payload.Email);

        var signedStep2Token = OnboardingTokenHelper.GenerateStep2Token(taxCode, companyName, googleEmail, true, _envConfig.Jwt.Key);

        return new VerifyOtpResponse(Guid.Empty, googleEmail, signedStep2Token);
    }

    public async Task<AuthResponse> CompleteOnboardingAsync(CompleteOnboardingRequest request, string userAgent, string ipAddress, CancellationToken cancellationToken = default)
    {
        await _passwordPolicyService.ValidateAndThrowAsync(request.Password, "Enterprise");

        // 1. Idempotency Protection check
        var httpContext = _httpContextAccessor.HttpContext;
        string? idempotencyKey = httpContext?.Request.Headers["X-Idempotency-Key"];
        if (!string.IsNullOrEmpty(idempotencyKey))
        {
            var cacheKey = $"idempotency:onboarding:{idempotencyKey}";
            var cachedResponse = await _cacheService.GetAsync<AuthResponse>(cacheKey);
            if (cachedResponse != null)
            {
                _logger.LogInformation("Idempotent onboarding complete request served from cache. Key: {Key}", idempotencyKey);
                return cachedResponse;
            }
        }

        // 2. Step 2 Token Validation
        var step2Payload = OnboardingTokenHelper.VerifyToken(request.Step2Token, _envConfig.Jwt.Key);
        if (step2Payload == null || step2Payload["step"] != "2")
        {
            throw new AuthException(AuthErrorCodes.InvalidToken, "Onboarding session is invalid or expired.");
        }

        var taxCode = step2Payload["taxCode"];
        var companyName = step2Payload["companyName"];
        var email = step2Payload["email"];
        var isGoogleLinked = bool.Parse(step2Payload["isGoogleLinked"]);

        // 3. Organization Identifier Slug constraints
        var normalizedSlug = request.OrganizationUsername.Trim().ToLowerInvariant();
        if (!System.Text.RegularExpressions.Regex.IsMatch(normalizedSlug, @"^[a-z0-9-]{4,32}$"))
        {
            throw new AuthException(AuthErrorCodes.InvalidCredentials, "Slug must be 4-32 alphanumeric or dash characters.");
        }

        var reservedList = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "admin", "root", "support", "system", "api", "cverify", "auth", "login", "workspace", "billing"
        };
        if (reservedList.Contains(normalizedSlug))
        {
            throw new AuthException(AuthErrorCodes.InvalidCredentials, $"The handle '{request.OrganizationUsername}' is a reserved keyword.");
        }

        if (IsImpersonatingBrand(normalizedSlug))
        {
            throw new AuthException(AuthErrorCodes.InvalidCredentials, "Impersonation of protected brands is prohibited.");
        }

        // 4. Atomic provision transaction boundary
        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var existingOrg = await _context.Organizations
                .FirstOrDefaultAsync(o => o.Username == normalizedSlug && o.DeletedAt == null, cancellationToken);
            if (existingOrg != null)
            {
                throw new AuthException(AuthErrorCodes.InvalidCredentials, "This organization handle is already taken.");
            }

            var user = await _context.Users
                .Include(u => u.Roles)
                .Include(u => u.AuthProviders)
                .Include(u => u.PasswordCredentials)
                .FirstOrDefaultAsync(u => u.Email == email && u.DeletedAt == null, cancellationToken);

            var defaultRole = await _context.Roles.FirstOrDefaultAsync(r => r.Name == "USER", cancellationToken);
            if (defaultRole == null)
            {
                throw new InvalidOperationException("Default user role not found.");
            }

            var passwordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);

            if (user == null)
            {
                user = new User
                {
                    Email = email,
                    FullName = $"{request.CompanyDisplayName} Owner",
                    Status = UserStatus.ACTIVE,
                    EmailVerifiedAt = _timeProvider.GetUtcNow().UtcDateTime,
                    CreatedAt = _timeProvider.GetUtcNow().UtcDateTime,
                    UpdatedAt = _timeProvider.GetUtcNow().UtcDateTime,
                    Roles = new List<Role> { defaultRole }
                };

                // Hash password via BCrypt
                user.PasswordHash = passwordHash;

                _context.Users.Add(user);
                await _context.SaveChangesAsync(cancellationToken);
            }
            else
            {
                // Multi-organization linking: update credentials and promotion
                user.PasswordHash = passwordHash;
                user.TransitionTo(UserStatus.ACTIVE);
                user.EmailVerifiedAt = _timeProvider.GetUtcNow().UtcDateTime;
                user.UpdatedAt = _timeProvider.GetUtcNow().UtcDateTime;
                await _context.SaveChangesAsync(cancellationToken);
            }

            // Map Password Auth Provider (always created/updated because a password is set)
            var passwordProvider = user.AuthProviders.FirstOrDefault(ap => ap.ProviderName == "Password" && ap.DeletedAt == null);
            if (passwordProvider == null)
            {
                passwordProvider = new AuthProvider
                {
                    UserId = user.Id,
                    ProviderName = "Password",
                    ProviderKey = email,
                    CreatedAt = _timeProvider.GetUtcNow()
                };
                _context.AuthProviders.Add(passwordProvider);
            }

            // Map Google Auth Provider if linked during onboarding
            if (isGoogleLinked)
            {
                var googleProvider = user.AuthProviders.FirstOrDefault(ap => ap.ProviderName == "Google" && ap.DeletedAt == null);
                if (googleProvider == null)
                {
                    googleProvider = new AuthProvider
                    {
                        UserId = user.Id,
                        ProviderName = "Google",
                        ProviderKey = email,
                        CreatedAt = _timeProvider.GetUtcNow()
                    };
                    _context.AuthProviders.Add(googleProvider);
                }
            }
            await _context.SaveChangesAsync(cancellationToken);

            // Deactivate existing active credentials
            var activeCredentials = user.PasswordCredentials.Where(pc => pc.IsActive && pc.DeletedAt == null).ToList();
            foreach (var cred in activeCredentials)
            {
                cred.IsActive = false;
                cred.RevokedAt = _timeProvider.GetUtcNow();
                cred.RevokedReason = "Password updated/rotated during onboarding";
                cred.UpdatedAt = _timeProvider.GetUtcNow().UtcDateTime;
            }

            // Password history register
            var newCred = new PasswordCredential
            {
                UserId = user.Id,
                PasswordHash = user.PasswordHash,
                IsActive = true,
                PasswordChangedAt = _timeProvider.GetUtcNow(),
                CreatedAt = _timeProvider.GetUtcNow(),
                UpdatedAt = _timeProvider.GetUtcNow()
            };
            _context.PasswordCredentials.Add(newCred);
            await _context.SaveChangesAsync(cancellationToken);

            // Create Organization with verification level 1 (Legal Verified!)
            var org = new Organization
            {
                Name = companyName,
                TaxCode = taxCode,
                Email = email,
                Username = normalizedSlug,
                IsVerified = true,
                VerificationLevel = 1,
                CreatedAt = _timeProvider.GetUtcNow(),
                UpdatedAt = _timeProvider.GetUtcNow()
            };
            _context.Organizations.Add(org);
            await _context.SaveChangesAsync(cancellationToken);

            // Link as Owner
            var authority = new OrganizationAuthority
            {
                OrganizationId = org.Id,
                UserId = user.Id,
                Role = "organization_owner",
                JoinedAt = _timeProvider.GetUtcNow()
            };
            _context.OrganizationAuthorities.Add(authority);

            // Create Workspace presentation details
            var workspace = new Workspace
            {
                OrganizationId = org.Id,
                DisplayName = org.Name,
                Slug = org.Username,
                Status = "active",
                CreatedAt = _timeProvider.GetUtcNow(),
                UpdatedAt = _timeProvider.GetUtcNow()
            };
            _context.Workspaces.Add(workspace);
            await _context.SaveChangesAsync(cancellationToken);

            // Create WorkspaceMember
            var workspaceMember = new WorkspaceMember
            {
                WorkspaceId = workspace.Id,
                UserId = user.Id,
                Role = "workspace_admin",
                JoinedAt = _timeProvider.GetUtcNow()
            };
            _context.WorkspaceMembers.Add(workspaceMember);
            await _context.SaveChangesAsync(cancellationToken);

            // Save Level 1 Verification audit metadata
            var verification = new OrganizationVerification
            {
                OrganizationId = org.Id,
                VerificationType = "Legal",
                IsVerified = true,
                VerifiedValue = taxCode,
                VerifiedAt = _timeProvider.GetUtcNow(),
                VerifiedBy = "System_VietQR_Lookups",
                Metadata = System.Text.Json.JsonSerializer.Serialize(new
                {
                    OfficialCompanyName = companyName,
                    TaxCode = taxCode,
                    VerifiedAt = DateTimeOffset.UtcNow,
                    ClientIp = ipAddress,
                    ClientAgent = userAgent
                })
            };
            _context.OrganizationVerifications.Add(verification);
            await _context.SaveChangesAsync(cancellationToken);

            await transaction.CommitAsync(cancellationToken);

            // JWT session generation
            var roles = await _identityRepository.GetUserRolesAsync(user.Id);
            var permissions = await _identityRepository.GetUserPermissionsAsync(user.Id);

            await CacheUserAuthDataAsync(user.Id, roles, permissions);

            var workspaceRoles = roles.Contains("BUSINESS") ? roles : roles.Concat(new[] { "BUSINESS" }).ToList();

            var jwt = _tokenService.GenerateJwtToken(user, workspaceRoles, permissions, org.Id, org.Username);
            var refreshTokenStr = _tokenService.GenerateRefreshToken();

            var sessionId = Guid.CreateVersion7();
            await SaveRefreshTokenAsync(user.Id, refreshTokenStr, sessionId, false);

            _tokenService.SetTokenInsideCookie("access_token", jwt, DateTime.UtcNow.AddMinutes(15));
            _tokenService.SetTokenInsideCookie("refresh_token", refreshTokenStr, DateTime.UtcNow.AddHours(24));

            await LogAuditEventAsync(user.Id, "ORGANIZATION_CREATED", $"Workspace organization '{normalizedSlug}' registered successfully.");
            
            var authResponse = new AuthResponse(org.Id, org.Email, org.Name, null, workspaceRoles, permissions, true, "ACTIVE", "DASHBOARD");

            // Cache for idempotency keys
            if (!string.IsNullOrEmpty(idempotencyKey))
            {
                var cacheKey = $"idempotency:onboarding:{idempotencyKey}";
                await _cacheService.SetAsync(cacheKey, authResponse, TimeSpan.FromMinutes(10));
            }

            return authResponse;
        }
        catch (DbUpdateException ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            _logger.LogWarning(ex, "Concurrency or duplicate database constraint triggered during workspace provisioning.");
            
            var exString = ex.ToString();
            if (exString.Contains("tax_code") || ex.InnerException?.Message.Contains("tax_code") == true)
            {
                throw new AuthException(AuthErrorCodes.InvalidCredentials, "This company has already been onboarded.", ex);
            }
            if (exString.Contains("username") || exString.Contains("organizations") || ex.InnerException?.Message.Contains("username") == true)
            {
                throw new AuthException(AuthErrorCodes.InvalidCredentials, "This organization handle is already taken.", ex);
            }
            throw new AuthException(AuthErrorCodes.InvalidCredentials, "Workspace provisioning conflict.", ex);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            _logger.LogError(ex, "Transaction failed during complete onboarding workspace provision.");
            throw;
        }
    }

    public async Task<AuthResponse?> CompanyLoginAsync(OrganizationLoginRequest request, string userAgent, string ipAddress)
    {
        var normalizedUsername = request.OrganizationUsername.Trim().ToLowerInvariant();
        var org = await _context.Organizations
            .Where(o => o.Username == normalizedUsername && o.DeletedAt == null)
            .FirstOrDefaultAsync();

        if (org == null)
        {
            return null;
        }

        var ownerMember = await _context.OrganizationAuthorities
            .Where(om => om.OrganizationId == org.Id && om.Role == "organization_owner")
            .FirstOrDefaultAsync();

        if (ownerMember == null)
        {
            return null;
        }

        var user = await _context.Users
            .Include(u => u.PasswordCredentials)
            .Where(u => u.Id == ownerMember.UserId && u.DeletedAt == null)
            .FirstOrDefaultAsync();

        if (user == null)
        {
            return null;
        }

        if (_accountService.IsAccountDisabled(user))
        {
            throw new UnauthorizedAccessException("Account is disabled.");
        }

        if (_accountService.IsAccountLocked(user))
        {
            throw new UnauthorizedAccessException($"Account is locked.");
        }

        var activeCred = user.PasswordCredentials
            .Where(pc => pc.IsActive && pc.DeletedAt == null)
            .OrderByDescending(pc => pc.CreatedAt)
            .FirstOrDefault();
        if (activeCred == null || !VerifyPassword(user, activeCred.PasswordHash, request.Password))
        {
            await _accountService.HandleFailedLoginAsync(user);
            await LogAuditEventAsync(user.Id, "USER_LOGIN_FAILED_CREDENTIALS", $"Invalid workspace password login attempt for org {normalizedUsername}.");
            return null;
        }

        await _accountService.ResetFailedAttemptsAsync(user);

        var roles = await _identityRepository.GetUserRolesAsync(user.Id);
        var permissions = await _identityRepository.GetUserPermissionsAsync(user.Id);

        await CacheUserAuthDataAsync(user.Id, roles, permissions);

        var workspaceRoles = roles.Contains("BUSINESS") ? roles : roles.Concat(new[] { "BUSINESS" }).ToList();

        var jwt = _tokenService.GenerateJwtToken(user, workspaceRoles, permissions, org.Id, org.Username);
        var refreshTokenStr = _tokenService.GenerateRefreshToken();

        var sessionId = Guid.CreateVersion7();
        await SaveRefreshTokenAsync(user.Id, refreshTokenStr, sessionId, false);

        _tokenService.SetTokenInsideCookie("access_token", jwt, DateTime.UtcNow.AddMinutes(15));
        _tokenService.SetTokenInsideCookie("refresh_token", refreshTokenStr, DateTime.UtcNow.AddHours(24));

        await LogAuditEventAsync(user.Id, "USER_LOGIN_SUCCESS", $"Logged in successfully via workspace organization {normalizedUsername}.");
        return new AuthResponse(org.Id, org.Email, org.Name, null, workspaceRoles, permissions, true, "ACTIVE", "DASHBOARD");
    }

    // --- ACTIVE SESSIONS & REVOCATIONS ---

    public async Task<IEnumerable<SessionInfo>> GetActiveSessionsAsync()
    {
        var userIdClaim = _httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null) return Enumerable.Empty<SessionInfo>();

        var userId = Guid.Parse(userIdClaim.Value);
        var currentRefreshToken = _httpContextAccessor.HttpContext?.Request.Cookies["refresh_token"];

        var activeTokens = await _context.RefreshTokens
            .Where(t => t.UserId == userId && t.RevokedAt == null && t.ExpiresAt > _timeProvider.GetUtcNow())
            .ToListAsync();

        var sessions = activeTokens
            .GroupBy(t => t.SessionId)
            .Select(g =>
            {
                var latestToken = g.OrderByDescending(t => t.CreatedAt).First();
                bool isCurrent = g.Any(t => t.Token == currentRefreshToken);

                return new SessionInfo(
                    latestToken.SessionId,
                    latestToken.UserAgent != null ? (latestToken.UserAgent.Contains("Windows") ? "Windows Desktop" : "Mobile Client") : "Web Application",
                    latestToken.UserAgent,
                    latestToken.IpAddress,
                    g.Min(t => t.CreatedAt),
                    latestToken.CreatedAt,
                    isCurrent
                );
            });

        return sessions;
    }

    public async Task<bool> RevokeSessionAsync(Guid sessionId)
    {
        var userIdClaim = _httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null) return false;

        var userId = Guid.Parse(userIdClaim.Value);
        var activeTokens = await _context.RefreshTokens
            .Where(t => t.UserId == userId && t.SessionId == sessionId && t.RevokedAt == null)
            .ToListAsync();

        if (!activeTokens.Any()) return false;

        foreach (var token in activeTokens)
        {
            token.RevokedAt = _timeProvider.GetUtcNow();
        }

        await _context.SaveChangesAsync();
        await LogAuditEventAsync(userId, "SESSION_REVOKED", $"Session {sessionId} successfully revoked by owner.");
        return true;
    }
}

