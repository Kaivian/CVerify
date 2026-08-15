using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Auth.DTOs;
using CVerify.API.Modules.Auth.Services;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Security.Authorization;
using CVerify.API.Modules.Shared.System.DTOs;
using CVerify.API.Modules.Shared.Storage.Constants;
using CVerify.API.Modules.Shared.Storage.Enums;
using CVerify.API.Modules.Shared.Storage.Interfaces;

namespace CVerify.API.Modules.Auth.Controllers;

[ApiController]
[Route("api/organizations")]
[Authorize]
public class OrganizationController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IOrganizationAuthorizationService _authorizationService;
    private readonly IStorageService _storageService;

    public OrganizationController(
        ApplicationDbContext context,
        IOrganizationAuthorizationService authorizationService,
        IStorageService storageService)
    {
        _context = context;
        _authorizationService = authorizationService;
        _storageService = storageService;
    }

    [HttpGet("my-organizations")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(List<LinkedOrganizationDto>))]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetMyOrganizations()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }

        var actorTypeClaim = User.FindFirst("actor_type")?.Value;
        bool isBusinessOrOrg = string.Equals(actorTypeClaim, "business", StringComparison.OrdinalIgnoreCase) ||
                               string.Equals(actorTypeClaim, "organization", StringComparison.OrdinalIgnoreCase);

        if (isBusinessOrOrg)
        {
            var org = await _context.Organizations
                .FirstOrDefaultAsync(o => o.Id == userId && o.DeletedAt == null);
            if (org != null)
            {
                return Ok(new List<LinkedOrganizationDto> { new LinkedOrganizationDto(org.Name, org.Username) });
            }
            return Ok(new List<LinkedOrganizationDto>());
        }

        var orgs = await _context.OrganizationMemberships
            .Where(om => om.UserId == userId && om.Status == "active")
            .Include(om => om.Organization)
            .Select(om => new LinkedOrganizationDto(om.Organization.Name, om.Organization.Username))
            .ToListAsync();

        return Ok(orgs);
    }

    [HttpGet]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(PaginatedOrganizationsResponseDto))]
    public async Task<IActionResult> GetOrganizationsList(
        [FromQuery] string? search = null,
        [FromQuery] string? industry = null,
        [FromQuery] string? organizationSize = null,
        [FromQuery] string? companySize = null, // fallback
        [FromQuery] bool? isVerified = null,
        [FromQuery] string? location = null,
        [FromQuery] string? sortBy = "recently_updated",
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 12,
        CancellationToken cancellationToken = default)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 12;

        var query = _context.Organizations
            .Where(o => o.DeletedAt == null && o.Status == "active");

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(o => o.Name.ToLower().Contains(searchLower) ||
                                     o.Username.ToLower().Contains(searchLower) ||
                                     (o.Description != null && o.Description.ToLower().Contains(searchLower)) ||
                                     o.IndustryTags.Any(t => t.ToLower().Contains(searchLower)));
        }

        if (!string.IsNullOrWhiteSpace(industry))
        {
            var industryLower = industry.ToLower();
            query = query.Where(o => o.IndustryTags.Any(t => t.ToLower() == industryLower));
        }

        var targetSize = organizationSize ?? companySize;
        if (!string.IsNullOrWhiteSpace(targetSize))
        {
            query = query.Where(o => o.OrganizationSize == targetSize);
        }

        if (isVerified.HasValue)
        {
            query = query.Where(o => o.IsVerified == isVerified.Value);
        }

        if (!string.IsNullOrWhiteSpace(location))
        {
            var locLower = location.ToLower();
            query = query.Where(o => o.City != null && o.City.ToLower() == locLower);
        }

        var projection = query.Select(o => new
        {
            Organization = o,
            MemberCount = _context.OrganizationMemberships.Count(om => om.OrganizationId == o.Id && om.Status == "active"),
            OpenPositionsCount = _context.JobVacancies.Count(jv => jv.OrganizationId == o.Id && jv.IsActive && jv.Status == "Published"),
            RepositoryCount = _context.SourceCodeRepositories.Count(r => _context.OrganizationMemberships.Any(om => om.OrganizationId == o.Id && om.Status == "active" && om.UserId == r.AuthProvider.UserId)),
            VerifiedRepositoryCount = _context.SourceCodeRepositories.Count(r => r.IsVerified && _context.OrganizationMemberships.Any(om => om.OrganizationId == o.Id && om.Status == "active" && om.UserId == r.AuthProvider.UserId)),
            AverageTrustScore = _context.SourceCodeRepositories
                .Where(r => r.IsVerified && _context.OrganizationMemberships.Any(om => om.OrganizationId == o.Id && om.Status == "active" && om.UserId == r.AuthProvider.UserId))
                .Select(r => (double?)r.TrustScore)
                .Average() ?? 0.0
        });

        switch (sortBy?.ToLowerInvariant())
        {
            case "recently_created":
                projection = projection.OrderByDescending(p => p.Organization.CreatedAt);
                break;
            case "alphabetical_asc":
                projection = projection.OrderBy(p => p.Organization.Name);
                break;
            case "alphabetical_desc":
                projection = projection.OrderByDescending(p => p.Organization.Name);
                break;
            case "most_active":
                projection = projection.OrderByDescending(p => p.Organization.UpdatedAt);
                break;
            case "most_engineers":
                projection = projection.OrderByDescending(p => p.MemberCount);
                break;
            case "most_repositories":
                projection = projection.OrderByDescending(p => p.RepositoryCount);
                break;
            case "most_jobs":
                projection = projection.OrderByDescending(p => p.OpenPositionsCount);
                break;
            case "recently_updated":
            default:
                projection = projection.OrderByDescending(p => p.Organization.UpdatedAt);
                break;
        }

        var totalCount = await projection.CountAsync(cancellationToken);

        var items = await projection
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var dtoList = new List<OrganizationListDto>();
        foreach (var item in items)
        {
            var signedLogoUrl = await GetSignedUrlAsync(item.Organization.LogoUrl, cancellationToken);
            var signedBannerUrl = await GetSignedUrlAsync(item.Organization.BannerUrl, cancellationToken);

            dtoList.Add(new OrganizationListDto(
                item.Organization.Id,
                item.Organization.Name,
                item.Organization.Username,
                signedLogoUrl,
                signedBannerUrl,
                item.Organization.Description,
                item.Organization.OrganizationType,
                item.Organization.OrganizationSize,
                item.Organization.City,
                item.Organization.Website,
                item.Organization.IndustryTags ?? new List<string>(),
                item.Organization.IsVerified,
                item.Organization.VerificationLevel,
                item.MemberCount,
                item.OpenPositionsCount,
                item.RepositoryCount,
                item.VerifiedRepositoryCount,
                item.AverageTrustScore,
                item.Organization.FollowerCount,
                item.Organization.CreatedAt,
                item.Organization.UpdatedAt
            ));
        }

        return Ok(new PaginatedOrganizationsResponseDto(dtoList, totalCount, page, pageSize));
    }

    [HttpGet("stats")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(OrganizationStatsDto))]
    public async Task<IActionResult> GetOrganizationsStats(CancellationToken cancellationToken)
    {
        var totalOrganizations = await _context.Organizations.CountAsync(o => o.DeletedAt == null && o.Status == "active", cancellationToken);
        var verifiedOrganizations = await _context.Organizations.CountAsync(o => o.DeletedAt == null && o.Status == "active" && o.IsVerified, cancellationToken);
        var openOpportunities = await _context.JobVacancies.CountAsync(jv => jv.IsActive && jv.Status == "Published", cancellationToken);
        var verifiedRepositories = await _context.SourceCodeRepositories.CountAsync(r => r.IsVerified && r.IsAccessible, cancellationToken);
        var totalMembers = await _context.OrganizationMemberships.CountAsync(om => om.Status == "active", cancellationToken);

        return Ok(new OrganizationStatsDto(
            totalOrganizations,
            verifiedOrganizations,
            openOpportunities,
            verifiedRepositories,
            totalMembers
        ));
    }

    [HttpGet("{organizationSlug}")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(OrganizationDetailsDto))]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetOrganizationDetails(string organizationSlug)
    {
        var org = await _context.Organizations
            .FirstOrDefaultAsync(o => o.Username.ToLower() == organizationSlug.ToLower() && o.DeletedAt == null);

        if (org == null)
        {
            return NotFound(new { message = "Organization not found" });
        }

        var workspaces = await _context.Workspaces
            .Where(w => w.OrganizationId == org.Id && w.DeletedAt == null)
            .Select(w => new WorkspaceDto(w.Id, w.DisplayName, w.Slug))
            .ToListAsync();

        var signedBannerUrl = await GetSignedUrlAsync(org.BannerUrl);
        var signedLogoUrl = await GetSignedUrlAsync(org.LogoUrl);

        var signedGalleryUrls = new List<string>();
        if (org.GalleryUrls != null)
        {
            foreach (var url in org.GalleryUrls)
            {
                var signed = await GetSignedUrlAsync(url);
                if (signed != null) signedGalleryUrls.Add(signed);
            }
        }

        var userIdClaim = User?.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Ok(MapToOrganizationDetailsDto(
                org,
                null,
                new List<LinkedOrganizationDto>(),
                new List<string>(),
                workspaces,
                signedBannerUrl,
                signedLogoUrl,
                signedGalleryUrls,
                org.FollowerCount,
                false
            ));
        }

        var actorTypeClaim = User.FindFirst("actor_type")?.Value;
        bool isBusinessOrOrg = string.Equals(actorTypeClaim, "business", StringComparison.OrdinalIgnoreCase) ||
                               string.Equals(actorTypeClaim, "organization", StringComparison.OrdinalIgnoreCase);

        if (isBusinessOrOrg)
        {
            if (org.Id != userId)
            {
                return Ok(MapToOrganizationDetailsDto(
                    org,
                    null,
                    new List<LinkedOrganizationDto>(),
                    new List<string>(),
                    workspaces,
                    signedBannerUrl,
                    signedLogoUrl,
                    signedGalleryUrls,
                    org.FollowerCount,
                    false
                ));
            }

            var businessPermissions = new List<string>
            {
                "organization:profile:edit", "organization:settings:edit", "organization:workspaces:view", "organization:workspaces:create",
                "organization:workspaces:update", "organization:workspaces:delete", "workspace:settings:update", "workspace:members:manage",
                "organization:roles:manage", "organization:roles:view",
                "organization:members:manage", "organization:members:view", "identity:verification:initiate", "identity:verification:approve",
                "identity:verification:reject", "evidence:graph:validate", "evidence:graph:comment", "analysis:repository:sync",
                "analysis:repository:run", "analysis:repository:configure", "trust:metric:view", "trust:flag:manage",
                "ai:interview:configure", "ai:interview:conduct", "ai:interview:evaluate", "candidate:trust:score",
                "candidate:trust:override", "organization:audit:view", "billing:invoice:view", "billing:subscription:manage"
            };

            return Ok(MapToOrganizationDetailsDto(
                org,
                "OWNER",
                new List<LinkedOrganizationDto>(),
                businessPermissions,
                workspaces,
                signedBannerUrl,
                signedLogoUrl,
                signedGalleryUrls,
                org.FollowerCount,
                false
            ));
        }

        var isAuthorized = await _authorizationService.AuthorizeAsync(userId, org.Id, OrganizationPermissions.ViewWorkspaces);
        if (!isAuthorized)
        {
            var isFollowingPublic = await _context.OrganizationFollowers
                .AnyAsync(f => f.UserId == userId && f.OrganizationId == org.Id);
            return Ok(MapToOrganizationDetailsDto(
                org,
                null,
                new List<LinkedOrganizationDto>(),
                new List<string>(),
                workspaces,
                signedBannerUrl,
                signedLogoUrl,
                signedGalleryUrls,
                org.FollowerCount,
                isFollowingPublic
            ));
        }

        var membership = await _context.OrganizationMemberships
            .FirstOrDefaultAsync(om => om.OrganizationId == org.Id && om.UserId == userId);

        if (membership == null || membership.Status != "active")
        {
            var isFollowingFallback = await _context.OrganizationFollowers
                .AnyAsync(f => f.UserId == userId && f.OrganizationId == org.Id);
            return Ok(MapToOrganizationDetailsDto(
                org,
                null,
                new List<LinkedOrganizationDto>(),
                new List<string>(),
                workspaces,
                signedBannerUrl,
                signedLogoUrl,
                signedGalleryUrls,
                org.FollowerCount,
                isFollowingFallback
            ));
        }

        var userPerms = await _authorizationService.GetPermissionsAsync(userId, org.Id, HttpContext.RequestAborted);
        var allDbPermissions = await _context.Permissions
            .Select(p => p.Name)
            .ToListAsync(HttpContext.RequestAborted);

        var permissions = allDbPermissions
            .Where(p => PermissionEvaluator.HasPermission(userPerms, p, org.Id))
            .ToList();

        var linkedOrgs = await _context.OrganizationMemberships
            .Where(om => om.UserId == userId && om.OrganizationId != org.Id && om.Status == "active")
            .Include(om => om.Organization)
            .Select(om => new LinkedOrganizationDto(om.Organization.Name, om.Organization.Username))
            .ToListAsync();

        var isFollowingMember = await _context.OrganizationFollowers
            .AnyAsync(f => f.UserId == userId && f.OrganizationId == org.Id, HttpContext.RequestAborted);

        return Ok(MapToOrganizationDetailsDto(
            org,
            membership.Role,
            linkedOrgs,
            permissions,
            workspaces,
            signedBannerUrl,
            signedLogoUrl,
            signedGalleryUrls,
            org.FollowerCount,
            isFollowingMember
        ));
    }

    [HttpPatch("{organizationSlug}")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(OrganizationDetailsDto))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateOrganizationDetails(
        string organizationSlug,
        [FromBody] UpdateOrganizationDetailsRequestDto dto,
        CancellationToken cancellationToken)
    {
        if (dto == null)
        {
            return BadRequest("Request payload is empty.");
        }

        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }

        var org = await _context.Organizations
            .FirstOrDefaultAsync(o => o.Username.ToLower() == organizationSlug.ToLower() && o.DeletedAt == null, cancellationToken);

        if (org == null)
        {
            return NotFound(new { message = "Organization not found" });
        }

        var actorTypeClaim = User.FindFirst("actor_type")?.Value;
        bool isBusinessOrOrg = string.Equals(actorTypeClaim, "business", StringComparison.OrdinalIgnoreCase) ||
                               string.Equals(actorTypeClaim, "organization", StringComparison.OrdinalIgnoreCase);

        if (isBusinessOrOrg)
        {
            if (org.Id != userId)
            {
                return Forbid();
            }
        }
        else
        {
            var isAuthorized = await _authorizationService.AuthorizeAsync(userId, org.Id, OrganizationPermissions.EditProfile, cancellationToken: cancellationToken);
            if (!isAuthorized)
            {
                return Forbid();
            }
        }

        // Apply updates
        org.Description = dto.Description;
        org.OrganizationType = dto.OrganizationType ?? dto.CompanyType;
        org.OrganizationSize = dto.OrganizationSize ?? dto.CompanySize;
        org.BranchCount = dto.BranchCount;
        org.IndustryTags = dto.IndustryTags ?? new List<string>();
        org.BenefitTags = dto.BenefitTags ?? new List<string>();
        org.ContactName = dto.ContactName;
        org.ContactPhone = dto.ContactPhone;
        org.ContactEmail = dto.ContactEmail;
        org.City = dto.City;
        org.DetailAddress = dto.DetailAddress;
        org.GoogleMapsEmbedUrl = dto.GoogleMapsEmbedUrl;
        org.LinkedinUrl = dto.LinkedinUrl;
        org.FacebookUrl = dto.FacebookUrl;
        org.TwitterUrl = dto.TwitterUrl;
        org.Website = dto.Website;
        org.Mission = dto.Mission;
        org.Vision = dto.Vision;
        org.CoreValues = dto.CoreValues;
        org.Founded = dto.Founded;
        org.UpdatedAt = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        var workspaces = await _context.Workspaces
            .Where(w => w.OrganizationId == org.Id && w.DeletedAt == null)
            .Select(w => new WorkspaceDto(w.Id, w.DisplayName, w.Slug))
            .ToListAsync(cancellationToken);

        var signedBannerUrl = await GetSignedUrlAsync(org.BannerUrl, cancellationToken);
        var signedLogoUrl = await GetSignedUrlAsync(org.LogoUrl, cancellationToken);

        var signedGalleryUrls = new List<string>();
        if (org.GalleryUrls != null)
        {
            foreach (var url in org.GalleryUrls)
            {
                var signed = await GetSignedUrlAsync(url, cancellationToken);
                if (signed != null) signedGalleryUrls.Add(signed);
            }
        }

        string? userRole = null;
        var permissions = new List<string>();
        var linkedOrgs = new List<LinkedOrganizationDto>();

        if (isBusinessOrOrg)
        {
            userRole = "OWNER";
            permissions = new List<string>
            {
                "organization:profile:edit", "organization:settings:edit", "organization:workspaces:view", "organization:workspaces:create",
                "organization:workspaces:update", "organization:workspaces:delete", "workspace:settings:update", "workspace:members:manage",
                "organization:roles:manage", "organization:roles:view",
                "organization:members:manage", "organization:members:view", "identity:verification:initiate", "identity:verification:approve",
                "identity:verification:reject", "evidence:graph:validate", "evidence:graph:comment", "analysis:repository:sync",
                "analysis:repository:run", "analysis:repository:configure", "trust:metric:view", "trust:flag:manage",
                "ai:interview:configure", "ai:interview:conduct", "ai:interview:evaluate", "candidate:trust:score",
                "candidate:trust:override", "organization:audit:view", "billing:invoice:view", "billing:subscription:manage"
            };
        }
        else
        {
            var membership = await _context.OrganizationMemberships
                .FirstOrDefaultAsync(om => om.OrganizationId == org.Id && om.UserId == userId, cancellationToken);
            if (membership != null && membership.Status == "active")
            {
                userRole = membership.Role;
                var userPerms = await _authorizationService.GetPermissionsAsync(userId, org.Id, cancellationToken);
                var allDbPermissions = await _context.Permissions
                    .Select(p => p.Name)
                    .ToListAsync(cancellationToken);
                permissions = allDbPermissions
                    .Where(p => PermissionEvaluator.HasPermission(userPerms, p, org.Id))
                    .ToList();

                linkedOrgs = await _context.OrganizationMemberships
                    .Where(om => om.UserId == userId && om.OrganizationId != org.Id && om.Status == "active")
                    .Include(om => om.Organization)
                    .Select(om => new LinkedOrganizationDto(om.Organization.Name, om.Organization.Username))
                    .ToListAsync(cancellationToken);
            }
        }

        var responseDto = MapToOrganizationDetailsDto(
            org,
            userRole,
            linkedOrgs,
            permissions,
            workspaces,
            signedBannerUrl,
            signedLogoUrl,
            signedGalleryUrls
        );

        return Ok(responseDto);
    }

    [HttpPost("{organizationSlug}/follow")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(FollowToggleResponseDto))]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ToggleFollowOrganization(string organizationSlug, CancellationToken cancellationToken)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }

        var actorTypeClaim = User.FindFirst("actor_type")?.Value;
        bool isBusinessOrOrg = string.Equals(actorTypeClaim, "business", StringComparison.OrdinalIgnoreCase) ||
                               string.Equals(actorTypeClaim, "organization", StringComparison.OrdinalIgnoreCase);
        if (isBusinessOrOrg)
        {
            return Unauthorized();
        }

        var org = await _context.Organizations
            .FirstOrDefaultAsync(o => o.Username.ToLower() == organizationSlug.ToLower() && o.DeletedAt == null, cancellationToken);

        if (org == null)
        {
            return NotFound(new { message = "Organization not found" });
        }

        var existing = await _context.OrganizationFollowers
            .FirstOrDefaultAsync(f => f.UserId == userId && f.OrganizationId == org.Id, cancellationToken);

        bool isFollowing;
        if (existing == null)
        {
            _context.OrganizationFollowers.Add(new OrganizationFollower
            {
                UserId = userId,
                OrganizationId = org.Id,
                FollowedAt = DateTimeOffset.UtcNow
            });
            org.FollowerCount = Math.Max(0, org.FollowerCount + 1);
            isFollowing = true;
        }
        else
        {
            _context.OrganizationFollowers.Remove(existing);
            org.FollowerCount = Math.Max(0, org.FollowerCount - 1);
            isFollowing = false;
        }

        org.UpdatedAt = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        return Ok(new FollowToggleResponseDto(org.FollowerCount, isFollowing));
    }

    [HttpPost("{organizationSlug}/banner")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(WorkspaceAvatarUploadResponse))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UploadBanner(
        string organizationSlug,
        [FromForm] IFormFile file,
        CancellationToken cancellationToken)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest("File payload is empty or missing.");
        }

        if (file.Length > StorageConstants.MaxProfileSize)
        {
            return BadRequest($"File size exceeds the maximum allowed limit of {StorageConstants.MaxProfileSize / (1024 * 1024)}MB.");
        }

        if (!StorageConstants.AllowedImageTypes.Contains(file.ContentType))
        {
            return BadRequest($"MIME type '{file.ContentType}' is not supported. Only JPEG, PNG, WebP, and GIF are allowed.");
        }

        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }

        var org = await _context.Organizations
            .FirstOrDefaultAsync(o => o.Username.ToLower() == organizationSlug.ToLower() && o.DeletedAt == null, cancellationToken);

        if (org == null)
        {
            return NotFound(new { message = "Organization not found" });
        }

        var actorTypeClaim = User.FindFirst("actor_type")?.Value;
        bool isBusinessOrOrg = string.Equals(actorTypeClaim, "business", StringComparison.OrdinalIgnoreCase) ||
                               string.Equals(actorTypeClaim, "organization", StringComparison.OrdinalIgnoreCase);

        if (isBusinessOrOrg)
        {
            if (org.Id != userId)
            {
                return Forbid();
            }
        }
        else
        {
            var isAuthorized = await _authorizationService.AuthorizeAsync(userId, org.Id, OrganizationPermissions.EditProfile, cancellationToken: cancellationToken);
            if (!isAuthorized)
            {
                return Forbid();
            }
        }

        // Delete old banner from storage if exists
        if (!string.IsNullOrEmpty(org.BannerUrl) &&
            !org.BannerUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
            !org.BannerUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                await _storageService.DeleteFileAsync(org.BannerUrl, cancellationToken);
            }
            catch { }
        }

        using var fileStream = file.OpenReadStream();
        var uploadedFile = await _storageService.UploadFileAsync(
            fileStream,
            file.FileName,
            file.ContentType,
            StorageModule.Profile,
            null,
            cancellationToken);

        org.BannerUrl = uploadedFile.ObjectKey;
        org.UpdatedAt = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        var signedUrl = await _storageService.GetSignedUrlAsync(
            uploadedFile.ObjectKey,
            TimeSpan.FromHours(24),
            cancellationToken);

        return Ok(new WorkspaceAvatarUploadResponse(signedUrl));
    }

    [HttpPost("{organizationSlug}/avatar")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(WorkspaceAvatarUploadResponse))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UploadAvatar(
        string organizationSlug,
        [FromForm] IFormFile file,
        CancellationToken cancellationToken)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest("File payload is empty or missing.");
        }

        if (file.Length > StorageConstants.MaxProfileSize)
        {
            return BadRequest($"File size exceeds the maximum allowed limit of {StorageConstants.MaxProfileSize / (1024 * 1024)}MB.");
        }

        if (!StorageConstants.AllowedImageTypes.Contains(file.ContentType))
        {
            return BadRequest($"MIME type '{file.ContentType}' is not supported. Only JPEG, PNG, WebP, and GIF are allowed.");
        }

        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }

        var org = await _context.Organizations
            .FirstOrDefaultAsync(o => o.Username.ToLower() == organizationSlug.ToLower() && o.DeletedAt == null, cancellationToken);

        if (org == null)
        {
            return NotFound(new { message = "Organization not found" });
        }

        var actorTypeClaim = User.FindFirst("actor_type")?.Value;
        bool isBusinessOrOrg = string.Equals(actorTypeClaim, "business", StringComparison.OrdinalIgnoreCase) ||
                               string.Equals(actorTypeClaim, "organization", StringComparison.OrdinalIgnoreCase);

        if (isBusinessOrOrg)
        {
            if (org.Id != userId)
            {
                return Forbid();
            }
        }
        else
        {
            var isAuthorized = await _authorizationService.AuthorizeAsync(userId, org.Id, OrganizationPermissions.EditProfile, cancellationToken: cancellationToken);
            if (!isAuthorized)
            {
                return Forbid();
            }
        }

        // Delete old logo from storage if exists
        if (!string.IsNullOrEmpty(org.LogoUrl) &&
            !org.LogoUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
            !org.LogoUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                await _storageService.DeleteFileAsync(org.LogoUrl, cancellationToken);
            }
            catch { }
        }

        using var fileStream = file.OpenReadStream();
        var uploadedFile = await _storageService.UploadFileAsync(
            fileStream,
            file.FileName,
            file.ContentType,
            StorageModule.Profile,
            null,
            cancellationToken);

        org.LogoUrl = uploadedFile.ObjectKey;
        org.UpdatedAt = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        var signedUrl = await _storageService.GetSignedUrlAsync(
            uploadedFile.ObjectKey,
            TimeSpan.FromHours(24),
            cancellationToken);

        return Ok(new WorkspaceAvatarUploadResponse(signedUrl));
    }

    [HttpPost("{organizationSlug}/media/upload")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(List<string>))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UploadMedia(
        string organizationSlug,
        [FromForm] List<IFormFile> files,
        CancellationToken cancellationToken)
    {
        if (files == null || files.Count == 0)
        {
            return BadRequest("No files uploaded.");
        }

        if (files.Count > 5)
        {
            return BadRequest("Cannot upload more than 5 images at once.");
        }

        foreach (var file in files)
        {
            if (file.Length > StorageConstants.MaxProfileSize)
            {
                return BadRequest($"File '{file.FileName}' size exceeds the maximum allowed limit of {StorageConstants.MaxProfileSize / (1024 * 1024)}MB.");
            }

            if (!StorageConstants.AllowedImageTypes.Contains(file.ContentType))
            {
                return BadRequest($"MIME type '{file.ContentType}' is not supported for file '{file.FileName}'. Only JPEG, PNG, WebP, and GIF are allowed.");
            }
        }

        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }

        var org = await _context.Organizations
            .FirstOrDefaultAsync(o => o.Username.ToLower() == organizationSlug.ToLower() && o.DeletedAt == null, cancellationToken);

        if (org == null)
        {
            return NotFound(new { message = "Organization not found" });
        }

        var actorTypeClaim = User.FindFirst("actor_type")?.Value;
        bool isBusinessOrOrg = string.Equals(actorTypeClaim, "business", StringComparison.OrdinalIgnoreCase) ||
                               string.Equals(actorTypeClaim, "organization", StringComparison.OrdinalIgnoreCase);

        if (isBusinessOrOrg)
        {
            if (org.Id != userId)
            {
                return Forbid();
            }
        }
        else
        {
            var isMember = await _context.OrganizationMemberships
                .AnyAsync(om => om.OrganizationId == org.Id && om.UserId == userId && om.Status == "active", cancellationToken);

            if (!isMember)
            {
                return Forbid();
            }
        }

        var uploadedUrls = new List<string>();
        foreach (var file in files)
        {
            using var fileStream = file.OpenReadStream();
            var uploadedFile = await _storageService.UploadFileAsync(
                fileStream,
                file.FileName,
                file.ContentType,
                StorageModule.Profile,
                null,
                cancellationToken);

            var signedUrl = await _storageService.GetSignedUrlAsync(
                uploadedFile.ObjectKey,
                TimeSpan.FromDays(7),
                cancellationToken);

            uploadedUrls.Add(signedUrl);
        }

        return Ok(uploadedUrls);
    }

    [HttpPost("{organizationSlug}/posts")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(WorkspacePostDto))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreatePost(
        string organizationSlug,
        [FromBody] CreateWorkspacePostRequestDto request,
        CancellationToken cancellationToken)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.Content))
        {
            return BadRequest("Content is required.");
        }

        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }

        var org = await _context.Organizations
            .FirstOrDefaultAsync(o => o.Username.ToLower() == organizationSlug.ToLower() && o.DeletedAt == null, cancellationToken);

        if (org == null)
        {
            return NotFound(new { message = "Organization not found" });
        }

        var actorTypeClaim = User.FindFirst("actor_type")?.Value;
        bool isBusinessOrOrg = string.Equals(actorTypeClaim, "business", StringComparison.OrdinalIgnoreCase) ||
                               string.Equals(actorTypeClaim, "organization", StringComparison.OrdinalIgnoreCase);

        string authorRole = "Administrator";
        if (isBusinessOrOrg)
        {
            if (org.Id != userId)
            {
                return Forbid();
            }
            authorRole = "OWNER";
        }
        else
        {
            var membership = await _context.OrganizationMemberships
                .FirstOrDefaultAsync(om => om.OrganizationId == org.Id && om.UserId == userId && om.Status == "active", cancellationToken);

            if (membership == null)
            {
                return Forbid();
            }
            authorRole = membership.Role;
        }

        var post = new WorkspacePost
        {
            Id = Guid.CreateVersion7(),
            OrganizationId = org.Id,
            CreatedByUserId = userId,
            Category = request.Category,
            Content = request.Content,
            Images = request.ImageUrls ?? request.Images ?? new List<string>(),
            Likes = 0,
            SharesCount = 0,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        _context.WorkspacePosts.Add(post);
        await _context.SaveChangesAsync(cancellationToken);

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        var signedAvatar = user != null ? await GetSignedUrlAsync(user.AvatarUrl) : null;

        var dto = new WorkspacePostDto(
            post.Id,
            post.Category,
            post.Content,
            post.Images,
            post.Likes,
            post.SharesCount,
            post.CreatedAt,
            user?.FullName ?? "Manager",
            signedAvatar,
            authorRole
        );

        return Ok(dto);
    }

    [HttpGet("{organizationSlug}/posts")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(List<WorkspacePostDto>))]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPosts(
        string organizationSlug,
        CancellationToken cancellationToken)
    {
        var org = await _context.Organizations
            .FirstOrDefaultAsync(o => o.Username.ToLower() == organizationSlug.ToLower() && o.DeletedAt == null, cancellationToken);

        if (org == null)
        {
            return NotFound(new { message = "Organization not found" });
        }

        bool isAuthorizedToSeeAuthor = false;
        var userIdClaim = User?.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim != null && Guid.TryParse(userIdClaim.Value, out var userId))
        {
            var actorTypeClaim = User?.FindFirst("actor_type")?.Value;
            bool isBusinessOrOrg = string.Equals(actorTypeClaim, "business", StringComparison.OrdinalIgnoreCase) ||
                                   string.Equals(actorTypeClaim, "organization", StringComparison.OrdinalIgnoreCase);

            if (isBusinessOrOrg)
            {
                if (org.Id == userId)
                {
                    isAuthorizedToSeeAuthor = true;
                }
            }
            else
            {
                isAuthorizedToSeeAuthor = await _context.OrganizationMemberships
                    .AnyAsync(om => om.OrganizationId == org.Id && om.UserId == userId && om.Status == "active", cancellationToken);
            }
        }

        var postsQuery = _context.WorkspacePosts
            .Where(wp => wp.OrganizationId == org.Id)
            .OrderByDescending(wp => wp.CreatedAt);

        var postsList = await postsQuery.ToListAsync(cancellationToken);

        var dtoList = new List<WorkspacePostDto>();
        foreach (var post in postsList)
        {
            string? authorName = null;
            string? authorAvatar = null;
            string? authorRole = null;

            if (isAuthorizedToSeeAuthor)
            {
                var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == post.CreatedByUserId, cancellationToken);
                var membership = await _context.OrganizationMemberships.FirstOrDefaultAsync(om => om.OrganizationId == org.Id && om.UserId == post.CreatedByUserId, cancellationToken);
                authorName = user?.FullName ?? "Manager";
                authorAvatar = user != null ? await GetSignedUrlAsync(user.AvatarUrl) : null;
                authorRole = membership?.Role ?? "OWNER";
            }

            dtoList.Add(new WorkspacePostDto(
                post.Id,
                post.Category,
                post.Content,
                post.Images,
                post.Likes,
                post.SharesCount,
                post.CreatedAt,
                authorName,
                authorAvatar,
                authorRole
            ));
        }

        return Ok(dtoList);
    }

    [HttpPost("{organizationSlug}/jobs")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(JobVacancyDto))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateJob(
        string organizationSlug,
        [FromBody] CreateJobRequestDto request,
        CancellationToken cancellationToken)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.Title))
        {
            return BadRequest("Job Title is required.");
        }

        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }

        var org = await _context.Organizations
            .FirstOrDefaultAsync(o => o.Username.ToLower() == organizationSlug.ToLower() && o.DeletedAt == null, cancellationToken);

        if (org == null)
        {
            return NotFound(new { message = "Organization not found" });
        }

        var actorTypeClaim = User.FindFirst("actor_type")?.Value;
        bool isBusinessOrOrg = string.Equals(actorTypeClaim, "business", StringComparison.OrdinalIgnoreCase) ||
                               string.Equals(actorTypeClaim, "organization", StringComparison.OrdinalIgnoreCase);

        if (isBusinessOrOrg)
        {
            if (org.Id != userId)
            {
                return Forbid();
            }
        }
        else
        {
            var membership = await _context.OrganizationMemberships
                .FirstOrDefaultAsync(om => om.OrganizationId == org.Id && om.UserId == userId && om.Status == "active", cancellationToken);

            if (membership == null)
            {
                return Forbid();
            }
        }

        var job = new JobVacancy
        {
            Id = Guid.CreateVersion7(),
            OrganizationId = org.Id,
            Title = request.Title,
            Department = request.Department,
            WorkplaceType = request.WorkplaceType,
            City = request.City,
            Type = request.Type,
            Salary = request.Salary,
            SalaryMinMax = request.SalaryMinMax,
            Headcount = request.Headcount,
            Gender = request.Gender,
            Experience = request.Experience,
            Degree = request.Degree,
            Category = request.Category,
            Description = request.Description ?? new List<string>(),
            Requirements = request.Requirements ?? new List<string>(),
            Benefits = request.Benefits ?? new List<string>(),
            Tags = request.Tags ?? new List<string>(),
            Skills = request.Skills ?? new List<string>(),
            CoverUrl = request.CoverUrl,
            Images = request.ImageUrls ?? request.Images ?? new List<string>(),
            IsActive = true,
            Metadata = request.Metadata,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        _context.JobVacancies.Add(job);
        await _context.SaveChangesAsync(cancellationToken);

        var dto = await MapToJobVacancyDtoAsync(job, cancellationToken);
        return Ok(dto);
    }

    [HttpGet("{organizationSlug}/jobs")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(List<JobVacancyDto>))]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetJobs(
        string organizationSlug,
        CancellationToken cancellationToken)
    {
        var org = await _context.Organizations
            .FirstOrDefaultAsync(o => o.Username.ToLower() == organizationSlug.ToLower() && o.DeletedAt == null, cancellationToken);

        if (org == null)
        {
            return NotFound(new { message = "Organization not found" });
        }

        var jobsList = await _context.JobVacancies
            .Where(jv => jv.OrganizationId == org.Id && jv.IsActive)
            .OrderByDescending(jv => jv.CreatedAt)
            .ToListAsync(cancellationToken);

        var dtoList = new List<JobVacancyDto>();
        foreach (var job in jobsList)
        {
            dtoList.Add(await MapToJobVacancyDtoAsync(job, cancellationToken));
        }

        return Ok(dtoList);
    }

    private OrganizationDetailsDto MapToOrganizationDetailsDto(
        Organization org,
        string? userRole,
        List<LinkedOrganizationDto> linkedOrganizations,
        List<string> permissions,
        List<WorkspaceDto> workspaces,
        string? signedBannerUrl,
        string? signedLogoUrl,
        List<string> signedGalleryUrls,
        int followerCount = 0,
        bool isFollowing = false)
    {
        return new OrganizationDetailsDto(
            org.Id,
            org.Name,
            org.Username,
            userRole,
            linkedOrganizations,
            permissions,
            workspaces,
            signedBannerUrl,
            signedLogoUrl,
            org.OrganizationType,
            org.OrganizationSize,
            org.BranchCount,
            org.IndustryTags ?? new List<string>(),
            org.Description,
            org.BenefitTags ?? new List<string>(),
            signedGalleryUrls,
            org.ContactName,
            org.ContactPhone,
            org.ContactEmail,
            org.City,
            org.DetailAddress,
            org.GoogleMapsEmbedUrl,
            org.LinkedinUrl,
            org.FacebookUrl,
            org.TwitterUrl,
            org.Website,
            org.TaxCode,
            org.Mission,
            org.Vision,
            org.CoreValues,
            org.Founded,
            followerCount,
            isFollowing,
            org.IsVerified,
            org.VerificationLevel
        );
    }

    private async Task<string?> GetSignedUrlAsync(string? url, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(url))
        {
            return null;
        }

        if (url.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
            url.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            return url;
        }

        try
        {
            return await _storageService.GetSignedUrlAsync(url, TimeSpan.FromHours(24), cancellationToken);
        }
        catch
        {
            return null;
        }
    }

    private async Task<JobVacancyDto> MapToJobVacancyDtoAsync(JobVacancy job, CancellationToken cancellationToken)
    {
        var signedCoverUrl = await GetSignedUrlAsync(job.CoverUrl, cancellationToken) ?? job.CoverUrl;
        var signedImages = new List<string>();
        if (job.Images != null)
        {
            foreach (var img in job.Images)
            {
                var signedImg = await GetSignedUrlAsync(img, cancellationToken);
                if (signedImg != null) signedImages.Add(signedImg);
            }
        }

        return new JobVacancyDto(
            job.Id,
            job.OrganizationId,
            job.Title,
            job.Department,
            job.WorkplaceType,
            job.City,
            job.Type,
            job.Salary,
            job.SalaryMinMax,
            job.Headcount,
            job.Gender,
            job.Experience,
            job.Degree,
            job.Category,
            job.Description,
            job.Requirements,
            job.Benefits,
            job.Tags,
            job.Skills,
            signedCoverUrl,
            signedImages,
            job.IsActive,
            job.CreatedAt,
            job.UpdatedAt,
            job.Status,
            job.AcquisitionStrategy,
            job.DiscoveryProfileJson,
            job.RequirementSnapshotId,
            job.HiringRequirementId,
            job.Metadata
        );
    }
}
