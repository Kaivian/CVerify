using System;
using System.Collections.Generic;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Exceptions;
using CVerify.API.Modules.Shared.Exceptions.Catalogs;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.Modules.Shared.Security;

public class UsernameService : IUsernameService
{
    private readonly ApplicationDbContext _context;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<UsernameService> _logger;
    private readonly IRateLimitPolicyService _rateLimitPolicyService;

    private static readonly HashSet<string> ReservedUsernames = new(StringComparer.OrdinalIgnoreCase)
    {
        "admin", "api", "login", "register", "settings", "dashboard", "profile", "privacy", "terms", "support", "help",
        "chat", "business", "user", "organization", "auth", "system", "unauthorized", "company-onboarding", 
        "company-verification", "continue-with-email", "forgot-password", "gateway", "reset-password", "verify-email", "workspace-setup"
    };

    private static readonly Regex UsernamePattern = new(@"^[a-zA-Z0-9_\-\.]+$", RegexOptions.Compiled);

    public UsernameService(
        ApplicationDbContext context,
        TimeProvider timeProvider,
        ILogger<UsernameService> logger,
        IRateLimitPolicyService rateLimitPolicyService)
    {
        _context = context;
        _timeProvider = timeProvider;
        _logger = logger;
        _rateLimitPolicyService = rateLimitPolicyService;
    }

    public void ValidateUsername(string username)
    {
        if (string.IsNullOrWhiteSpace(username))
        {
            throw new ValidationException("Username cannot be empty.");
        }

        var normalized = Normalize(username);

        if (normalized.Length < 3)
        {
            throw new ValidationException("Username must be at least 3 characters long.");
        }

        if (normalized.Length > 30)
        {
            throw new ValidationException("Username cannot exceed 30 characters.");
        }

        if (!UsernamePattern.IsMatch(normalized))
        {
            throw new ValidationException("Username can only contain alphanumeric characters, underscores, hyphens, and periods.");
        }

        if (IsReserved(normalized))
        {
            throw new ValidationException($"The username '{username}' is reserved and cannot be used.");
        }
    }

    public bool IsReserved(string username)
    {
        return ReservedUsernames.Contains(username.Trim());
    }

    public string Normalize(string username)
    {
        return username.Trim().ToLowerInvariant();
    }

    public string GenerateBaseUsername(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return "user";
        }

        var parts = email.Split('@');
        var localPart = parts[0];

        // Sanitize: strip non-allowed characters
        var sb = new StringBuilder();
        foreach (var c in localPart)
        {
            if (char.IsLetterOrDigit(c) || c == '_' || c == '-' || c == '.')
            {
                sb.Append(c);
            }
        }

        var baseUsername = sb.ToString();

        if (baseUsername.Length > 28)
        {
            baseUsername = baseUsername.Substring(0, 28);
        }
        else if (baseUsername.Length < 3)
        {
            baseUsername = baseUsername.PadRight(3, 'x');
        }

        if (string.IsNullOrEmpty(baseUsername))
        {
            baseUsername = "user";
        }

        return baseUsername.ToLowerInvariant();
    }

    public async Task<string> GenerateUniqueUsernameAsync(string email, CancellationToken cancellationToken = default)
    {
        var baseUsername = GenerateBaseUsername(email);
        var candidate = baseUsername;
        int suffix = 1;

        if (IsReserved(candidate))
        {
            candidate = $"{baseUsername}{suffix}";
            suffix++;
        }

        while (true)
        {
            var isTaken = await _context.Users.AnyAsync(u => u.Username == candidate, cancellationToken);
            if (!isTaken)
            {
                return candidate;
            }

            candidate = $"{baseUsername}{suffix}";
            suffix++;
        }
    }

    public async Task<string> RunWithUsernameRetryAsync(User user, string email, Func<Task> saveAction, int maxRetries = 5, CancellationToken cancellationToken = default)
    {
        var baseUsername = GenerateBaseUsername(email);
        int suffix = 0;

        for (int attempt = 0; attempt < maxRetries; attempt++)
        {
            var candidate = suffix == 0 ? baseUsername : $"{baseUsername}{suffix}";

            if (IsReserved(candidate))
            {
                suffix = Math.Max(suffix + 1, 1);
                candidate = $"{baseUsername}{suffix}";
            }

            // Optimistic check in current transaction
            var isTaken = await _context.Users.AnyAsync(u => u.Username == candidate && u.Id != user.Id, cancellationToken);
            if (isTaken)
            {
                suffix++;
                continue;
            }

            user.Username = candidate;
            user.UpdatedAt = _timeProvider.GetUtcNow();

            try
            {
                await saveAction();
                return candidate; // Saved successfully!
            }
            catch (DbUpdateException ex) when (ex.InnerException is Npgsql.PostgresException pgEx && pgEx.SqlState == "23505" && pgEx.ConstraintName?.Contains("username") == true)
            {
                _logger.LogWarning(ex, "Username collision detected for '{Candidate}'. Retrying with a new suffix (attempt {Attempt}/{MaxRetries}).", candidate, attempt + 1, maxRetries);
                suffix++;
            }
        }

        throw new AuthException(AuthErrorCodes.AccountConflict, "Failed to allocate a unique username due to persistent concurrent registration collisions.");
    }

    public async Task CheckChangeCooldownAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        if (!_rateLimitPolicyService.ShouldEnforceCooldowns())
        {
            _rateLimitPolicyService.LogBypass("Username change cooldown", "CheckChangeCooldownAsync", userId.ToString());
            return;
        }

        var user = await _context.Users.FindAsync(new object[] { userId }, cancellationToken);
        if (user == null)
        {
            return;
        }

        if (user.LastUsernameChangeAt.HasValue)
        {
            var elapsed = _timeProvider.GetUtcNow() - user.LastUsernameChangeAt.Value;
            if (elapsed < TimeSpan.FromDays(30))
            {
                var remaining = TimeSpan.FromDays(30) - elapsed;
                throw new ValidationException($"You can only change your username once every 30 days. Please wait {Math.Ceiling(remaining.TotalDays)} more days.");
            }
        }
    }
}
