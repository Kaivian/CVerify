using System;
using System.Threading;
using System.Threading.Tasks;

namespace CVerify.API.Modules.Shared.Email.Services;

/// <summary>
/// Defines a contract for resolving normalized recipient profiles.
/// </summary>
public interface IEmailRecipientResolver
{
    /// <summary>
    /// Resolves a recipient profile by the user's primary or linked email address.
    /// </summary>
    Task<RecipientProfile> ResolveByEmailAsync(string email, CancellationToken cancellationToken = default);

    /// <summary>
    /// Resolves a recipient profile by the user identifier.
    /// </summary>
    Task<RecipientProfile> ResolveByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Resolves a recipient profile by the identity identifier (maps to UserId).
    /// </summary>
    Task<RecipientProfile> ResolveByIdentityIdAsync(Guid identityId, CancellationToken cancellationToken = default) =>
        ResolveByUserIdAsync(identityId, cancellationToken);
}

/// <summary>
/// Represents a normalized recipient profile containing only user identity information.
/// </summary>
public record RecipientProfile(
    string Email,
    string? DisplayName,
    string? Username
);
