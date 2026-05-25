using System.Threading;
using System.Threading.Tasks;

namespace CVerify.API.Application.Interfaces;

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
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Delivers a security warning reset link containing quick password reset pathways.
    /// </summary>
    /// <param name="toEmail">The target email address.</param>
    /// <param name="fullName">The recipient's full name.</param>
    /// <param name="resetLink">The fully qualified password reset URL.</param>
    /// <param name="cancellationToken">Cancellation token trace.</param>
    Task SendResetPasswordEmailAsync(
        string toEmail,
        string fullName,
        string resetLink,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Delivers a welcome notice onboarding users onto the travel generation dashboard.
    /// </summary>
    /// <param name="toEmail">The target email address.</param>
    /// <param name="fullName">The recipient's full name.</param>
    /// <param name="cancellationToken">Cancellation token trace.</param>
    Task SendWelcomeEmailAsync(
        string toEmail,
        string fullName,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Delivers an OTP code to verify identity during signup/login flows.
    /// </summary>
    /// <param name="toEmail">The target email address.</param>
    /// <param name="fullName">The recipient's full name.</param>
    /// <param name="otpCode">The 6-digit verification code.</param>
    /// <param name="cancellationToken">Cancellation token trace.</param>
    Task SendOtpEmailAsync(
        string toEmail,
        string fullName,
        string otpCode,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Delivers a company verification link to validate organizational domain registry.
    /// </summary>
    /// <param name="toEmail">The target email address.</param>
    /// <param name="companyName">The name of the company/organization.</param>
    /// <param name="verificationLink">The fully qualified verification URL.</param>
    /// <param name="cancellationToken">Cancellation token trace.</param>
    Task SendCompanyVerificationEmailAsync(
        string toEmail,
        string companyName,
        string verificationLink,
        CancellationToken cancellationToken = default);
}
