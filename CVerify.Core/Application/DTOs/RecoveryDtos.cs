using System;
using System.Collections.Generic;

namespace CVerify.API.Application.DTOs;

public record SubmitClaimRequest(
    string RepresentativeFullName,
    string RepresentativePosition,
    string PhoneNumber,
    string RecoveryEmail,
    string TaxCode,
    string EmailVerificationToken
);

public record SubmitClaimResponse(
    Guid ClaimId,
    int RiskScore,
    string RiskLevel,
    string Status
);

public record ReviewClaimRequest(
    string Status, // "Approved" or "Rejected"
    string? RejectionReason
);

public record ClaimDetailsResponse(
    Guid ClaimId,
    string TaxCode,
    string CompanyName,
    string RepresentativeFullName,
    string RepresentativePosition,
    string PhoneNumber,
    string RecoveryEmail,
    int RiskScore,
    string RiskLevel,
    string SuggestedStrategy,
    string Status,
    string? RejectionReason,
    string? ReviewedBy,
    string? SecondReviewerBy,
    DateTimeOffset? ReviewedAt,
    DateTimeOffset CreatedAt,
    List<DocumentInfo> Documents,
    RiskHeuristicsInfo RiskHeuristics
);

public record DocumentInfo(
    Guid DocumentId,
    string FileName,
    string ContentType,
    string VirusScanStatus,
    DateTimeOffset CreatedAt
);

public record RiskHeuristicsInfo(
    string OcrMetadata,
    string SuspiciousMetadata,
    string WorkspaceActivity,
    string IpDeviceFlags,
    string HistoricalClaimFlags
);

public record VerifyBootstrapResponse(
    bool IsValid,
    string ApprovedRepresentative,
    string VerifiedRecoveryEmail,
    string SuggestedStrategy,
    string OrganizationName,
    string OrganizationSlug
);

public record SetupRecoveryCredentialsRequest(
    string Token,
    string NewPassword
);

public record SetupRecoveryCredentialsResponse(
    string SessionToken,
    string VerifiedRecoveryEmail
);

public record ExecuteRecoveryRequest(
    string SessionToken,
    string Strategy, // "OptionA" or "OptionB"
    string DisplayName,
    string Slug
);

public record OrganizationForgotRequest(
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.MaxLength(50)]
    string TaxCode
);

public record OrganizationForgotResponse(
    Guid ChallengeId,
    string MaskedEmail,
    int CooldownSeconds
);

public record VerifyOrganizationOtpRequest(
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.MaxLength(50)]
    string TaxCode,

    [System.ComponentModel.DataAnnotations.Required]
    Guid ChallengeId,

    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.MaxLength(10)]
    string Code
);

public record VerifyOrganizationOtpResponse(
    string VerificationToken
);

public class ResetOrganizationPasswordRequest
{
    [System.ComponentModel.DataAnnotations.Required]
    public string Token { get; init; } = null!;

    [System.ComponentModel.DataAnnotations.Required]
    public string NewPassword { get; init; } = null!;

    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.Compare(nameof(NewPassword), ErrorMessage = "Passwords do not match.")]
    public string ConfirmPassword { get; init; } = null!;
}
