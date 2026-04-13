using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Persistence;

namespace CVerify.API.Modules.Auth.Services;

public class AccountService : IAccountService
{
    private readonly ApplicationDbContext _context;
    private const int MaxFailedAttempts = 5;
    private const int LockoutMinutes = 15;

    public AccountService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task HandleFailedLoginAsync(User user)
    {
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
        return user.LockUntil.HasValue && user.LockUntil > DateTimeOffset.UtcNow;
    }

    public bool IsAccountDisabled(User user)
    {
        return user.Status == UserStatus.BANNED || user.Status == UserStatus.DELETED;
    }
}