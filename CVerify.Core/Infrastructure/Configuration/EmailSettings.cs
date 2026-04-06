using System.ComponentModel.DataAnnotations;

namespace CVerify.API.Infrastructure.Configuration;

/// <summary>
/// Encapsulates the configuration parameters required for the email delivery infrastructure.
/// </summary>
public class EmailSettings
{
    /// <summary>
    /// Configuration section key inside appsettings.json.
    /// </summary>
    public const string SectionName = "EmailSettings";

    /// <summary>
    /// The active transport delivery pathway. Defaults to SMTP.
    /// </summary>
    public EmailProvider Provider { get; set; } = EmailProvider.Smtp;

    /// <summary>
    /// The sender's email address. Must be a valid email address format.
    /// </summary>
    [Required]
    [EmailAddress]
    public string SenderEmail { get; set; } = null!;

    /// <summary>
    /// The friendly name of the sender displayed to recipients (e.g. "CVerify AI").
    /// </summary>
    [Required]
    public string SenderName { get; set; } = null!;

    /// <summary>
    /// Toggles whether email sends are pushed to a background worker channel.
    /// </summary>
    public bool EnableBackgroundQueue { get; set; } = true;

    /// <summary>
    /// Maximum number of retry attempts for network operations.
    /// </summary>
    [Range(0, 10)]
    public int RetryCount { get; set; } = 3;

    /// <summary>
    /// The initial delay in seconds before triggering exponential retry strategies.
    /// </summary>
    [Range(1, 60)]
    public int RetryDelaySeconds { get; set; } = 2;

    /// <summary>
    /// The standard timeout duration in seconds for connection attempts.
    /// </summary>
    [Range(5, 180)]
    public int TimeoutSeconds { get; set; } = 30;

    /// <summary>
    /// Nested configurations specifically dedicated to SMTP connections.
    /// </summary>
    public SmtpSettings Smtp { get; set; } = new();

    /// <summary>
    /// Nested configurations specifically dedicated to SendGrid API connections.
    /// </summary>
    public SendGridSettings SendGrid { get; set; } = new();
}

/// <summary>
/// Configurations specific to the SMTP transport.
/// </summary>
public class SmtpSettings
{
    /// <summary>
    /// Host address of the SMTP gateway (e.g. "smtp.gmail.com").
    /// </summary>
    public string Host { get; set; } = null!;

    /// <summary>
    /// Gateway port (e.g. 587 for TLS, 465 for SSL).
    /// </summary>
    [Range(1, 65535)]
    public int Port { get; set; } = 587;

    /// <summary>
    /// Username utilized to authenticate with the SMTP server.
    /// </summary>
    public string Username { get; set; } = null!;

    /// <summary>
    /// Password or App Secret utilized to authenticate with the SMTP server.
    /// </summary>
    public string Password { get; set; } = null!;

    /// <summary>
    /// Toggles whether SSL/TLS encryption is established.
    /// </summary>
    public bool EnableSsl { get; set; } = true;
}

/// <summary>
/// Configurations specific to the SendGrid REST transport.
/// </summary>
public class SendGridSettings
{
    /// <summary>
    /// Bearer API Key utilized to authenticate with SendGrid REST endpoints.
    /// </summary>
    public string ApiKey { get; set; } = null!;
}
