namespace CVerify.API.Modules.Auth.Enums;

/// <summary>
/// Represents the explicit status states of an OTP verification session.
/// </summary>
public enum OtpSessionStatus
{
    /// <summary>
    /// The OTP session is active, has not been verified yet, and is within expiration limits.
    /// </summary>
    ACTIVE,

    /// <summary>
    /// The OTP has been successfully verified.
    /// </summary>
    VERIFIED,

    /// <summary>
    /// The OTP session has reached its expiration time.
    /// </summary>
    EXPIRED,

    /// <summary>
    /// The OTP session has been superseded, invalidated, or force-cancelled.
    /// </summary>
    INVALIDATED,

    /// <summary>
    /// The OTP session has been locked due to too many failed attempts.
    /// </summary>
    LOCKED
}
