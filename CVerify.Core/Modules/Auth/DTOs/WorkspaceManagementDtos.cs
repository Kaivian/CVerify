using System;
using System.Collections.Generic;

namespace CVerify.API.Modules.Auth.DTOs;

public record WorkspaceListItemDto(
    Guid Id,
    string DisplayName,
    string Slug,
    string? Description,
    string Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    int MemberCount,
    int ActivePositionsCount,
    MemberDto OwnerUser
);

public record PaginatedWorkspacesResponseDto(
    List<WorkspaceListItemDto> Items,
    int TotalCount,
    int Page,
    int PageSize
);

public record UpdateWorkspaceRequestDto(
    string DisplayName,
    string Slug,
    string? Description,
    string Status
);

public record TransferWorkspaceOwnershipRequestDto(
    Guid NewOwnerId
);

public record WorkspaceMemberItemDto(
    Guid UserId,
    string Name,
    string Email,
    string Role,
    DateTimeOffset JoinedAt,
    string? AvatarUrl
);

public record AddWorkspaceMemberRequestDto(
    Guid UserId,
    string Role
);

public record UpdateWorkspaceMemberRoleRequestDto(
    string Role
);
