using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace CVerify.API.Modules.Auth.DTOs;

public record PreAssignedRoleDto(
    [Required] Guid RoleId,
    [Required][MaxLength(30)] string ScopeType, // "ORGANIZATION", "WORKSPACE"
    [Required] Guid ScopeId
);

public record InviteMemberDto(
    [Required][EmailAddress][MaxLength(255)] string Email,
    [Required] List<PreAssignedRoleDto> Roles
);

public record CreateInvitationsDto(
    [Required] List<InviteMemberDto> Invitees
);

public record PreAssignedRoleDetailsDto(
    Guid RoleId,
    string RoleName,
    string RoleDisplayName,
    string ScopeType,
    Guid ScopeId,
    string ScopeName
);

public record OrganizationInvitationDto(
    Guid Id,
    string InviteeEmail,
    string Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset ExpiresAt,
    DateTimeOffset? AcceptedAt,
    Guid? InvitedByUserId,
    string? InvitedByUserName,
    List<PreAssignedRoleDetailsDto> PreAssignedRoles
);

public record PaginatedInvitationsResponseDto(
    List<OrganizationInvitationDto> Items,
    int TotalItems,
    int Page,
    int PageSize
);

public record MemberRoleDto(
    Guid RoleId,
    string RoleName,
    string RoleDisplayName,
    string ScopeType,
    Guid ScopeId,
    string ScopeName
);

public record MemberDetailsDto(
    Guid UserId,
    string FullName,
    string Email,
    string IdentityStatus, // e.g. "Verified" or "Unverified"
    double? TrustScore,
    string Status,
    DateTimeOffset JoinedAt,
    List<MemberRoleDto> Roles
);

public record PaginatedOrganizationMembersResponseDto(
    List<MemberDetailsDto> Items,
    int TotalItems,
    int Page,
    int PageSize
);

public record UpdateMemberDto(
    [Required][MaxLength(30)] string Status // "active", "suspended", "disabled"
);

public record BulkMemberOperationDto(
    [Required] List<Guid> UserIds,
    [Required] string Operation, // "suspend", "reactivate", "remove"
    Guid? RoleId,
    string? ScopeType,
    Guid? ScopeId
);

public record AcceptInvitationDto(
    [Required] string Token
);

public record DeclineInvitationDto(
    [Required] string Token
);

public record WorkspaceAuditLogDto(
    Guid Id,
    string ActorEmail,
    string EventType,
    string Description,
    string? TargetEmail,
    DateTimeOffset CreatedAt
);

public record PaginatedWorkspaceAuditLogsResponseDto(
    List<WorkspaceAuditLogDto> Items,
    int TotalItems,
    int Page,
    int PageSize
);

