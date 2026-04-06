using System;
using System.Collections.Generic;
using CVerify.API.Core.Entities;

namespace CVerify.API.Application.DTOs;

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
    List<string> Permissions,
    uint Version
);

public record CreateOrUpdateRoleDto(
    string Name,
    string DisplayName,
    string? Description,
    List<string> Permissions,
    uint? Version
);

public record AuditLogListItemDto(
    Guid Id,
    string? UserEmail,
    string EventType,
    string Description,
    string? IpAddress,
    string? UserAgent,
    DateTimeOffset CreatedAt
);

public record PaginatedResultDto<T>(
    IEnumerable<T> Items,
    int TotalCount,
    int Page,
    int PageSize
);
