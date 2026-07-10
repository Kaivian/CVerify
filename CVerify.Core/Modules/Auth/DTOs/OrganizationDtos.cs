using System;
using System.Collections.Generic;

namespace CVerify.API.Modules.Auth.DTOs;

public record LinkedOrganizationDto(
    string Name,
    string Slug
);

public record OrganizationDetailsDto(
    Guid OrganizationId,
    string OrganizationName,
    string OrganizationSlug,
    string? UserRole,
    List<LinkedOrganizationDto> LinkedOrganizations,
    List<string> Permissions,
    List<WorkspaceDto> Workspaces,
    string? BannerUrl = null,
    string? LogoUrl = null,
    string? OrganizationType = null,
    string? OrganizationSize = null,
    int BranchCount = 0,
    List<string>? IndustryTags = null,
    string? Description = null,
    List<string>? BenefitTags = null,
    List<string>? GalleryUrls = null,
    string? ContactName = null,
    string? ContactPhone = null,
    string? ContactEmail = null,
    string? City = null,
    string? DetailAddress = null,
    string? GoogleMapsEmbedUrl = null,
    string? LinkedinUrl = null,
    string? FacebookUrl = null,
    string? TwitterUrl = null,
    string? Website = null,
    string? TaxCode = null,
    string? Mission = null,
    string? Vision = null,
    string? CoreValues = null,
    string? Founded = null,
    int FollowerCount = 0,
    bool IsFollowing = false,
    bool IsVerified = false,
    int VerificationLevel = 0
)
{
    [Obsolete("Use OrganizationType instead")]
    public string? CompanyType => OrganizationType;

    [Obsolete("Use OrganizationSize instead")]
    public string? CompanySize => OrganizationSize;
}

[Obsolete("Use OrganizationDetailsDto instead")]
public record WorkspaceDetailsDto(
    Guid OrganizationId,
    string OrganizationName,
    string OrganizationSlug,
    string? UserRole,
    List<LinkedOrganizationDto> LinkedOrganizations,
    List<string> Permissions,
    List<WorkspaceDto> Workspaces,
    string? BannerUrl = null,
    string? LogoUrl = null,
    string? CompanyType = null,
    string? CompanySize = null,
    int BranchCount = 0,
    List<string>? IndustryTags = null,
    string? Description = null,
    List<string>? BenefitTags = null,
    List<string>? GalleryUrls = null,
    string? ContactName = null,
    string? ContactPhone = null,
    string? ContactEmail = null,
    string? City = null,
    string? DetailAddress = null,
    string? GoogleMapsEmbedUrl = null,
    string? LinkedinUrl = null,
    string? FacebookUrl = null,
    string? TwitterUrl = null,
    string? Website = null,
    string? TaxCode = null,
    string? Mission = null,
    string? Vision = null,
    string? CoreValues = null,
    string? Founded = null,
    int FollowerCount = 0,
    bool IsFollowing = false,
    bool IsVerified = false,
    int VerificationLevel = 0
) : OrganizationDetailsDto(
    OrganizationId,
    OrganizationName,
    OrganizationSlug,
    UserRole,
    LinkedOrganizations,
    Permissions,
    Workspaces,
    BannerUrl,
    LogoUrl,
    CompanyType,
    CompanySize,
    BranchCount,
    IndustryTags,
    Description,
    BenefitTags,
    GalleryUrls,
    ContactName,
    ContactPhone,
    ContactEmail,
    City,
    DetailAddress,
    GoogleMapsEmbedUrl,
    LinkedinUrl,
    FacebookUrl,
    TwitterUrl,
    Website,
    TaxCode,
    Mission,
    Vision,
    CoreValues,
    Founded,
    FollowerCount,
    IsFollowing,
    IsVerified,
    VerificationLevel
);

public record UpdateOrganizationDetailsRequestDto(
    string? Description,
    string? OrganizationType,
    string? OrganizationSize,
    int BranchCount,
    List<string> IndustryTags,
    List<string> BenefitTags,
    string? ContactName,
    string? ContactPhone,
    string? ContactEmail,
    string? City,
    string? DetailAddress,
    string? GoogleMapsEmbedUrl,
    string? LinkedinUrl,
    string? FacebookUrl,
    string? TwitterUrl,
    string? Website,
    string? Mission,
    string? Vision,
    string? CoreValues,
    string? Founded
)
{
    private string? _companyType;
    private string? _companySize;

    [Obsolete("Use OrganizationType instead")]
    public string? CompanyType { get => _companyType ?? OrganizationType; init => _companyType = value; }

    [Obsolete("Use OrganizationSize instead")]
    public string? CompanySize { get => _companySize ?? OrganizationSize; init => _companySize = value; }
}

[Obsolete("Use UpdateOrganizationDetailsRequestDto instead")]
public record UpdateWorkspaceDetailsRequestDto(
    string? Description,
    string? CompanyType,
    string? CompanySize,
    int BranchCount,
    List<string> IndustryTags,
    List<string> BenefitTags,
    string? ContactName,
    string? ContactPhone,
    string? ContactEmail,
    string? City,
    string? DetailAddress,
    string? GoogleMapsEmbedUrl,
    string? LinkedinUrl,
    string? FacebookUrl,
    string? TwitterUrl,
    string? Website,
    string? Mission,
    string? Vision,
    string? CoreValues,
    string? Founded
) : UpdateOrganizationDetailsRequestDto(
    Description,
    CompanyType,
    CompanySize,
    BranchCount,
    IndustryTags,
    BenefitTags,
    ContactName,
    ContactPhone,
    ContactEmail,
    City,
    DetailAddress,
    GoogleMapsEmbedUrl,
    LinkedinUrl,
    FacebookUrl,
    TwitterUrl,
    Website,
    Mission,
    Vision,
    CoreValues,
    Founded
);

public record OrganizationListDto(
    Guid OrganizationId,
    string OrganizationName,
    string OrganizationSlug,
    string? LogoUrl,
    string? BannerUrl,
    string? Description,
    string? OrganizationType,
    string? OrganizationSize,
    string? City,
    string? Website,
    List<string> IndustryTags,
    bool IsVerified,
    int VerificationLevel,
    int MemberCount,
    int OpenPositionsCount,
    int RepositoryCount,
    int VerifiedRepositoryCount,
    double AverageTrustScore,
    int FollowerCount,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt
)
{
    [Obsolete("Use OrganizationType instead")]
    public string? CompanyType => OrganizationType;

    [Obsolete("Use OrganizationSize instead")]
    public string? CompanySize => OrganizationSize;
}

public record OrganizationStatsDto(
    int TotalOrganizations,
    int VerifiedOrganizations,
    int OpenOpportunities,
    int VerifiedRepositories,
    int TotalMembers
);

public record PaginatedOrganizationsResponseDto(
    List<OrganizationListDto> Items,
    int TotalCount,
    int Page,
    int PageSize
);
