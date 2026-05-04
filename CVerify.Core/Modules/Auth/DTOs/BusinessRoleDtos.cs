using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace CVerify.API.Modules.Auth.DTOs;

public record CreateBusinessRoleDto(
    [Required] [MaxLength(50)] string Name,
    [Required] [MaxLength(100)] string DisplayName,
    [MaxLength(250)] string Description,
    Guid? ParentRoleId,
    [Required] List<string> PermissionNames
);

public record BusinessRoleDetailsDto(
    Guid Id,
    string Name,
    string DisplayName,
    string? Description,
    Guid? ParentRoleId,
    string? ParentRoleName,
    bool IsSystem,
    bool IsActive,
    int MemberCount,
    List<string> Permissions,
    DateTimeOffset CreatedAt
);

public record AssignScopedRoleDto(
    [Required] Guid UserId,
    [Required] Guid RoleId,
    [Required] [MaxLength(30)] string ScopeType,
    [Required] Guid ScopeId
);

public record RoleAssignmentDto(
    Guid Id,
    Guid UserId,
    string UserName,
    string UserEmail,
    Guid RoleId,
    string RoleDisplayName,
    string ScopeType,
    Guid ScopeId,
    string ScopeName,
    DateTimeOffset AssignedAt
);

public record PermissionDto(
    Guid Id,
    string Name,
    string DisplayName,
    string? Description,
    string Module
);

public record RoleAuditLogDto(
    Guid Id,
    Guid? ActorUserId,
    string ActorUserName,
    string Action,
    string TargetRoleName,
    Guid? TargetUserId,
    string? TargetUserName,
    string? ScopeType,
    Guid? ScopeId,
    string? DetailsJson,
    DateTimeOffset Timestamp
);

public record PaginatedAuditLogsResponseDto(
    List<RoleAuditLogDto> Items,
    int TotalCount,
    int Page,
    int PageSize
);
