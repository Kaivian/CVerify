namespace CVerify.API.Infrastructure.Configuration;

/// <summary>
/// Classifies the purpose of an email for auditing, analytics, and operational tracking.
/// </summary>
public enum EmailCategory
{
    /// <summary>
    /// Critical security updates like verification, password reset, and lock notifications.
    /// </summary>
    Security,

    /// <summary>
    /// User-initiated business-level operations like bookings, payments, and invoices.
    /// </summary>
    Transactional,

    /// <summary>
    /// Marketing updates, campaigns, newsletters, and promotional offerings.
    /// </summary>
    Marketing,

    /// <summary>
    /// General system notices, welcome alerts, or user milestones.
    /// </summary>
    Notification
}
