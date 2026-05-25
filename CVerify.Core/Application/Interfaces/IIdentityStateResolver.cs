using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Core.Enums;

namespace CVerify.API.Application.Interfaces;

/// <summary>
/// Resolves the authentication state for an email identity.
/// Centralizes identity resolution logic used by all auth entry points,
/// ensuring consistent behavior across Google SSO, email onboarding, and password login flows.
/// </summary>
public interface IIdentityStateResolver
{
    /// <summary>
    /// Resolves the current authentication state for the given email.
    /// Uses Redis caching with a short TTL to avoid redundant DB lookups.
    /// </summary>
    Task<EmailAuthState> ResolveAsync(string email, CancellationToken cancellationToken = default);

    /// <summary>
    /// Invalidates the cached identity state for the given email.
    /// Must be called after state-changing operations (password creation, provider linking).
    /// </summary>
    Task InvalidateCacheAsync(string email);
}
