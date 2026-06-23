using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using CVerify.API.Modules.AiChat.Entities;
using CVerify.API.Modules.Auth.Entities;
using CVerify.API.Modules.Auth.Enums;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Auth.DTOs;

public record LoginRequest(
    [Required]
    [EmailAddress]
    [MaxLength(255)]
    string Email,

    [Required]
    string Password,

    bool RememberMe = false
);

public class RegisterRequest
{
    [Required]
    [EmailAddress]
    [MaxLength(255)]
    public string Email { get; init; } = null!;

    [Required]
    public string Password { get; init; } = null!;

    [Required]
    [Compare(nameof(Password), ErrorMessage = "Passwords do not match.")]
    public string ConfirmPassword { get; init; } = null!;

    [Required]
    [MaxLength(255)]
    public string FullName { get; init; } = null!;

    public RegisterRequest() { }

    public RegisterRequest(string Email, string Password, string ConfirmPassword, string FullName)
    {
        this.Email = Email;
        this.Password = Password;
        this.ConfirmPassword = ConfirmPassword;
        this.FullName = FullName;
    }
}

public record VerifyEmailRequest(
    [Required]
    string Token
);

public record ResendVerificationRequest(
    [Required]
    [EmailAddress]
    [MaxLength(255)]
    string Email
);

public record ForgotPasswordRequest(
    [Required]
    [EmailAddress]
    [MaxLength(255)]
    string Email
);

public class ResetPasswordRequest
{
    [Required]
    public string Token { get; init; } = null!;

    [Required]
    public string Password { get; init; } = null!;

    [Required]
    [Compare(nameof(Password), ErrorMessage = "Passwords do not match.")]
    public string ConfirmPassword { get; init; } = null!;

    public ResetPasswordRequest() { }

    public ResetPasswordRequest(string Token, string Password, string ConfirmPassword)
    {
        this.Token = Token;
        this.Password = Password;
        this.ConfirmPassword = ConfirmPassword;
    }
}

public record AuthResponse(Guid Id, string Email, string? Username, string FullName, string? AvatarUrl, IEnumerable<string> Roles, IEnumerable<string> Permissions, bool IsEmailVerified, string Status, string NextStep, DateTimeOffset? PasswordChangedAt = null, bool HasPassword = false);

public record UserProfileResponse(Guid Id, string Email, string? Username, string FullName, string? AvatarUrl, IEnumerable<string> Roles, IEnumerable<string> Permissions, bool IsEmailVerified, string Status, string NextStep, DateTimeOffset? PasswordChangedAt = null, bool HasPassword = false);

public record GoogleLoginRequest(
    [Required]
    string IdToken
);

public record RegisterResponse(
    string StatusCode,
    string UiAction,
    string Message
);

public record SendOtpRequest(
    [Required][EmailAddress][MaxLength(255)] string Email,
    [Required][MaxLength(50)] string Purpose
);

public record SendOtpResponse(
    Guid ChallengeId,
    string Email,
    int CooldownSeconds
);

public record VerifyOtpRequest(
    [Required] Guid ChallengeId,
    [Required][EmailAddress][MaxLength(255)] string Email,
    [Required][MaxLength(10)] string Code,
    [Required][MaxLength(50)] string Purpose
);

public record VerifyOtpResponse(
    Guid ChallengeId,
    string Email,
    string VerificationToken
);

public class CreatePasswordRequest
{
    [Required]
    public Guid ChallengeId { get; init; }

    [Required]
    [EmailAddress]
    [MaxLength(255)]
    public string Email { get; init; } = null!;

    [Required]
    public string VerificationToken { get; init; } = null!;

    [Required]
    public string Password { get; init; } = null!;

    [Required]
    [Compare(nameof(Password), ErrorMessage = "Passwords do not match.")]
    public string ConfirmPassword { get; init; } = null!;

    [MaxLength(255)]
    public string? FullName { get; init; }

    public CreatePasswordRequest() { }
}

public record RegisterOrganizationRequest(
    [Required][MaxLength(255)] string OrganizationName,
    [Required][MaxLength(50)] string TaxCode,
    [Required][EmailAddress][MaxLength(255)] string OrganizationEmail
)
{
    [Obsolete("Use OrganizationName instead")]
    public string CompanyName => OrganizationName;

    [Obsolete("Use OrganizationEmail instead")]
    public string CompanyEmail => OrganizationEmail;
}

[Obsolete("Use RegisterOrganizationRequest instead")]
public record RegisterCompanyRequest(
    [Required][MaxLength(255)] string CompanyName,
    [Required][MaxLength(50)] string TaxCode,
    [Required][EmailAddress][MaxLength(255)] string CompanyEmail
) : RegisterOrganizationRequest(CompanyName, TaxCode, CompanyEmail);

public record VerifyOrganizationLinkRequest(
    [Required] string Token
);

[Obsolete("Use VerifyOrganizationLinkRequest instead")]
public record VerifyCompanyLinkRequest(
    [Required] string Token
) : VerifyOrganizationLinkRequest(Token);

public record VerifyOrganizationLinkResponse(
    string OrganizationName,
    string TaxCode,
    string OrganizationEmail,
    string VerificationToken
)
{
    [Obsolete("Use OrganizationName instead")]
    public string CompanyName => OrganizationName;

    [Obsolete("Use OrganizationEmail instead")]
    public string CompanyEmail => OrganizationEmail;
}

[Obsolete("Use VerifyOrganizationLinkResponse instead")]
public record VerifyCompanyLinkResponse(
    string CompanyName,
    string TaxCode,
    string CompanyEmail,
    string VerificationToken
) : VerifyOrganizationLinkResponse(CompanyName, TaxCode, CompanyEmail, VerificationToken);

public class SetupWorkspaceRequest
{
    [Required]
    public string VerificationToken { get; init; } = null!;

    [Required]
    [EmailAddress]
    [MaxLength(255)]
    public string OrganizationEmail { get; init; } = null!;

    private string? _companyEmail;

    [Obsolete("Use OrganizationEmail instead")]
    public string CompanyEmail { get => _companyEmail ?? OrganizationEmail; init => _companyEmail = value; }

    [Required]
    [RegularExpression(@"^[a-z0-9_]{3,30}$", ErrorMessage = "Workspace username must be lowercase, alphanumeric/underscore, and 3-30 characters.")]
    public string OrganizationUsername { get; init; } = null!;

    [Required]
    [MinLength(8, ErrorMessage = "Password must be at least 8 characters.")]
    public string Password { get; init; } = null!;

    public SetupWorkspaceRequest() { }
}

public record OrganizationLoginRequest(
    [Required][MaxLength(100)] string OrganizationUsername,
    [Required] string Password
);

public record SessionInfo(
    Guid SessionId,
    string? DeviceName,
    string? UserAgent,
    string? IpAddress,
    DateTimeOffset CreatedAt,
    DateTimeOffset LastUsedAt,
    bool IsCurrent
);

public record ResolveEmailAuthStateRequest(
    [Required][EmailAddress][MaxLength(255)] string Email
);

public record ResolveEmailAuthStateResponse(
    CVerify.API.Modules.Shared.Domain.Enums.EmailAuthState AuthState
);

public record VerifyOrganizationOnboardingRequest(
    [Required][MaxLength(255)] string OrganizationName,
    [Required][MaxLength(50)] string TaxCode
)
{
    [Obsolete("Use OrganizationName instead")]
    public string CompanyName => OrganizationName;
}

[Obsolete("Use VerifyOrganizationOnboardingRequest instead")]
public record VerifyCompanyOnboardingRequest(
    [Required][MaxLength(255)] string CompanyName,
    [Required][MaxLength(50)] string TaxCode
) : VerifyOrganizationOnboardingRequest(CompanyName, TaxCode);

public record VerifyOrganizationOnboardingResponse(
    string? SignedToken,
    string OfficialOrganizationName,
    string TaxCode,
    bool OrganizationExists = false,
    string? OrganizationDisplayName = null,
    string? OrganizationSlug = null,
    bool RecoveryRequired = false
)
{
    [Obsolete("Use OfficialOrganizationName instead")]
    public string OfficialCompanyName => OfficialOrganizationName;
}

[Obsolete("Use VerifyOrganizationOnboardingResponse instead")]
public record VerifyCompanyOnboardingResponse(
    string? SignedToken,
    string OfficialCompanyName,
    string TaxCode,
    bool OrganizationExists = false,
    string? OrganizationDisplayName = null,
    string? OrganizationSlug = null,
    bool RecoveryRequired = false
) : VerifyOrganizationOnboardingResponse(
    SignedToken,
    OfficialCompanyName,
    TaxCode,
    OrganizationExists,
    OrganizationDisplayName,
    OrganizationSlug,
    RecoveryRequired
);

public record CompleteOnboardingRequest(
    [Required] string Step2Token,
    [Required][RegularExpression(@"^[a-z0-9-]{4,32}$", ErrorMessage = "Workspace handle must be 4-32 characters, lowercase alphanumeric or dash")] string OrganizationUsername,
    [Required][MaxLength(255)] string OrganizationDisplayName,
    [Required][MinLength(8, ErrorMessage = "Password must be at least 8 characters.")] string Password
)
{
    private string? _companyDisplayName;

    [Obsolete("Use OrganizationDisplayName instead")]
    public string CompanyDisplayName { get => _companyDisplayName ?? OrganizationDisplayName; init => _companyDisplayName = value; }
}

public record GoogleOnboardingLinkRequest(
    [Required] string IdToken,
    [Required] string Step1Token
);

public record OtpSessionResponse(
    bool HasActiveOtp,
    Guid? ChallengeId,
    string Purpose,
    DateTimeOffset? ExpiresAt,
    DateTimeOffset? CooldownUntil,
    string MaskedEmail,
    string Status
);

public record LinkedProviderDto(
    Guid? Id,
    string ProviderName, 
    string? ProviderEmail, 
    string? ProviderUsername, 
    bool Connected,
    string ScopeValidationStatus,
    string? GrantedScopes
);

public record LinkedProviderConnectionDto(
    Guid Id,
    string ProviderName,
    string? ProviderEmail,
    string? ProviderUsername,
    string? ProviderDisplayName,
    string? ProviderAvatarUrl,
    string? ProviderProfileUrl,
    bool Connected,
    string ScopeValidationStatus,
    string? GrantedScopes
);

public record PendingLinkDetailsResponse(
    Guid Id,
    string ProviderName,
    string? ProviderEmail,
    string? ProviderUsername,
    string? ProviderDisplayName,
    string? ProviderAvatarUrl,
    string? ProviderProfileUrl
);

public class ChangePasswordRequest
{
    [Required]
    public string CurrentPassword { get; init; } = null!;

    [Required]
    public string NewPassword { get; init; } = null!;

    [Required]
    [Compare(nameof(NewPassword), ErrorMessage = "Passwords do not match.")]
    public string ConfirmNewPassword { get; init; } = null!;

    public ChangePasswordRequest() { }

    public ChangePasswordRequest(string currentPassword, string newPassword, string confirmNewPassword)
    {
        CurrentPassword = currentPassword;
        NewPassword = newPassword;
        ConfirmNewPassword = confirmNewPassword;
    }
}

public record LinkGoogleRequest(
    [Required]
    string IdToken
);

public record SetupWorkspaceResponse(
    bool Success,
    string Email,
    string OrganizationUsername
);

