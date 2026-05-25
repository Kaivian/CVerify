namespace CVerify.API.Infrastructure.Configuration;

/// <summary>
/// Defines the supported email delivery transport providers.
/// </summary>
public enum EmailProvider
{
    /// <summary>
    /// Use SMTP connection managed via MailKit and MimeKit.
    /// </summary>
    Smtp = 0,

    /// <summary>
    /// Use SendGrid HTTP REST API POST endpoints directly via HttpClient.
    /// </summary>
    SendGrid = 1,

    /// <summary>
    /// Primary SMTP transport with automatic, silent failover to SendGrid HTTP on persistent network failures.
    /// </summary>
    Failover = 2
}
