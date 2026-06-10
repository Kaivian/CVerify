using System.Collections.Generic;

namespace CVerify.API.Modules.Auth.DTOs;

public record MemberDto(
    Guid UserId,
    string Name,
    string Email,
    string Role,
    string Status
);

public record LinkedOrganizationDto(
    string Name,
    string Slug
);

public record WorkspaceDto(
    Guid Id,
    string DisplayName,
    string Slug
);

public record WorkspaceAvatarUploadResponse(
    string AvatarUrl
);

public record WorkspaceDetailsDto(
    Guid OrganizationId,
    string OrganizationName,
    string OrganizationSlug,
    string? UserRole,
    List<LinkedOrganizationDto> LinkedOrganizations,
    List<string> Permissions,
    List<WorkspaceDto> Workspaces,
    string? BannerUrl = null,
    string? LogoUrl = null
);

public record PaginatedMembersResponseDto(
    List<MemberDto> Items,
    int TotalCount,
    int Page,
    int PageSize
);
