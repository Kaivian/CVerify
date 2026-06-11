using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Persistence;

namespace CVerify.API.Modules.Shared.Email.Services;

/// <summary>
/// Resolves and sanitizes recipient profile information from database records.
/// </summary>
public class EmailRecipientResolver : IEmailRecipientResolver
{
    private readonly ApplicationDbContext _context;
    private readonly EmailSettings _settings;

    /// <summary>
    /// Initializes a new instance of the <see cref="EmailRecipientResolver"/> class.
    /// </summary>
    public EmailRecipientResolver(ApplicationDbContext context, IOptions<EmailSettings> settings)
    {
        _context = context;
        _settings = settings.Value;
    }

    /// <inheritdoc />
    public async Task<RecipientProfile> ResolveByEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(email);
        var targetEmail = email.Trim();

        // Query by primary email or linked email addresses
        var user = await _context.FindUserByEmailAsync(targetEmail, cancellationToken)
            .ConfigureAwait(false);

        if (user == null)
        {
            return new RecipientProfile(targetEmail, null, null);
        }

        return CreateProfile(targetEmail, user);
    }

    /// <inheritdoc />
    public async Task<RecipientProfile> ResolveByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken)
            .ConfigureAwait(false);

        if (user == null)
        {
            return new RecipientProfile(string.Empty, null, null);
        }

        return CreateProfile(user.Email, user);
    }

    private RecipientProfile CreateProfile(string email, User user)
    {
        var displayName = GetSanitizedName(user.FullName);
        var username = GetSanitizedName(user.Username);

        return new RecipientProfile(email, displayName, username);
    }

    private string? GetSanitizedName(string? name)
    {
        if (string.IsNullOrWhiteSpace(name)) return null;
        var trimmed = name.Trim();

        var invalid = _settings.InvalidPlaceholders;
        if (invalid != null)
        {
            foreach (var placeholder in invalid)
            {
                if (string.Equals(trimmed, placeholder, StringComparison.OrdinalIgnoreCase))
                {
                    return null;
                }
            }
        }

        return trimmed;
    }
}
