using System;
using System.Collections.Generic;

namespace CVerify.API.Modules.Admin.DTOs;

public record OrganizationAdminListItemDto(
    Guid Id,
    string Name,
    string TaxCode,
    string Email,
    string Status,
    bool IsVerified,
    int VerificationLevel,
    int WorkspaceCount,
    int MemberCount,
    int RiskScore,
    DateTimeOffset CreatedAt
);

public record OrganizationAdminDetailDto(
    Guid Id,
    string Name,
    string TaxCode,
    string Email,
    string Username,
    string? RegistrationNumber,
    string Status,
    bool IsVerified,
    int VerificationLevel,
    string? RepresentativeName,
    string? RepresentativeEmail,
    string? RepresentativePhone,
    string? Website,
    string? Description,
    string? OrganizationType,
    string? OrganizationSize,
    DateTimeOffset CreatedAt,
    List<string> IndustryTags,
    List<WorkspaceMiniDto> Workspaces,
    int RiskScore
);

public record WorkspaceMiniDto(
    Guid Id,
    string Name,
    string? Description,
    int MemberCount,
    DateTimeOffset CreatedAt
);

public record EnterpriseWorkflowRequestListItemDto(
    Guid Id,
    Guid OrganizationId,
    string OrganizationName,
    string RequestType,
    string Status,
    string Priority,
    Guid? AssignedReviewerId,
    string? AssignedReviewerName,
    DateTimeOffset? DueAt,
    bool SlaBreached,
    DateTimeOffset CreatedAt
);

public record EnterpriseWorkflowRequestDetailDto(
    Guid Id,
    Guid OrganizationId,
    string OrganizationName,
    string RequestType,
    string Status,
    string Priority,
    string MetadataJson,
    Guid? AssignedReviewerId,
    string? AssignedReviewerName,
    DateTimeOffset? AssignedAt,
    DateTimeOffset? ClaimedAt,
    DateTimeOffset? DueAt,
    bool SlaBreached,
    Guid? EscalatedToUserId,
    string? EscalatedToUserName,
    string? ReviewState,
    List<WorkflowAttachmentDto> Attachments,
    List<WorkflowCommentDto> Comments,
    DateTimeOffset CreatedAt
);

public record WorkflowAttachmentDto(
    Guid Id,
    string FileName,
    string ContentType,
    DateTimeOffset CreatedAt
);

public record WorkflowCommentDto(
    Guid Id,
    string AuthorName,
    string AuthorEmail,
    string Content,
    DateTimeOffset CreatedAt
);

public record UpdateOrgStatusDto(
    string Status,
    string Reason
);

public record ResolveRequestDto(
    string Status,
    string Notes
);

public record AddCommentDto(
    string Content
);

public record WorkflowDashboardStatsDto(
    int PendingCount,
    int ClaimedCount,
    int SlaBreachedCount,
    int HighRiskCount,
    double ApprovalRate,
    double RejectionRate
);
