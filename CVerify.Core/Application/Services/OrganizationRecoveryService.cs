using System;
using System.Collections.Generic;
using System.Linq;
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

namespace CVerify.API.Application.Services;

public class OrganizationRecoveryService : IOrganizationRecoveryService
{
    private readonly ApplicationDbContext _context;
    private readonly IRecoveryTokenService _recoveryTokenService;
    private readonly ICacheService _cacheService;
    private readonly ITokenService _tokenService;
    private readonly IIdentityRepository _identityRepository;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly EnvConfiguration _envConfig;
    private readonly ILogger<OrganizationRecoveryService> _logger;
    private readonly AuthMetrics _metrics;
    private readonly TimeProvider _timeProvider;
    private readonly IPasswordPolicyService _passwordPolicyService;
    private readonly IOtpPolicyService _otpPolicyService;
    private readonly IRateLimitPolicyService _rateLimitPolicyService;

    public OrganizationRecoveryService(
        ApplicationDbContext context,
        IRecoveryTokenService recoveryTokenService,
        ICacheService cacheService,
        ITokenService tokenService,
        IIdentityRepository identityRepository,
        IHttpContextAccessor httpContextAccessor,
        EnvConfiguration envConfig,
        ILogger<OrganizationRecoveryService> logger,
        AuthMetrics metrics,
        TimeProvider timeProvider,
        IPasswordPolicyService passwordPolicyService,
        IOtpPolicyService otpPolicyService,
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
        _passwordPolicyService = passwordPolicyService;
        _otpPolicyService = otpPolicyService;
        _rateLimitPolicyService = rateLimitPolicyService;
    }

    public async Task<OrganizationForgotResponse> ForgotPasswordAsync(OrganizationForgotRequest request, CancellationToken cancellationToken = default)
    {
        var correlationId = Guid.NewGuid().ToString("N");
        _logger.LogInformation("[CorrelationID: {CorrelationId}] Handling Business forgot password for Tax Code: {TaxCode}.", correlationId, request.TaxCode);

        var normalizedTax = request.TaxCode.Trim();

        // Enforce cooldown per Tax Code in Cache to prevent spamming
        var cooldownKey = $"cooldown:org-forgot-password:{normalizedTax}";
        var isCooldown = await _cacheService.GetAsync<string>(cooldownKey);
        if (isCooldown != null)
        {
            if (_rateLimitPolicyService.DisableRateLimits)
            {
                _rateLimitPolicyService.LogBypass("Business recovery cooldown", "ForgotPasswordAsync", normalizedTax);
            }
            else
            {
                _logger.LogWarning("[CorrelationID: {CorrelationId}] Business recovery cooldown active for Tax Code: {TaxCode}.", correlationId, normalizedTax);
                throw new AuthException(AuthErrorCodes.CooldownActive, "Please wait before requesting another recovery OTP.");
            }
        }

        var org = await _context.Organizations
            .Include(o => o.Members)
            .FirstOrDefaultAsync(o => o.TaxCode == normalizedTax && o.DeletedAt == null, cancellationToken);

        // Strict Account Enumeration Prevention: if org is not found, return generic success with mock challenge details
        if (org == null)
        {
            _logger.LogInformation("[CorrelationID: {CorrelationId}] Tax Code {TaxCode} does not exist in registry. Returning mock success.", correlationId, normalizedTax);
            var mockCooldown = _rateLimitPolicyService.DisableRateLimits ? 0 : 60;
            return new OrganizationForgotResponse(Guid.NewGuid(), "o***@company.vn", mockCooldown);
        }

        // Resolve trusted corporate destination mailboxes internally on the backend
        var trustedEmails = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { org.Email };

        var ownersAndAdmins = await _context.OrganizationAuthorities
            .Include(oa => oa.User)
            .Where(oa => oa.OrganizationId == org.Id && (oa.Role == "organization_owner" || oa.Role == "organization_admin") && oa.User.DeletedAt == null)
            .Select(oa => oa.User.Email)
            .ToListAsync(cancellationToken);

        foreach (var email in ownersAndAdmins)
        {
            if (!string.IsNullOrWhiteSpace(email))
            {
                trustedEmails.Add(email.Trim().ToLowerInvariant());
            }
        }

        if (!trustedEmails.Any())
        {
            _logger.LogWarning("[CorrelationID: {CorrelationId}] No active trust mailboxes found for organization {OrgId}.", correlationId, org.Id);
            var mockCooldown = _rateLimitPolicyService.DisableRateLimits ? 0 : 60;
            return new OrganizationForgotResponse(Guid.NewGuid(), "o***@company.vn", mockCooldown);
        }

        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var firstChallengeId = Guid.NewGuid();
            var challengeMap = new List<OtpVerification>();

            // Generate secure OTP
            var otpBytes = RandomNumberGenerator.GetBytes(4);
            var otpVal = BitConverter.ToUInt32(otpBytes, 0) % 900000 + 100000; // 6-digit numeric OTP
            var plainOtp = otpVal.ToString();
            var otpHash = GenerateHmacSha256OtpHash(plainOtp);

            // Invalidate any existing OTP verifications for resolved emails with purpose "OrganizationRecovery"
            var oldVerifications = await _context.OtpVerifications
                .Where(v => trustedEmails.Contains(v.Email) && v.Purpose == "OrganizationRecovery" && v.ConsumedAt == null)
                .ToListAsync(cancellationToken);

            foreach (var oldV in oldVerifications)
            {
                oldV.ConsumedAt = _timeProvider.GetUtcNow(); // consume/invalidate
            }

            // Standardize challenges inside transactional consistency boundary
            foreach (var email in trustedEmails)
            {
                var challengeId = (email == org.Email) ? firstChallengeId : Guid.NewGuid();
                var verification = new OtpVerification
                {
                    Id = Guid.CreateVersion7(),
                    ChallengeId = challengeId,
                    Email = email,
                    OtpHash = otpHash,
                    Purpose = "OrganizationRecovery",
                    ExpiresAt = _timeProvider.GetUtcNow().AddMinutes(15),
                    Attempts = 0
                };
                _context.OtpVerifications.Add(verification);

                // Outbox dispatch wrapper
                var payloadObj = new
                {
                    Email = email,
                    CompanyName = org.Name,
                    TaxCode = org.TaxCode,
                    Code = plainOtp,
                    CorrelationId = correlationId
                };

                var outboxMessage = new OutboxMessage
                {
                    Type = "OrganizationRecoveryOtp",
                    Payload = System.Text.Json.JsonSerializer.Serialize(payloadObj),
                    CreatedAt = _timeProvider.GetUtcNow()
                };
                _context.OutboxMessages.Add(outboxMessage);
            }

            // Set 1-minute rate limiting cooldown in Cache
            var cooldownTime = _rateLimitPolicyService.DisableRateLimits ? TimeSpan.Zero : TimeSpan.FromMinutes(1);
            await _cacheService.SetAsync(cooldownKey, "active", cooldownTime);

            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            await LogAuditEventAsync(null, "ORG_PASSWORD_RECOVERY_OTP_DISPATCHED", $"Corporate password recovery OTP enqueued for resolved mailboxes of organization {org.Name} (Tax Code: {org.TaxCode}).");

            var maskedConfirmation = MaskEmail(org.Email);
            _logger.LogInformation("[CorrelationID: {CorrelationId}] Business recovery OTP dispatched successfully for organization {OrgId}.", correlationId, org.Id);
            var actualCooldown = _rateLimitPolicyService.DisableRateLimits ? 0 : 60;
            return new OrganizationForgotResponse(firstChallengeId, maskedConfirmation, actualCooldown);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[CorrelationID: {CorrelationId}] Business recovery OTP transaction failed. Rolling back.", correlationId);
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task<VerifyOrganizationOtpResponse> VerifyRecoveryOtpAsync(VerifyOrganizationOtpRequest request, CancellationToken cancellationToken = default)
    {
        _otpPolicyService.ValidateAndThrow(request.Code, "Default");
        var correlationId = Guid.NewGuid().ToString("N");
        _logger.LogInformation("[CorrelationID: {CorrelationId}] Verifying recovery OTP for Challenge: {ChallengeId}.", correlationId, request.ChallengeId);

        var normalizedTax = request.TaxCode.Trim();

        var org = await _context.Organizations
            .FirstOrDefaultAsync(o => o.TaxCode == normalizedTax && o.DeletedAt == null, cancellationToken);

        if (org == null)
        {
            throw new KeyNotFoundException("The requested organization was not found in the registry.");
        }

        var verification = await _context.OtpVerifications
            .FirstOrDefaultAsync(v => v.ChallengeId == request.ChallengeId && v.Purpose == "OrganizationRecovery" && v.ConsumedAt == null, cancellationToken);

        if (verification == null)
        {
            _logger.LogWarning("[CorrelationID: {CorrelationId}] Corporate OTP verification failed: invalid challenge.", correlationId);
            throw new AuthException(AuthErrorCodes.InvalidToken, "The recovery OTP challenge is invalid or has expired.");
        }

        if (verification.ExpiresAt <= _timeProvider.GetUtcNow())
        {
            _logger.LogWarning("[CorrelationID: {CorrelationId}] Corporate OTP verification failed: challenge expired.", correlationId);
            throw new AuthException(AuthErrorCodes.ExpiredToken, "The recovery OTP challenge has expired.");
        }

        var maxAttempts = _rateLimitPolicyService.DisableRateLimits ? 9999 : 5;
        if (verification.Attempts >= maxAttempts)
        {
            if (_rateLimitPolicyService.DisableRateLimits)
            {
                _rateLimitPolicyService.LogBypass("Corporate OTP verification attempts limit", "VerifyRecoveryOtpAsync", request.ChallengeId.ToString());
            }
            else
            {
                _logger.LogWarning("[CorrelationID: {CorrelationId}] Corporate OTP verification failed: too many attempts.", correlationId);
                throw new AuthException(AuthErrorCodes.MaxAttemptsReached, "Too many failed attempts. This OTP has been blocked.");
            }
        }

        var inputHash = GenerateHmacSha256OtpHash(request.Code);
        bool matches = string.Equals(verification.OtpHash, inputHash, StringComparison.OrdinalIgnoreCase);

        verification.Attempts += 1;
        verification.LastAttemptAt = _timeProvider.GetUtcNow();

        if (!matches)
        {
            await _context.SaveChangesAsync(cancellationToken);
            _logger.LogWarning("[CorrelationID: {CorrelationId}] Corporate OTP mismatch.", correlationId);
            throw new AuthException(AuthErrorCodes.InvalidCredentials, "The verification code entered is incorrect.");
        }

        // Consume OTP verification
        verification.ConsumedAt = _timeProvider.GetUtcNow();
        await _context.SaveChangesAsync(cancellationToken);

        // Find associated user matching the verified challenge email address
        var targetUser = await _context.Users
            .FirstOrDefaultAsync(u => u.Email == verification.Email && u.DeletedAt == null, cancellationToken);

        Guid? targetUserId = targetUser?.Id;

        // Issue short-lived database-persisted reset token using standard IRecoveryTokenService
        var (tokenEntity, plainToken) = await _recoveryTokenService.IssueTokenAsync(
            userId: targetUserId,
            organizationId: org.Id,
            tokenType: RecoveryTokenType.OrganizationRecoveryReset,
            purpose: "OrganizationRecoveryReset",
            expiryDuration: TimeSpan.FromMinutes(10),
            metadataJson: GetCurrentRequestMetadata(),
            cancellationToken: cancellationToken);

        _logger.LogInformation("[CorrelationID: {CorrelationId}] Corporate recovery OTP verified successfully. Reset token generated.", correlationId);
        return new VerifyOrganizationOtpResponse(plainToken);
    }

    public async Task<AuthResponse?> ResetPasswordAsync(ResetOrganizationPasswordRequest request, CancellationToken cancellationToken = default)
    {
        var correlationId = Guid.NewGuid().ToString("N");
        _logger.LogInformation("[CorrelationID: {CorrelationId}] Handling Business password reset request.", correlationId);

        await _passwordPolicyService.ValidateAndThrowAsync(request.NewPassword, "Enterprise");

        var tokenEntity = await _recoveryTokenService.ValidateTokenAsync(request.Token, RecoveryTokenType.OrganizationRecoveryReset, cancellationToken);
        if (tokenEntity == null || !tokenEntity.OrganizationId.HasValue)
        {
            _logger.LogWarning("[CorrelationID: {CorrelationId}] Business password reset failed: invalid token.", correlationId);
            throw new AuthException(AuthErrorCodes.InvalidToken, "The password reset token is invalid or has expired.");
        }

        var org = await _context.Organizations.FindAsync(new object[] { tokenEntity.OrganizationId.Value }, cancellationToken);
        if (org == null)
        {
            throw new KeyNotFoundException("The target organization was not found.");
        }

        // Resolve target user that verified the OTP
        if (!tokenEntity.UserId.HasValue)
        {
            throw new AuthException(AuthErrorCodes.InvalidToken, "The recovery session does not have an active associated user.");
        }

        var user = await _context.Users
            .Include(u => u.Roles)
            .FirstOrDefaultAsync(u => u.Id == tokenEntity.UserId.Value && u.DeletedAt == null, cancellationToken);

        if (user == null)
        {
            throw new KeyNotFoundException("Associated administrative user was not found.");
        }

        // Verify that this user is indeed an active administrator of the target organization
        var authority = await _context.OrganizationAuthorities
            .FirstOrDefaultAsync(oa => oa.OrganizationId == org.Id && oa.UserId == user.Id, cancellationToken);

        if (authority == null || (authority.Role != "organization_owner" && authority.Role != "organization_admin"))
        {
            throw new AuthException(AuthErrorCodes.Unauthorized, "The requesting user is not authorized to reset credentials for this organization.");
        }

        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            // Consume reset token
            await _recoveryTokenService.ConsumeTokenAsync(tokenEntity.Id, cancellationToken);

            // Rotate password hash
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
            user.UpdatedAt = _timeProvider.GetUtcNow().UtcDateTime;

            // Globally revoke active user sessions
            user.SessionVersion++;

            var activeSessions = await _context.RefreshTokens
                .Where(t => t.UserId == user.Id && t.RevokedAt == null && t.ExpiresAt > _timeProvider.GetUtcNow())
                .ToListAsync(cancellationToken);

            foreach (var session in activeSessions)
            {
                session.RevokedAt = _timeProvider.GetUtcNow();
            }

            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            await LogAuditEventAsync(user.Id, "ORG_PASSWORD_RESET_SUCCESS", $"Password reset successfully. Sessions globally revoked for administrator {user.Email} of {org.Name} (Tax Code: {org.TaxCode}).");

            var roles = await _identityRepository.GetUserRolesAsync(user.Id);
            var permissions = await _identityRepository.GetUserPermissionsAsync(user.Id);
            var workspaceRoles = roles.Contains("BUSINESS") ? roles : roles.Concat(new[] { "BUSINESS" }).ToList();

            _logger.LogInformation("[CorrelationID: {CorrelationId}] Business password reset successfully. Auto-login bypassed.", correlationId);
            _metrics.RecordPasswordReset();

            return new AuthResponse(org.Id, org.Email, org.Name, null, workspaceRoles, permissions, true, "ACTIVE", "LOGIN");
        }
        catch (DbUpdateConcurrencyException ex)
        {
            _logger.LogWarning(ex, "[CorrelationID: {CorrelationId}] Concurrency conflict detected during Business password reset.", correlationId);
            await transaction.RollbackAsync(cancellationToken);
            throw new AuthException(AuthErrorCodes.InvalidToken, "A concurrency conflict occurred. Please retry your request.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[CorrelationID: {CorrelationId}] Business password reset transaction failed. Rolling back.", correlationId);
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    private string GenerateHmacSha256OtpHash(string plainOtp)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_envConfig.Jwt.Key));
        var hashBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(plainOtp));
        return Convert.ToHexString(hashBytes).ToLowerInvariant();
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
