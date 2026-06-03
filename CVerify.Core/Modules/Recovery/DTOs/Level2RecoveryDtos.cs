using System;
using System.Collections.Generic;

namespace CVerify.API.Modules.Recovery.DTOs;

public record Level2CheckResponse(
    bool IsLevel2,
    string LegalBusinessName,
    string TaxCode,
    string? CurrentRepresentative,
    string? CurrentEmail
);

public record RepresentativeRotationRequestDto(
    string TaxCode,
    string NewRepresentativeFullName,
    string NewRepresentativePosition,
    string NewRepresentativeEmail,
    string NewRepresentativePhone,
    string ReasonForRepresentativeChange,
    string? OptionalSupportingMessage
);

public record RepresentativeRotationRequestResponse(
    Guid RequestId,
    Guid OrganizationId,
    string CompanyName,
    string? CurrentRepresentative,
    string RequestedRepresentative,
    string RequestedEmail,
    string RequestedPhone,
    string Reason,
    string SupportApprovalStatus,
    string AdminApprovalStatus,
    string FinalDecision,
    string VerificationCallStatus,
    string? VerificationCallNotes,
    string? OptionalSupportingMessage,
    DateTimeOffset CreatedAt,
    DateTimeOffset ExpiresAt
);

public record RepresentativeAuthorityHistoryResponse(
    Guid HistoryId,
    Guid OrganizationId,
    string CompanyName,
    string? PreviousRepresentative,
    string NewRepresentative,
    string RotatedBy,
    string SupportReviewer,
    DateTimeOffset EffectiveAt
);

public record VerificationCallRequest(
    string Notes,
    string Status // "not_started", "scheduled", "verified", "failed"
);

public record SupportApprovalRequest(
    string Decision // "approve", "reject"
);

public record AdminVoteRequest(
    string Token,
    string Decision // "approve", "reject"
);
