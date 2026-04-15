using System.Threading;
using System.Threading.Tasks;

namespace CVerify.API.Modules.Shared.Email.Services;

/// <summary>
/// Defines the high-level business contract for email delivery requests.
/// </summary>
public interface IEmailService
{
    /// <summary>
    /// Delivers a responsive verification card requesting new users to confirm registration.
    /// </summary>
    /// <param name="toEmail">The target email address.</param>
    /// <param name="fullName">The recipient's full name.</param>
    /// <param name="verificationLink">The fully qualified verification URL.</param>
    /// <param name="cancellationToken">Cancellation token trace.</param>
    Task SendVerificationEmailAsync(
        string toEmail,
        string fullName,
        string verificationLink,
        string? correlationId = null,
        string? outboxId = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Delivers a security warning reset link containing quick password reset pathways.
    /// </summary>
    /// <param name="toEmail">The target email address.</param>
    /// <param name="fullName">The recipient's full name.</param>
    /// <param name="resetLink">The fully qualified password reset URL.</param>
    /// <param name="correlationId">Optional tracking trace identifier.</param>
    /// <param name="outboxId">Optional outbox message identifier.</param>
    /// <param name="cancellationToken">Cancellation token trace.</param>
    Task SendResetPasswordEmailAsync(
        string toEmail,
        string fullName,
        string resetLink,
        string? correlationId = null,
        string? outboxId = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Delivers a welcome notice onboarding users onto the travel generation dashboard.
    /// </summary>
    /// <param name="toEmail">The target email address.</param>
    /// <param name="fullName">The recipient's full name.</param>
    /// <param name="correlationId">Optional tracking trace identifier.</param>
    /// <param name="outboxId">Optional outbox message identifier.</param>
    /// <param name="cancellationToken">Cancellation token trace.</param>
    Task SendWelcomeEmailAsync(
        string toEmail,
        string fullName,
        string? correlationId = null,
        string? outboxId = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Delivers an OTP code to verify identity during signup/login flows.
    /// </summary>
    /// <param name="toEmail">The target email address.</param>
    /// <param name="fullName">The recipient's full name (optional to trigger resolution).</param>
    /// <param name="otpCode">The 6-digit verification code.</param>
    /// <param name="templateName">The optional name of the custom HTML template.</param>
    /// <param name="correlationId">Optional tracking trace identifier.</param>
    /// <param name="outboxId">Optional outbox message identifier.</param>
    /// <param name="cancellationToken">Cancellation token trace.</param>
    Task SendOtpEmailAsync(
        string toEmail,
        string? fullName,
        string otpCode,
        string? templateName = null,
        string? correlationId = null,
        string? outboxId = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Delivers a company verification link to validate organizational domain registry.
    /// </summary>
    /// <param name="toEmail">The target email address.</param>
    /// <param name="companyName">The name of the company/organization.</param>
    /// <param name="verificationLink">The fully qualified verification URL.</param>
    /// <param name="correlationId">Optional tracking trace identifier.</param>
    /// <param name="outboxId">Optional outbox message identifier.</param>
    /// <param name="cancellationToken">Cancellation token trace.</param>
    Task SendCompanyVerificationEmailAsync(
        string toEmail,
        string companyName,
        string verificationLink,
        string? correlationId = null,
        string? outboxId = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Delivers a high-priority security warning notification to primary email.
    /// </summary>
    Task SendSecurityAlertEmailAsync(
        string toEmail,
        string alertSubject,
        string alertBody,
        string? correlationId = null,
        string? outboxId = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Delivers a workspace onboarding welcome notice containing setup checklist and dashboard pathways.
    /// </summary>
    Task SendWorkspaceOnboardingEmailAsync(
        string toEmail,
        string fullName,
        string companyName,
        string workspaceId,
        string workspaceUrl,
        string? correlationId = null,
        string? outboxId = null,
        CancellationToken cancellationToken = default);
}
