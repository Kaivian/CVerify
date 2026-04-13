namespace CVerify.API.Modules.Shared.Domain.Enums;

/// <summary>
/// Represents the resolved authentication state for an email identity.
/// States are intentionally neutral to avoid leaking internal credential structure.
/// All authentication entry points derive their flow from this single state model.
/// </summary>
public enum EmailAuthState
{
    /// <summary>
    /// No account exists for this email, or the account lacks password credentials.
    /// The user needs full onboarding (OTP verification → credential creation).
    /// </summary>
    REQUIRES_ONBOARDING,

    /// <summary>
    /// An account exists and has established credentials (password provider linked).
    /// The user should authenticate using their existing credentials.
    /// </summary>
    REQUIRES_AUTHENTICATION,

    /// <summary>
    /// An account exists but email verification is still pending.
    /// The user should complete email verification before proceeding.
    /// </summary>
    REQUIRES_VERIFICATION,

    /// <summary>
    /// The account is disabled, suspended, or banned.
    /// No authentication flow should proceed.
    /// </summary>
    ACCOUNT_RESTRICTED
}
