using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.Auth.DTOs;
using CVerify.API.Modules.Auth.Entities;
using CVerify.API.Modules.Auth.Services;
using CVerify.API.Modules.Recovery.Entities;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.Diagnostics;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Email.Entities;
using CVerify.API.Modules.Shared.Exceptions;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.Modules.Recovery.Services;

public class CandidateRecoveryService : ICandidateRecoveryService
{
    private readonly ApplicationDbContext _context;
    private readonly IRecoveryTokenService _recoveryTokenService;
    private readonly ICacheService _cacheService;
    private readonly ITokenService _tokenService;
    private readonly IIdentityRepository _identityRepository;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly EnvConfiguration _envConfig;
    private readonly ILogger<CandidateRecoveryService> _logger;
    private readonly AuthMetrics _metrics;
    private readonly TimeProvider _timeProvider;
    private readonly IRateLimitPolicyService _rateLimitPolicyService;

    public CandidateRecoveryService(
        ApplicationDbContext context,
        IRecoveryTokenService recoveryTokenService,
        ICacheService cacheService,
        ITokenService tokenService,
        IIdentityRepository identityRepository,
        IHttpContextAccessor httpContextAccessor,
        EnvConfiguration envConfig,
        ILogger<CandidateRecoveryService> logger,
        AuthMetrics metrics,
        TimeProvider timeProvider,
        IRateLimitPolicyService rateLimitPolicyService)
    {
        _context = context;
        _recoveryTokenService = recoveryTokenService;
        _cacheService = cacheService;
        _tokenService = tokenService;
        _identityRepository = identityRepository;
        _httpContextAccessor = httpContextAccessor;
        _envConfig = envConfig;
        _logger = logger;
        _metrics = metrics;
        _timeProvider = timeProvider;
        _rateLimitPolicyService = rateLimitPolicyService;
    }

    public async Task<bool> ForgotPasswordAsync(ForgotPasswordRequest request, CancellationToken cancellationToken = default)
    {
        var correlationId = Guid.NewGuid().ToString("N");
        _logger.LogInformation("[CorrelationID: {CorrelationId}] Handling Candidate forgot password for {Email}.", correlationId, request.Email);

        var normalizedEmail = request.Email.Trim().Normalize(NormalizationForm.FormC).ToLowerInvariant();

        // Enforce cooldown in cache to prevent spamming
        var cooldownKey = $"cooldown:candidate-forgot-password:{normalizedEmail}";
        var isCooldown = await _cacheService.GetAsync<string>(cooldownKey);
        if (isCooldown != null)
        {
            if (_rateLimitPolicyService.DisableRateLimits)
            {
                _rateLimitPolicyService.LogBypass("Candidate forgot password cooldown", "ForgotPasswordAsync", normalizedEmail);
            }
            else
            {
                _logger.LogWarning("[CorrelationID: {CorrelationId}] Candidate forgot password cooldown active for {Email}.", correlationId, normalizedEmail);
                throw new AuthException(AuthErrorCodes.CooldownActive, "Please wait before requesting another recovery email.");
            }
        }

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail, cancellationToken);

        // Strict Account Enumeration Prevention: always return generic success
        if (user == null)
        {
            _logger.LogInformation("[CorrelationID: {CorrelationId}] Candidate forgot password for non-existent email. Returning safe success.", correlationId);
            return true;
        }

        if (user.Status != UserStatus.ACTIVE && user.Status != UserStatus.EMAIL_VERIFY_PENDING)
        {
            _logger.LogWarning("[CorrelationID: {CorrelationId}] Candidate status is suspended/banned/deleted. Returning safe success.", correlationId);
            return true;
        }

        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            // Token Rotation: Revoke all existing password reset tokens for this candidate
            await _recoveryTokenService.RevokeActiveTokensAsync(user.Id, null, RecoveryTokenType.CandidatePasswordReset, cancellationToken);

            // Generate secure URL-safe password reset token
            var (tokenEntity, plainToken) = await _recoveryTokenService.IssueTokenAsync(
                userId: user.Id,
                organizationId: null,
                tokenType: RecoveryTokenType.CandidatePasswordReset,
                purpose: "CandidateForgotPassword",
                expiryDuration: TimeSpan.FromMinutes(5),
                metadataJson: GetCurrentRequestMetadata(),
                cancellationToken: cancellationToken);

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

            // Set 1-minute rate limiting cooldown in Cache
            var cooldownTime = _rateLimitPolicyService.DisableRateLimits ? TimeSpan.Zero : TimeSpan.FromMinutes(1);
            await _cacheService.SetAsync(cooldownKey, "active", cooldownTime);

            await transaction.CommitAsync(cancellationToken);

            await LogAuditEventAsync(user.Id, "CANDIDATE_PASSWORD_RECOVERY_REQUESTED", $"Password recovery token requested for {user.Email}.");

            _logger.LogInformation("[CorrelationID: {CorrelationId}] Candidate password reset token generated and outbox enqueued for user {UserId}.", correlationId, user.Id);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[CorrelationID: {CorrelationId}] Candidate Forgot password transaction failed. Rolling back.", correlationId);
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task<AuthResponse?> ResetPasswordAsync(ResetPasswordRequest request, CancellationToken cancellationToken = default)
    {
        var correlationId = Guid.NewGuid().ToString("N");
        _logger.LogInformation("[CorrelationID: {CorrelationId}] Processing Candidate password reset request.", correlationId);

        var tokenEntity = await _recoveryTokenService.ValidateTokenAsync(request.Token, RecoveryTokenType.CandidatePasswordReset, cancellationToken);
        if (tokenEntity == null || tokenEntity.User == null)
        {
            _logger.LogWarning("[CorrelationID: {CorrelationId}] Candidate password reset failed: invalid or expired token.", correlationId);
            throw new AuthException(AuthErrorCodes.InvalidToken, "The password reset token is invalid or has expired.");
        }

        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            // Consume the recovery token
            await _recoveryTokenService.ConsumeTokenAsync(tokenEntity.Id, cancellationToken);

            var user = tokenEntity.User;
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
            user.UpdatedAt = _timeProvider.GetUtcNow().UtcDateTime;

            // Globally revoke all active user sessions across devices
            user.SessionVersion++; // Invalidate existing session version

            var activeSessions = await _context.RefreshTokens
                .Where(t => t.UserId == user.Id && t.RevokedAt == null && t.ExpiresAt > _timeProvider.GetUtcNow())
                .ToListAsync(cancellationToken);

            foreach (var session in activeSessions)
            {
                session.RevokedAt = _timeProvider.GetUtcNow();
            }

            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            await LogAuditEventAsync(user.Id, "CANDIDATE_PASSWORD_RESET_SUCCESS", $"Password reset successfully. Sessions globally revoked for {user.Email}.");

            var roles = await _identityRepository.GetUserRolesAsync(user.Id);
            var permissions = await _identityRepository.GetUserPermissionsAsync(user.Id);

            await CacheUserAuthDataAsync(user.Id, roles, permissions);

            var jwt = _tokenService.GenerateJwtToken(user, roles, permissions);
            var refreshTokenStr = _tokenService.GenerateRefreshToken();

            var sessionId = Guid.CreateVersion7();
            await SaveRefreshTokenAsync(user.Id, refreshTokenStr, sessionId, false);

            _tokenService.SetTokenInsideCookie("access_token", jwt, DateTime.UtcNow.AddMinutes(15));
            _tokenService.SetTokenInsideCookie("refresh_token", refreshTokenStr, DateTime.UtcNow.AddHours(24));

            _logger.LogInformation("[CorrelationID: {CorrelationId}] Candidate password reset successfully and user {UserId} auto-logged in.", correlationId, user.Id);
            _metrics.RecordPasswordReset();

            return new AuthResponse(user.Id, user.Email, user.FullName, user.AvatarUrl, roles, permissions, true, "ACTIVE", "DASHBOARD");
        }
        catch (DbUpdateConcurrencyException ex)
        {
            _logger.LogWarning(ex, "[CorrelationID: {CorrelationId}] Concurrency conflict detected during Candidate password reset.", correlationId);
            await transaction.RollbackAsync(cancellationToken);
            throw new AuthException(AuthErrorCodes.InvalidToken, "A concurrency conflict occurred. Please retry your request.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[CorrelationID: {CorrelationId}] Candidate password reset transaction failed. Rolling back.", correlationId);
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    private string? GetCurrentRequestMetadata()
    {
        var httpContext = _httpContextAccessor.HttpContext;
        if (httpContext == null) return null;

        var metadata = new
        {
            IpAddress = httpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = httpContext.Request.Headers["User-Agent"].ToString(),
            Timestamp = _timeProvider.GetUtcNow()
        };
        return System.Text.Json.JsonSerializer.Serialize(metadata);
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

    private async Task SaveRefreshTokenAsync(Guid userId, string tokenStr, Guid sessionId, bool rememberMe)
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
            ExpiresAt = _timeProvider.GetUtcNow().Add(expiration),
            UserAgent = string.IsNullOrWhiteSpace(userAgent) ? null : (userAgent.Length > 500 ? userAgent[..500] : userAgent),
            IpAddress = string.IsNullOrWhiteSpace(ipAddress) ? null : (ipAddress.Length > 45 ? ipAddress[..45] : ipAddress)
        };
        _context.RefreshTokens.Add(refreshToken);
        await _context.SaveChangesAsync();
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
}
