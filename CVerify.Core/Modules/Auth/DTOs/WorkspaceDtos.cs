using System;
using System.Collections.Generic;

namespace CVerify.API.Modules.Auth.DTOs;

public record MemberDto(
    Guid UserId,
    string Name,
    string Email,
    string Role,
    string Status,
    string? Headline = null,
    string? Username = null,
    string? AvatarUrl = null
);

public record MemberProfileDataDto(
    Guid UserId,
    string? Headline,
    string? Username
);

public record WorkspaceDto(
    Guid Id,
    string DisplayName,
    string Slug
);

public record WorkspaceAvatarUploadResponse(
    string AvatarUrl
);

public record PaginatedMembersResponseDto(
    List<MemberDto> Items,
    int TotalCount,
    int Page,
    int PageSize
);

public record FollowToggleResponseDto(
    int FollowerCount,
    bool IsFollowing
);

public record WorkspacePostDto(
    Guid Id,
    string Category,
    string Content,
    List<string> Images,
    int Likes,
    int SharesCount,
    DateTimeOffset CreatedAt,
    string? AuthorName = null,
    string? AuthorAvatar = null,
    string? AuthorRole = null
);

public record CreateWorkspacePostRequestDto(
    string Category,
    string Content,
    List<string>? Images = null,
    List<string>? ImageUrls = null
);

public record CreateJobRequestDto(
    string Title,
    string Department,
    string WorkplaceType,
    string City,
    string Type,
    string Salary,
    string SalaryMinMax,
    int Headcount,
    string Gender,
    string Experience,
    string Degree,
    string Category,
    List<string> Description,
    List<string> Requirements,
    List<string> Benefits,
    List<string> Tags,
    List<string> Skills,
    string CoverUrl,
    List<string>? Images = null,
    List<string>? ImageUrls = null,
    string? Metadata = null
);

public record CreateWorkspaceRequestDto(
    string DisplayName,
    string Slug,
    string? Description = null
);
