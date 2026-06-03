using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.AiChat.Entities;
using CVerify.API.Modules.Auth.DTOs;
using CVerify.API.Modules.Auth.Entities;
using CVerify.API.Modules.Auth.Enums;
using CVerify.API.Modules.Auth.Services;
using CVerify.API.Modules.Auth.Services.PasswordPolicies;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Exceptions;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.Modules.Recovery.Services;

public class PasswordRecoveryService : IPasswordRecoveryService
{
    private readonly ApplicationDbContext _context;
    private readonly ICacheService _cacheService;
    private readonly IAuthService _authService;
    private readonly IPasswordPolicyService _passwordPolicyService;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<PasswordRecoveryService> _logger;

    public PasswordRecoveryService(
        ApplicationDbContext context,
        ICacheService cacheService,
        IAuthService authService,
        IPasswordPolicyService passwordPolicyService,
        IHttpContextAccessor httpContextAccessor,
        TimeProvider timeProvider,
        ILogger<PasswordRecoveryService> logger)
    {
        _context = context;
        _cacheService = cacheService;
        _authService = authService;
        _passwordPolicyService = passwordPolicyService;
        _httpContextAccessor = httpContextAccessor;
        _timeProvider = timeProvider;
        _logger = logger;
    }

    public async Task<SendOtpResponse> SendOtpAsync(string email, string userAgent, string ipAddress, CancellationToken cancellationToken)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();

        // 1. Invalidate any previous active challenges and recovery tokens for this user flow
        var previousVerifications = await _context.OtpVerifications
            .Where(v => v.Email == normalizedEmail && v.Purpose == "PASSWORD_RECOVERY" && v.Status == OtpSessionStatus.ACTIVE)
            .ToListAsync(cancellationToken);

        foreach (var prev in previousVerifications)
        {
            prev.Status = OtpSessionStatus.INVALIDATED;
            prev.InvalidatedAt = _timeProvider.GetUtcNow();
            await _cacheService.RemoveAsync($"setup:token:{normalizedEmail}:{prev.ChallengeId}");
        }
        await _context.SaveChangesAsync(cancellationToken);

        // 2. Query user to determine event log type
        var user = await _context.Users
            .Include(u => u.PasswordCredentials)
            .FirstOrDefaultAsync(u => u.Email == normalizedEmail && u.DeletedAt == null, cancellationToken);

        var hasPassword = user != null && !string.IsNullOrEmpty(user.PasswordHash);
        string eventType = hasPassword ? "PASSWORD_RECOVERY_INITIATED" : "PASSWORD_SETUP_REQUESTED";

        // 3. Delegate to the core AuthService
        var otpRequest = new SendOtpRequest(email, "PASSWORD_RECOVERY");
        var response = await _authService.SendOtpAsync(otpRequest, userAgent, ipAddress, cancellationToken);

        await LogAuditEventAsync(user?.Id, eventType, $"Password setup/recovery OTP challenge generated for {normalizedEmail}.");
        return response;
    }

    public async Task<VerifyOtpResponse> VerifyOtpAsync(string email, string otp, CancellationToken cancellationToken)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();

        // Find the active verification challenge for PASSWORD_RECOVERY
        var verification = await _context.OtpVerifications
            .Where(v => v.Email == normalizedEmail && v.Purpose == "PASSWORD_RECOVERY" && v.Status == OtpSessionStatus.ACTIVE)
            .OrderByDescending(v => v.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (verification == null)
        {
            throw new AuthException(AuthErrorCodes.InvalidToken, "No active recovery session found.");
        }

        // Delegate code checking, locks, and verification attempts to AuthService
        var verifyRequest = new VerifyOtpRequest(verification.ChallengeId, normalizedEmail, otp, "PASSWORD_RECOVERY");
        try
        {
            return await _authService.VerifyOtpAsync(verifyRequest, cancellationToken);
        }
        catch (Exception ex)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail && u.DeletedAt == null, cancellationToken);
            var hasPassword = user != null && !string.IsNullOrEmpty(user.PasswordHash);
            string failEvent = hasPassword ? "PASSWORD_RECOVERY_FAILED" : "PASSWORD_SETUP_FAILED";
            await LogAuditEventAsync(user?.Id, failEvent, $"OTP verification failed for {normalizedEmail}. Error: {ex.Message}");
            throw;
        }
    }

    public async Task<bool> ChangePasswordAsync(string email, string recoveryToken, string newPassword, string confirmPassword, CancellationToken cancellationToken)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();

        // 1. Look up latest verified verification session
        var verification = await _context.OtpVerifications
            .Where(v => v.Email == normalizedEmail && v.Purpose == "PASSWORD_RECOVERY" && v.Status == OtpSessionStatus.VERIFIED)
            .OrderByDescending(v => v.ConsumedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (verification == null)
        {
            throw new AuthException(AuthErrorCodes.InvalidToken, "Identity verification is required.");
        }

        // 2. Validate token from cache
        var cacheKey = $"setup:token:{normalizedEmail}:{verification.ChallengeId}";
        var cachedToken = await _cacheService.GetAsync<string>(cacheKey);
        if (string.IsNullOrEmpty(cachedToken) || cachedToken != recoveryToken)
        {
            throw new AuthException(AuthErrorCodes.InvalidToken, "Invalid or expired recovery token.");
        }

        // 3. Confirm password matching
        if (newPassword != confirmPassword)
        {
            var tempUser = await _context.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail && u.DeletedAt == null, cancellationToken);
            var hasPw = tempUser != null && !string.IsNullOrEmpty(tempUser.PasswordHash);
            await LogAuditEventAsync(tempUser?.Id, hasPw ? "PASSWORD_RECOVERY_FAILED" : "PASSWORD_SETUP_FAILED", "Passwords do not match.");
            throw new AuthException(AuthErrorCodes.PasswordPolicyViolation, "Passwords do not match.");
        }

        // 4. Validate against policy
        try
        {
            await _passwordPolicyService.ValidateAndThrowAsync(newPassword, "Default");
        }
        catch (Exception ex)
        {
            var tempUser = await _context.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail && u.DeletedAt == null, cancellationToken);
            var hasPw = tempUser != null && !string.IsNullOrEmpty(tempUser.PasswordHash);
            await LogAuditEventAsync(tempUser?.Id, hasPw ? "PASSWORD_RECOVERY_FAILED" : "PASSWORD_SETUP_FAILED", $"Password policy violation: {ex.Message}");
            throw;
        }

        // 5. Retrieve user with historical credentials
        var user = await _context.Users
            .Include(u => u.PasswordCredentials)
            .FirstOrDefaultAsync(u => u.Email == normalizedEmail && u.DeletedAt == null, cancellationToken);

        if (user == null)
        {
            throw new ResourceNotFoundException("USER_NOT_FOUND", "User not found.");
        }

        // 6. Prevent reuse of current password
        var activeCred = user.PasswordCredentials
            .Where(pc => pc.IsActive && pc.DeletedAt == null)
            .OrderByDescending(pc => pc.CreatedAt)
            .FirstOrDefault();

        string? currentPasswordHash = activeCred?.PasswordHash ?? user.PasswordHash;

        if (!string.IsNullOrEmpty(currentPasswordHash) && VerifyPassword(user, currentPasswordHash, newPassword))
        {
            await LogAuditEventAsync(user.Id, "PASSWORD_REUSE_BLOCKED", "New password cannot be the same as your current active password.");
            throw new AuthException(AuthErrorCodes.PasswordPolicyViolation, "New password cannot be the same as your current active password.");
        }

        // Concurrency Guard against parallel provisioning or changes (Race condition protection)
        if (activeCred != null && activeCred.CreatedAt > verification.CreatedAt)
        {
            await LogAuditEventAsync(user.Id, "PASSWORD_SETUP_CONCURRENT_BLOCKED", "Password setup/recovery aborted. Credentials concurrently updated by another session.");
            throw new AuthException(AuthErrorCodes.ConcurrencyConflict, "Password was concurrently configured or changed by another session.");
        }

        var hasPasswordPrior = !string.IsNullOrEmpty(currentPasswordHash);

        // 7. Update password
        var newHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
        user.PasswordHash = newHash;
        user.UpdatedAt = _timeProvider.GetUtcNow().UtcDateTime;

        // Deactivate older active credentials
        foreach (var cred in user.PasswordCredentials.Where(pc => pc.IsActive && pc.DeletedAt == null))
        {
            cred.IsActive = false;
            cred.RevokedAt = _timeProvider.GetUtcNow();
            cred.RevokedReason = "PASSWORD_CHANGED";
            cred.UpdatedAt = _timeProvider.GetUtcNow();
        }

        // Add new active credential
        var newCred = new PasswordCredential
        {
            Id = Guid.CreateVersion7(),
            UserId = user.Id,
            PasswordHash = newHash,
            IsActive = true,
            PasswordChangedAt = _timeProvider.GetUtcNow(),
            CreatedAt = _timeProvider.GetUtcNow(),
            UpdatedAt = _timeProvider.GetUtcNow()
        };
        _context.PasswordCredentials.Add(newCred);

        // 8. Session-Management Invalidation
        if (hasPasswordPrior)
        {
            // Case B: Recovery Reset -> Revoke ALL active sessions globally
            var activeTokens = await _context.RefreshTokens
                .Where(t => t.UserId == user.Id && t.RevokedAt == null)
                .ToListAsync(cancellationToken);

            foreach (var token in activeTokens)
            {
                token.RevokedAt = _timeProvider.GetUtcNow();
            }

            await LogAuditEventAsync(user.Id, "PASSWORD_RECOVERY_COMPLETED", "Password recovery reset completed successfully. All sessions globally revoked.");
        }
        else
        {
            // Case A: First-time Setup -> Keep current session active (with token rotation), do not disrupt social sessions
            await LogAuditEventAsync(user.Id, "PASSWORD_SETUP_COMPLETED", "First-time password setup completed successfully.");
        }

        // 9. Cleanup state
        await _cacheService.RemoveAsync(cacheKey);
        await _cacheService.RemoveAsync($"auth:identity-state:{normalizedEmail}");
        verification.Status = OtpSessionStatus.INVALIDATED;
        verification.InvalidatedAt = _timeProvider.GetUtcNow();

        await _context.SaveChangesAsync(cancellationToken);
        _logger.LogInformation("PASSWORD_RECOVERY_SUCCESS: User {UserId} recovered/setup password successfully.", user.Id);
        
        return true;
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
