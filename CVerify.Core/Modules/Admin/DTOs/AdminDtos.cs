
using System;
using System.Collections.Generic;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Admin.DTOs;

public record UserListItemDto(
    Guid Id,
    string Email,
    string FullName,
    string Status,
    DateTimeOffset? LastLoginAt,
    List<string> Roles,
    int SessionVersion,
    DateTimeOffset CreatedAt
);

public record UpdateUserDto(
    string Status,
    List<string> Roles
);

public record RoleListItemDto(
    Guid Id,
    string Name,
    string DisplayName,
    string? Description,
    bool IsSystem,
    bool IsActive,
    Guid? ParentRoleId,
    List<string> Permissions,
    uint Version
);

public record CreateOrUpdateRoleDto(
    string Name,
    string DisplayName,
    string? Description,
    Guid? ParentRoleId,
    List<string> Permissions,
    uint? Version
);

public record AuditLogListItemDto(
    Guid Id,
    string? UserEmail,
    string EventType,
    string Description,
    string? ResourceType,
    string? ResourceDisplayName,
    Guid? ResourceId,
    string? WorkspaceName,
    string? IpAddress,
    string? UserAgent,
    string? Device,
    string? Browser,
    DateTimeOffset CreatedAt
);

public record AuditLogDetailDto(
    Guid Id,
    string? UserEmail,
    string EventType,
    string Category,
    string Description,
    string? ResourceType,
    string? ResourceDisplayName,
    Guid? ResourceId,
    string? WorkspaceName,
    string? IpAddress,
    string? UserAgent,
    string? Device,
    string? Browser,
    Guid? RequestId,
    Guid? CorrelationId,
    string? HttpPath,
    string? HttpMethod,
    string? ClientApp,
    string? DetailsJson,
    string? OldStateJson,
    string? NewStateJson,
    DateTimeOffset CreatedAt
);

public record AuditDashboardMetricItem(string Name, int Count);

public record AuditLogsStatsDto(
    int ConfigChangesCount,
    int RoleChangesCount,
    int PendingVerificationActionsCount,
    int ExportsCount,
    List<AuditDashboardMetricItem> Trends,
    List<AuditDashboardMetricItem> TopAdmins,
    List<AuditDashboardMetricItem> TopResources
);


public record AdminMemberListItemDto(
    Guid Id,
    Guid UserId,
    string Email,
    string FullName,
    string Status,
    DateTimeOffset? LastLoginAt,
    int SessionVersion,
    DateTimeOffset JoinedAt,
    List<AdminMemberRoleDto> Roles
);

public record AdminMemberRoleDto(
    Guid RoleId,
    string Name,
    string DisplayName,
    string ScopeType,
    Guid ScopeId
);

public record InviteAdminDto(
    string Email,
    List<Guid> RoleIds
);

public record UpdateAdminMemberDto(
    string Status,
    List<Guid> RoleIds
);

public record AdminInvitationListItemDto(
    Guid Id,
    string InviteeEmail,
    string Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset ExpiresAt,
    DateTimeOffset? AcceptedAt,
    Guid? InvitedByUserId,
    string InvitedByUserEmail,
    List<AdminInvitationRoleDto> Roles
);

public record AdminInvitationRoleDto(
    Guid RoleId,
    string Name,
    string DisplayName
);

public record AcceptInvitationDto(
    string Token
);

