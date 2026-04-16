using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.Modules.Auth.Services;

public class AccountService : IAccountService
{
    private readonly ApplicationDbContext _context;
    private readonly IRateLimitPolicyService _rateLimitPolicyService;
    private const int MaxFailedAttempts = 5;
    private const int LockoutMinutes = 15;

    public AccountService(ApplicationDbContext context, IRateLimitPolicyService rateLimitPolicyService)
    {
        _context = context;
        _rateLimitPolicyService = rateLimitPolicyService;
    }

    public async Task HandleFailedLoginAsync(User user)
    {
        if (!_rateLimitPolicyService.ShouldEnforceCooldowns())
        {
            _rateLimitPolicyService.LogBypass("Account lockout handling", "HandleFailedLoginAsync", user.Email);
            return;
        }

        user.FailedAttempts++;
        user.LastFailedAt = DateTimeOffset.UtcNow;

        if (user.FailedAttempts >= MaxFailedAttempts)
        {
            user.LockUntil = DateTimeOffset.UtcNow.AddMinutes(LockoutMinutes);
        }

        user.UpdatedAt = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync();
    }

    public async Task ResetFailedAttemptsAsync(User user)
    {
        user.FailedAttempts = 0;
        user.LockUntil = null;
        user.LastLoginAt = DateTimeOffset.UtcNow;
        user.UpdatedAt = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync();
    }

    public bool IsAccountLocked(User user)
    {
        if (!_rateLimitPolicyService.ShouldEnforceCooldowns())
        {
            return false;
        }
        return user.LockUntil.HasValue && user.LockUntil > DateTimeOffset.UtcNow;
    }

    public bool IsAccountDisabled(User user)
    {
        return user.Status == UserStatus.BANNED || user.Status == UserStatus.DELETED;
    }
}