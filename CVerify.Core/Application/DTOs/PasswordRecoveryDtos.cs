using System;
using System.ComponentModel.DataAnnotations;

namespace CVerify.API.Application.DTOs;

public record VerifyRecoveryOtpRequest(
    [Required]
    [StringLength(10, MinimumLength = 6, ErrorMessage = "OTP code must be between 6 and 10 characters.")]
    string Otp
);

public class ChangePasswordViaRecoveryRequest
{
    [Required]
    public string RecoveryToken { get; init; } = null!;

    [Required]
    [MinLength(8, ErrorMessage = "Password must be at least 8 characters.")]
    public string NewPassword { get; init; } = null!;

    [Required]
    [Compare(nameof(NewPassword), ErrorMessage = "Passwords do not match.")]
    public string ConfirmPassword { get; init; } = null!;

    public ChangePasswordViaRecoveryRequest() { }

    public ChangePasswordViaRecoveryRequest(string recoveryToken, string newPassword, string confirmPassword)
    {
        RecoveryToken = recoveryToken;
        NewPassword = newPassword;
        ConfirmPassword = confirmPassword;
    }
}
