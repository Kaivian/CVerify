using System.Collections.Generic;

namespace CVerify.API.Modules.Auth.DTOs;

public record MemberDto(
    string Name,
    string Email,
    string Role,
    string Status
);

public record LinkedOrganizationDto(
    string Name,
    string Slug
);

public record WorkspaceDetailsDto(
    string OrganizationName,
    string OrganizationSlug,
    string UserRole,
    List<LinkedOrganizationDto> LinkedOrganizations
);

public record PaginatedMembersResponseDto(
    List<MemberDto> Items,
    int TotalCount,
    int Page,
    int PageSize
);
