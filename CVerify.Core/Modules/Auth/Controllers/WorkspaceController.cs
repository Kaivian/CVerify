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
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Security.Authorization;
using CVerify.API.Modules.Shared.Storage.Constants;
using CVerify.API.Modules.Shared.Storage.Enums;
using CVerify.API.Modules.Shared.Storage.Interfaces;

namespace CVerify.API.Modules.Auth.Controllers;

[ApiController]
[Route("api/workspace")]
[Authorize]
public class WorkspaceController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IOrganizationAuthorizationService _authorizationService;
    private readonly IStorageService _storageService;

    public WorkspaceController(
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
        bool isBusiness = string.Equals(actorTypeClaim, "business", StringComparison.OrdinalIgnoreCase);

        if (isBusiness)
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

    [HttpGet("{organizationSlug}")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(WorkspaceDetailsDto))]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetWorkspaceDetails(string organizationSlug)
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
            // Anonymous visitor: return basic public profile details
            return Ok(MapToWorkspaceDetailsDto(
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
        bool isBusiness = string.Equals(actorTypeClaim, "business", StringComparison.OrdinalIgnoreCase);

        if (isBusiness)
        {
            if (org.Id != userId)
            {
                // Authenticated as a different business account (treat as anonymous public viewer)
                return Ok(MapToWorkspaceDetailsDto(
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
                "organization:profile:edit", "organization:settings:edit", "organization:workspace:view", "organization:roles:manage", "organization:roles:view",
                "organization:members:manage", "organization:members:view", "identity:verification:initiate", "identity:verification:approve",
                "identity:verification:reject", "evidence:graph:validate", "evidence:graph:comment", "analysis:repository:sync",
                "analysis:repository:run", "analysis:repository:configure", "trust:metric:view", "trust:flag:manage",
                "ai:interview:configure", "ai:interview:conduct", "ai:interview:evaluate", "candidate:trust:score",
                "candidate:trust:override", "organization:audit:view", "billing:invoice:view", "billing:subscription:manage"
            };

            return Ok(MapToWorkspaceDetailsDto(
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

        // Authorize membership using the centralized authorization service
        var isAuthorized = await _authorizationService.AuthorizeAsync(userId, org.Id, OrganizationPermissions.ViewWorkspace);
        if (!isAuthorized)
        {
            // Authenticated but not authorized to view workspace (treat as public viewer)
            var isFollowingPublic = await _context.OrganizationFollowers
                .AnyAsync(f => f.UserId == userId && f.OrganizationId == org.Id);
            return Ok(MapToWorkspaceDetailsDto(
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

        // Fetch the user's role in this organization
        var membership = await _context.OrganizationMemberships
            .FirstOrDefaultAsync(om => om.OrganizationId == org.Id && om.UserId == userId);

        if (membership == null || membership.Status != "active")
        {
            // Fallback for safety (treat as public viewer)
            var isFollowingFallback = await _context.OrganizationFollowers
                .AnyAsync(f => f.UserId == userId && f.OrganizationId == org.Id);
            return Ok(MapToWorkspaceDetailsDto(
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

        // Resolve dynamic permissions
        var userPerms = await _authorizationService.GetPermissionsAsync(userId, org.Id, HttpContext.RequestAborted);
        var allDbPermissions = await _context.Permissions
            .Select(p => p.Name)
            .ToListAsync(HttpContext.RequestAborted);

        var permissions = allDbPermissions
            .Where(p => PermissionEvaluator.HasPermission(userPerms, p, org.Id))
            .ToList();

        // Fetch other organizations the user belongs to for switching overview (Account Linking Overview)
        var linkedOrgs = await _context.OrganizationMemberships
            .Where(om => om.UserId == userId && om.OrganizationId != org.Id && om.Status == "active")
            .Include(om => om.Organization)
            .Select(om => new LinkedOrganizationDto(om.Organization.Name, om.Organization.Username))
            .ToListAsync();

        var isFollowingMember = await _context.OrganizationFollowers
            .AnyAsync(f => f.UserId == userId && f.OrganizationId == org.Id, HttpContext.RequestAborted);

        return Ok(MapToWorkspaceDetailsDto(
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
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(WorkspaceDetailsDto))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateWorkspaceDetails(
        string organizationSlug,
        [FromBody] UpdateWorkspaceDetailsRequestDto dto,
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
        bool isBusiness = string.Equals(actorTypeClaim, "business", StringComparison.OrdinalIgnoreCase);

        if (isBusiness)
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
        org.CompanyType = dto.CompanyType;
        org.CompanySize = dto.CompanySize;
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
        org.UpdatedAt = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        // Fetch same information to return the updated Details DTO
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

        // Determine permissions and role just like GET endpoint
        string? userRole = null;
        var permissions = new List<string>();
        var linkedOrgs = new List<LinkedOrganizationDto>();

        if (isBusiness)
        {
            userRole = "OWNER";
            permissions = new List<string>
            {
                "organization:profile:edit", "organization:settings:edit", "organization:workspace:view", "organization:roles:manage", "organization:roles:view",
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

        var responseDto = MapToWorkspaceDetailsDto(
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
    public async Task<IActionResult> ToggleFollowWorkspace(string organizationSlug, CancellationToken cancellationToken)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }

        // Business accounts cannot follow organizations
        var actorTypeClaim = User.FindFirst("actor_type")?.Value;
        if (string.Equals(actorTypeClaim, "business", StringComparison.OrdinalIgnoreCase))
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
            // Follow
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
            // Unfollow
            _context.OrganizationFollowers.Remove(existing);
            org.FollowerCount = Math.Max(0, org.FollowerCount - 1);
            isFollowing = false;
        }

        org.UpdatedAt = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        return Ok(new FollowToggleResponseDto(org.FollowerCount, isFollowing));
    }

    private WorkspaceDetailsDto MapToWorkspaceDetailsDto(
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
        return new WorkspaceDetailsDto(
            org.Id,
            org.Name,
            org.Username,
            userRole,
            linkedOrganizations,
            permissions,
            workspaces,
            signedBannerUrl,
            signedLogoUrl,
            org.CompanyType,
            org.CompanySize,
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
            followerCount,
            isFollowing
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
            job.UpdatedAt
        );
    }

    [HttpGet("{organizationSlug}/members")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(PaginatedMembersResponseDto))]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetWorkspaceMembers(
        string organizationSlug,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? search = null,
        [FromQuery] bool publicOnly = false)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;

        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        Guid? userId = null;
        if (userIdClaim != null && Guid.TryParse(userIdClaim.Value, out var parsedId))
        {
            userId = parsedId;
        }

        var org = await _context.Organizations
            .FirstOrDefaultAsync(o => o.Username.ToLower() == organizationSlug.ToLower() && o.DeletedAt == null);

        if (org == null)
        {
            return NotFound(new { message = "Organization not found" });
        }

        bool limitToPublic = userId == null || publicOnly;

        if (!limitToPublic)
        {
            var actorTypeClaim = User.FindFirst("actor_type")?.Value;
            bool isBusiness = string.Equals(actorTypeClaim, "business", StringComparison.OrdinalIgnoreCase);

            if (isBusiness)
            {
                if (org.Id != userId.Value)
                {
                    return Forbid();
                }
            }
            else
            {
                // Authorize permission using centralized authorization service
                var isAuthorized = await _authorizationService.AuthorizeAsync(userId.Value, org.Id, OrganizationPermissions.ViewMembers);
                if (!isAuthorized)
                {
                    return Forbid();
                }
            }
        }

        List<Guid>? publicUserIds = null;
        if (limitToPublic)
        {
            publicUserIds = await _context.Database.SqlQueryRaw<Guid>(
                "SELECT user_id FROM user_profiles WHERE profile_visibility = 'public'"
            ).ToListAsync();
        }

        var query = _context.OrganizationMemberships
            .AsNoTracking()
            .Where(om => om.OrganizationId == org.Id && om.Status == "active");

        if (publicUserIds != null)
        {
            query = query.Where(om => publicUserIds.Contains(om.UserId));
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(om => 
                om.User.FullName.ToLower().Contains(searchLower) ||
                om.User.Email.ToLower().Contains(searchLower)
            );
        }

        var totalCount = await query.CountAsync();
        var members = await query
            .Include(om => om.User)
            .OrderBy(om => om.User.FullName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var memberUserIds = members.Select(m => m.UserId).ToList();
        var profileMap = new Dictionary<Guid, MemberProfileDataDto>();

        if (memberUserIds.Count > 0)
        {
            var profiles = await _context.Database.SqlQueryRaw<MemberProfileDataDto>(
                "SELECT user_id as \"UserId\", headline as \"Headline\", username as \"Username\" FROM user_profiles WHERE user_id = ANY({0})",
                memberUserIds.ToArray()
            ).ToListAsync();
            
            profileMap = profiles.ToDictionary(p => p.UserId);
        }

        var dtoList = new List<MemberDto>();
        foreach (var m in members)
        {
            profileMap.TryGetValue(m.UserId, out var prof);
            var signedAvatar = await GetSignedUrlAsync(m.User.AvatarUrl);
            dtoList.Add(new MemberDto(
                m.UserId,
                m.User.FullName,
                m.User.Email,
                m.Role,
                m.Status,
                prof?.Headline,
                prof?.Username,
                signedAvatar
            ));
        }

        return Ok(new PaginatedMembersResponseDto(dtoList, totalCount, page, pageSize));
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
        bool isBusiness = string.Equals(actorTypeClaim, "business", StringComparison.OrdinalIgnoreCase);

        if (isBusiness)
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
            catch
            {
                // Log and ignore
            }
        }

        // Physical upload to R2
        using var fileStream = file.OpenReadStream();
        var uploadedFile = await _storageService.UploadFileAsync(
            fileStream,
            file.FileName,
            file.ContentType,
            StorageModule.Profile,
            null,
            cancellationToken);

        // Update organization record
        org.BannerUrl = uploadedFile.ObjectKey;
        org.UpdatedAt = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        // Generate signed URL
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
        bool isBusiness = string.Equals(actorTypeClaim, "business", StringComparison.OrdinalIgnoreCase);

        if (isBusiness)
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
            catch
            {
                // Log and ignore
            }
        }

        // Physical upload to R2
        using var fileStream = file.OpenReadStream();
        var uploadedFile = await _storageService.UploadFileAsync(
            fileStream,
            file.FileName,
            file.ContentType,
            StorageModule.Profile,
            null,
            cancellationToken);

        // Update organization record
        org.LogoUrl = uploadedFile.ObjectKey;
        org.UpdatedAt = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        // Generate signed URL
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
        bool isBusiness = string.Equals(actorTypeClaim, "business", StringComparison.OrdinalIgnoreCase);

        if (isBusiness)
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
        bool isBusiness = string.Equals(actorTypeClaim, "business", StringComparison.OrdinalIgnoreCase);

        string authorRole = "Administrator";
        if (isBusiness)
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
            bool isBusiness = string.Equals(actorTypeClaim, "business", StringComparison.OrdinalIgnoreCase);

            if (isBusiness)
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

        if (postsList.Count == 0)
        {
            var mockUser = await _context.Users.FirstOrDefaultAsync(cancellationToken);
            var mockUserId = mockUser?.Id ?? Guid.NewGuid();
            var mockPosts = new List<WorkspacePost>
            {
                new WorkspacePost
                {
                    Id = Guid.CreateVersion7(),
                    OrganizationId = org.Id,
                    CreatedByUserId = mockUserId,
                    Category = "Engineering",
                    Content = "ChÃºng tÃ´i vÃ´ cÃ¹ng tá»± hÃ o thÃ´ng bÃ¡o ráº±ng quy trÃ¬nh Ä‘Ã¡nh giÃ¡ vÃ  xÃ¡c thá»±c láº­p trÃ¬nh viÃªn trÃªn CVerify Ä‘Ã£ chÃ­nh thá»©c tÃ­ch há»£p chá»¯ kÃ½ máº­t mÃ£ hÃ³a (cryptographic credential signatures)! Viá»‡c nÃ y giÃºp tá»± Ä‘á»™ng hÃ³a 100% quy trÃ¬nh kiá»ƒm thá»­ nÄƒng lá»±c thá»±c táº¿ tá»« kho lÆ°u trá»¯ mÃ£ nguá»“n cá»§a á»©ng viÃªn.\n\nÄáº·c biá»‡t, Ä‘áº¡i diá»‡n CVerify cÃ¹ng Ä‘á»‘i tÃ¡c Ä‘Ã£ kÃ½ káº¿t biÃªn báº£n ghi nhá»› há»£p tÃ¡c chiáº¿n lÆ°á»£c nháº±m xÃ¢y dá»±ng cá»™ng Ä‘á»“ng ká»¹ sÆ° cÃ´ng nghá»‡ cháº¥t lÆ°á»£ng cao, báº£o máº­t vÃ  Ä‘Ã¡ng tin cáº­y. DÆ°á»›i Ä‘Ã¢y lÃ  má»™t sá»‘ hÃ¬nh áº£nh sá»± kiá»‡n kÃ½ káº¿t vÃ  hoáº¡t Ä‘á»™ng triá»ƒn khai thá»±c táº¿ cá»§a Ä‘á»™i ngÅ© ká»¹ sÆ° táº¡i vÄƒn phÃ²ng ÄÃ  Náºµng.",
                    Images = new List<string>
                    {
                        "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?q=80&w=800",
                        "https://images.unsplash.com/photo-1531538606174-0f90ff5dce83?q=80&w=800"
                    },
                    Likes = 88,
                    SharesCount = 14,
                    CreatedAt = DateTimeOffset.UtcNow.AddHours(-1)
                },
                new WorkspacePost
                {
                    Id = Guid.CreateVersion7(),
                    OrganizationId = org.Id,
                    CreatedByUserId = mockUserId,
                    Category = "Recruitment",
                    Content = "WE ARE HIRING! GIA NHáº¬P Äá»˜I NGÅ¨ CÃ”NG NGHá»† Cá»¦A CHÃšNG TÃ”I.\n\nNháº±m má»Ÿ rá»™ng quy mÃ´ dá»± Ã¡n vÃ  Ä‘Ã¡p á»©ng nhu cáº§u tÄƒng trÆ°á»Ÿng trong giai Ä‘oáº¡n má»›i, chÃºng tÃ´i tÃ¬m kiáº¿m cÃ¡c Ä‘á»“ng nghiá»‡p tÃ i nÄƒng á»Ÿ cÃ¡c vá»‹ trÃ­:\n1. Senior Full-Stack Developer (.NET & React)\n2. Automated QA Engineer\n3. DevOps Engineer (Platform Team)\n\nChÃºng tÃ´i mang Ä‘áº¿n mÃ´i trÆ°á»ng lÃ m viá»‡c Hybrid linh hoáº¡t, cháº¿ Ä‘á»™ Ä‘Ã£i ngá»™ cáº¡nh tranh, há»— trá»£ thiáº¿t bá»‹ lÃ m viá»‡c hiá»‡n Ä‘áº¡i hÃ ng Ä‘áº§u cÃ¹ng cÆ¡ há»™i phÃ¡t triá»ƒn báº£n thÃ¢n vÆ°á»£t trá»™i. HÃ£y truy cáº­p ngay tab 'Jobs' Ä‘á»ƒ xem chi tiáº¿t mÃ´ táº£ cÃ´ng viá»‡c vÃ  á»©ng tuyá»ƒn trá»±c tiáº¿p báº±ng há»“ sÆ¡ Ä‘Ã£ xÃ¡c thá»±c nhÃ©!",
                    Images = new List<string> { "https://images.unsplash.com/photo-1521737711867-e3b90473bd58?q=80&w=800" },
                    Likes = 42,
                    SharesCount = 5,
                    CreatedAt = DateTimeOffset.UtcNow.AddDays(-2)
                }
            };
            _context.WorkspacePosts.AddRange(mockPosts);
            await _context.SaveChangesAsync(cancellationToken);
            postsList = await postsQuery.ToListAsync(cancellationToken);
        }

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
        bool isBusiness = string.Equals(actorTypeClaim, "business", StringComparison.OrdinalIgnoreCase);

        if (isBusiness)
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

        if (jobsList.Count == 0)
        {
            // Seed default mock jobs for this organization
            var mockJobs = new List<JobVacancy>
            {
                new JobVacancy
                {
                    Id = Guid.CreateVersion7(),
                    OrganizationId = org.Id,
                    Title = "Senior Full-Stack Developer (.NET & React)",
                    Department = "Engineering",
                    WorkplaceType = "Hybrid",
                    City = "HÃ  Ná»™i",
                    Type = "Full-Time",
                    Salary = "$ 2,000 - 4,500 USD",
                    SalaryMinMax = "50 - 110 triá»‡u",
                    Headcount = 3,
                    Gender = "KhÃ´ng yÃªu cáº§u",
                    Experience = "5+ nÄƒm kinh nghiá»‡m",
                    Degree = "Äáº¡i há»c / Ká»¹ sÆ°",
                    Category = "PhÃ¡t triá»ƒn pháº§n má»m, CÃ´ng nghá»‡ thÃ´ng tin",
                    Description = new List<string>
                    {
                        "Thiáº¿t káº¿ vÃ  phÃ¡t triá»ƒn kiáº¿n trÃºc há»‡ thá»‘ng backend microservices báº±ng .NET Core 8 vÃ  cÆ¡ sá»Ÿ dá»¯ liá»‡u PostgreSQL.",
                        "XÃ¢y dá»±ng giao diá»‡n á»©ng dá»¥ng web Single Page Application (SPA) hiá»‡u nÄƒng cao, mÆ°á»£t mÃ  báº±ng React, TypeScript vÃ  quáº£n lÃ½ tráº¡ng thÃ¡i qua Zustand/Redux.",
                        "Tá»‘i Æ°u hÃ³a cÃ¡c truy váº¥n SQL nÃ¢ng cao vÃ  cáº¥u hÃ¬nh bá»™ nhá»› cache Redis phÃ¢n tÃ¡n.",
                        "Viáº¿t mÃ£ nguá»“n kiá»ƒm thá»­ tá»± Ä‘á»™ng (Unit Test / Integration Test) Ä‘áº£m báº£o Ä‘á»™ á»•n Ä‘á»‹nh cao trÆ°á»›c khi bÃ n giao há»‡ thá»‘ng.",
                        "Tham gia hÆ°á»›ng dáº«n ká»¹ thuáº­t, code review vÃ  há»— trá»£ cÃ¡c thÃ nh viÃªn junior trong Ä‘á»™i ngÅ©."
                    },
                    Requirements = new List<string>
                    {
                        "Tá»‘t nghiá»‡p Ä‘áº¡i há»c chuyÃªn ngÃ nh CÃ´ng nghá»‡ thÃ´ng tin, Khoa há»c mÃ¡y tÃ­nh hoáº·c tÆ°Æ¡ng Ä‘Æ°Æ¡ng.",
                        "Tá»‘i thiá»ƒu 5 nÄƒm kinh nghiá»‡m thá»±c chiáº¿n phÃ¡t triá»ƒn á»©ng dá»¥ng web, cÃ³ kiáº¿n thá»©c sÃ¢u rá»™ng vá» láº­p trÃ¬nh hÆ°á»›ng Ä‘á»‘i tÆ°á»£ng OOP vÃ  cÃ¡c Design Pattern.",
                        "ThÃ nh tháº¡o ngÃ´n ngá»¯ C#, ASP.NET Core, Entity Framework Core vÃ  láº­p trÃ¬nh báº¥t Ä‘á»“ng bá»™.",
                        "Kinh nghiá»‡m lÃ m viá»‡c sÃ¢u sáº¯c vá»›i ReactJS, Hooks, state management vÃ  thÆ° viá»‡n CSS nhÆ° Tailwind/Vanilla CSS.",
                        "Kinh nghiá»‡m thiáº¿t káº¿ API RESTful cháº¥t lÆ°á»£ng, hiá»ƒu biáº¿t tá»‘t vá» CI/CD vÃ  Git."
                    },
                    Benefits = new List<string>
                    {
                        "LÆ°Æ¡ng thÆ°á»Ÿng háº¥p dáº«n lÃªn tá»›i $4,500 USD cÃ¹ng thÃ¡ng lÆ°Æ¡ng thá»© 13 vÃ  thÆ°á»Ÿng hiá»‡u suáº¥t cuá»‘i nÄƒm.",
                        "ÄÆ°á»£c cung cáº¥p Ä‘áº§y Ä‘á»§ trang thiáº¿t bá»‹ lÃ m viá»‡c hiá»‡n Ä‘áº¡i cao cáº¥p (MacBook Pro / Dell XPS vÃ  mÃ n hÃ¬nh phá»¥).",
                        "GÃ³i báº£o hiá»ƒm chÄƒm sÃ³c sá»©c khá»e cao cáº¥p toÃ n diá»‡n cho báº£n thÃ¢n vÃ  gia Ä‘Ã¬nh.",
                        "HÆ°á»Ÿng 15 ngÃ y phÃ©p cÃ³ lÆ°Æ¡ng trong nÄƒm vÃ  cháº¿ Ä‘á»™ nghá»‰ lá»… táº¿t theo luáº­t lao Ä‘á»™ng.",
                        "Tham gia cÃ¡c chÆ°Æ¡ng trÃ¬nh Ä‘Ã o táº¡o ká»¹ nÄƒng chuyÃªn sÃ¢u vÃ  chá»©ng chá»‰ cÃ´ng nghá»‡ quá»‘c táº¿ miá»…n phÃ­."
                    },
                    Tags = new List<string> { "React", "TypeScript", ".NET Core", "C#", "Microservices" },
                    Skills = new List<string> { "C#", ".NET Core", "React", "TypeScript", "PostgreSQL", "Zustand" },
                    CoverUrl = "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=600",
                    Images = new List<string>
                    {
                        "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=600",
                        "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?q=80&w=600",
                        "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=600"
                    },
                    IsActive = true,
                    CreatedAt = DateTimeOffset.UtcNow.AddHours(-1),
                    UpdatedAt = DateTimeOffset.UtcNow.AddHours(-1)
                },
                new JobVacancy
                {
                    Id = Guid.CreateVersion7(),
                    OrganizationId = org.Id,
                    Title = "Automated Verification QA Engineer",
                    Department = "Quality Assurance",
                    WorkplaceType = "Remote",
                    City = "ÄÃ  Náºµng",
                    Type = "Contract",
                    Salary = "$ 1,200 - 2,500 USD",
                    SalaryMinMax = "30 - 62 triá»‡u",
                    Headcount = 2,
                    Gender = "KhÃ´ng yÃªu cáº§u",
                    Experience = "3+ nÄƒm kinh nghiá»‡m",
                    Degree = "Äáº¡i há»c / Cao Ä‘áº³ng",
                    Category = "Kiá»ƒm thá»­ pháº§n má»m, Quality Assurance",
                    Description = new List<string>
                    {
                        "Thiáº¿t káº¿, xÃ¢y dá»±ng vÃ  duy trÃ¬ cÃ¡c ká»‹ch báº£n kiá»ƒm thá»­ tá»± Ä‘á»™ng (Automated Test Scripts) cho há»‡ thá»‘ng xÃ¡c thá»±c cryptographic cá»§a CVerify.",
                        "Viáº¿t vÃ  tá»‘i Æ°u hÃ³a cÃ¡c bá»™ test suite kiá»ƒm tra hiá»‡u nÄƒng (Performance Test) vÃ  Ä‘á»™ tin cáº­y cá»§a chuá»—i dá»¯ liá»‡u bÄƒm.",
                        "TÃ­ch há»£p cÃ¡c bÃ i kiá»ƒm thá»­ tá»± Ä‘á»™ng vÃ o há»‡ thá»‘ng CI/CD thÃ´ng qua GitHub Actions.",
                        "Phá»‘i há»£p cháº·t cháº½ vá»›i Ä‘á»™i ngÅ© phÃ¡t triá»ƒn sáº£n pháº©m Ä‘á»ƒ tÃ¬m kiáº¿m, phÃ¢n tÃ­ch vÃ  theo dÃµi cÃ¡c lá»—i phÃ¡t sinh.",
                        "Táº¡o cÃ¡c bÃ¡o cÃ¡o kiá»ƒm thá»­ chi tiáº¿t vÃ  Ä‘á» xuáº¥t cÃ¡c giáº£i phÃ¡p nÃ¢ng cao cháº¥t lÆ°á»£ng sáº£n pháº©m."
                    },
                    Requirements = new List<string>
                    {
                        "Tá»‘i thiá»ƒu 3 nÄƒm kinh nghiá»‡m lÃ m ká»¹ sÆ° kiá»ƒm thá»­ tá»± Ä‘á»™ng (Auto QA).",
                        "ThÃ nh tháº¡o Ã­t nháº¥t má»™t trong cÃ¡c cÃ´ng cá»¥ viáº¿t test tá»± Ä‘á»™ng: Playwright, Cypress hoáº·c Selenium.",
                        "CÃ³ kinh nghiá»‡m lÃ m viá»‡c vá»›i ngÃ´n ngá»¯ láº­p trÃ¬nh JavaScript/TypeScript hoáº·c Python.",
                        "CÃ³ kiáº¿n thá»©c cÄƒn báº£n vá» máº­t mÃ£ há»c, mÃ£ bÄƒm (hashing), chá»¯ kÃ½ sá»‘ lÃ  má»™t lá»£i tháº¿ lá»›n.",
                        "TÆ° duy phÃ¢n tÃ­ch lá»—i tá»‘t, cáº©n tháº­n, tá»‰ má»‰ vÃ  giao tiáº¿p hiá»‡u quáº£."
                    },
                    Benefits = new List<string>
                    {
                        "Má»©c lÆ°Æ¡ng thá»a thuáº­n cáº¡nh tranh cao tÆ°Æ¡ng xá»©ng theo nÄƒng lá»±c thá»±c táº¿.",
                        "LÃ m viá»‡c tá»« xa (Remote) 100% giÃºp chá»§ Ä‘á»™ng cÃ¢n báº±ng thá»i gian vÃ  cuá»™c sá»‘ng.",
                        "ÄÆ°á»£c cung cáº¥p gÃ³i ngÃ¢n sÃ¡ch há»— trá»£ nÃ¢ng cáº¥p thiáº¿t bá»‹ cÃ¡ nhÃ¢n hÃ ng nÄƒm.",
                        "Tham gia hoáº¡t Ä‘á»™ng teambuilding thÆ°á»ng niÃªn cÃ¹ng cÃ´ng ty táº¡i cÃ¡c resort Ä‘áº³ng cáº¥p.",
                        "ÄÆ°á»£c tÃ i trá»£ chi phÃ­ thi cÃ¡c chá»©ng chá»‰ quá»‘c táº¿ chuyÃªn ngÃ nh kiá»ƒm thá»­ (ISTQB...)."
                    },
                    Tags = new List<string> { "Automation", "Playwright", "Cypress", "QA", "CI/CD" },
                    Skills = new List<string> { "Playwright", "Cypress", "QA Testing", "TypeScript", "CI/CD" },
                    CoverUrl = "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600",
                    Images = new List<string>
                    {
                        "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600",
                        "https://images.unsplash.com/photo-1531403009284-440f080d1e12?q=80&w=600"
                    },
                    IsActive = true,
                    CreatedAt = DateTimeOffset.UtcNow.AddDays(-2),
                    UpdatedAt = DateTimeOffset.UtcNow.AddDays(-2)
                },
                new JobVacancy
                {
                    Id = Guid.CreateVersion7(),
                    OrganizationId = org.Id,
                    Title = "Lead UI/UX Product Designer",
                    Department = "Design",
                    WorkplaceType = "On-site",
                    City = "HÃ  Ná»™i",
                    Type = "Full-Time",
                    Salary = "$ 1,500 - 3,200 USD",
                    SalaryMinMax = "38 - 80 triá»‡u",
                    Headcount = 1,
                    Gender = "KhÃ´ng yÃªu cáº§u",
                    Experience = "4+ nÄƒm kinh nghiá»‡m",
                    Degree = "Äáº¡i há»c / Cao Ä‘áº³ng Má»¹ thuáº­t",
                    Category = "Thiáº¿t káº¿ Ä‘á»“ há»a, UI/UX Design",
                    Description = new List<string>
                    {
                        "Chá»‹u trÃ¡ch nhiá»‡m thiáº¿t káº¿ giao diá»‡n (UI) vÃ  xÃ¢y dá»±ng tráº£i nghiá»‡m ngÆ°á»i dÃ¹ng (UX) cho cÃ¡c há»‡ thá»‘ng pháº§n má»m cá»§a CVerify.",
                        "XÃ¢y dá»±ng wireframe, prototype vÃ  sÆ¡ Ä‘á»“ luá»“ng tráº£i nghiá»‡m ngÆ°á»i dÃ¹ng (user flow) dá»±a trÃªn hoáº¡t Ä‘á»™ng nghiÃªn cá»©u hÃ nh vi khÃ¡ch hÃ ng.",
                        "Tá»• chá»©c, thiáº¿t láº­p vÃ  má»Ÿ rá»™ng há»‡ thá»‘ng thiáº¿t káº¿ (Design System) cá»§a cÃ´ng ty trÃªn Figma Ä‘áº£m báº£o tÃ­nh nháº¥t quÃ¡n cao.",
                        "Há»£p tÃ¡c cháº·t cháº½ cÃ¹ng Product Manager vÃ  Tech Lead Ä‘á»ƒ tháº©m Ä‘á»‹nh thiáº¿t káº¿ trÆ°á»›c khi chuyá»ƒn giao láº­p trÃ¬nh.",
                        "Thá»±c hiá»‡n Ä‘o lÆ°á»ng, phÃ¢n tÃ­ch hÃ nh vi vÃ  pháº£n há»“i tá»« ngÆ°á»i dÃ¹ng thá»±c táº¿ Ä‘á»ƒ liÃªn tá»¥c cáº£i tiáº¿n sáº£n pháº©m."
                    },
                    Requirements = new List<string>
                    {
                        "Tá»‘i thiá»ƒu 4 nÄƒm kinh nghiá»‡m thiáº¿t káº¿ giao diá»‡n á»©ng dá»¥ng web dashboard, ná»n táº£ng SaaS phá»©c táº¡p.",
                        "Ká»¹ nÄƒng sá»­ dá»¥ng Figma xuáº¥t sáº¯c (thÃ nh tháº¡o Auto-layout, Variables, Components, Prototyping nÃ¢ng cao).",
                        "CÃ³ tÆ° duy logic tá»‘t vá» tráº£i nghiá»‡m ngÆ°á»i dÃ¹ng (UX), kháº£ nÄƒng phÃ¢n tÃ­ch vÃ  giáº£i quyáº¿t cÃ¡c bÃ i toÃ¡n thiáº¿t káº¿ khÃ³.",
                        "CÃ³ portfolio cháº¥t lÆ°á»£ng cao trÃ¬nh bÃ y chi tiáº¿t tÆ° duy thiáº¿t káº¿ qua cÃ¡c dá»± Ã¡n thá»±c táº¿.",
                        "Hiá»ƒu biáº¿t cÄƒn báº£n vá» HTML/CSS lÃ  lá»£i tháº¿ lá»›n giÃºp phá»‘i há»£p Äƒn Ã½ vá»›i Ä‘á»™i ngÅ© frontend."
                    },
                    Benefits = new List<string>
                    {
                        "Má»©c lÆ°Æ¡ng cáº¡nh tranh háº¥p dáº«n cÃ¹ng cÃ¡c phá»¥ cáº¥p Äƒn trÆ°a, Ä‘i láº¡i táº¡i vÄƒn phÃ²ng.",
                        "MÃ´i trÆ°á»ng lÃ m viá»‡c nÄƒng Ä‘á»™ng, khÃ´ng gian vÄƒn phÃ²ng háº¡ng A hiá»‡n Ä‘áº¡i vÃ  rá»™ng rÃ£i.",
                        "ThÆ°á»Ÿng hiá»‡u suáº¥t cÃ´ng viá»‡c Ä‘á»‹nh ká»³ vÃ  xÃ©t tÄƒng lÆ°Æ¡ng Ä‘á»‹nh ká»³ 2 láº§n/nÄƒm.",
                        "ChÆ°Æ¡ng trÃ¬nh khÃ¡m sá»©c khá»e tá»•ng quÃ¡t Ä‘á»‹nh ká»³ hÃ ng nÄƒm táº¡i há»‡ thá»‘ng bá»‡nh viá»‡n quá»‘c táº¿.",
                        "Há»— trá»£ 100% chi phÃ­ tham gia cÃ¡c khÃ³a há»c chuyÃªn sÃ¢u nÃ¢ng cao chuyÃªn mÃ´n tá»± chá»n."
                    },
                    Tags = new List<string> { "Figma", "UI/UX", "Product Design", "Design System", "Wireframing" },
                    Skills = new List<string> { "Figma", "UI/UX", "Product Design", "Design System", "Wireframing" },
                    CoverUrl = "https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e?q=80&w=600",
                    Images = new List<string>
                    {
                        "https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e?q=80&w=600",
                        "https://images.unsplash.com/photo-1586717791821-3f44a563fa4c?q=80&w=600"
                    },
                    IsActive = true,
                    CreatedAt = DateTimeOffset.UtcNow.AddDays(-5),
                    UpdatedAt = DateTimeOffset.UtcNow.AddDays(-5)
                }
            };

            _context.JobVacancies.AddRange(mockJobs);
            await _context.SaveChangesAsync(cancellationToken);

            jobsList = await _context.JobVacancies
                .Where(jv => jv.OrganizationId == org.Id && jv.IsActive)
                .OrderByDescending(jv => jv.CreatedAt)
                .ToListAsync(cancellationToken);
        }

        var dtoList = new List<JobVacancyDto>();
        foreach (var job in jobsList)
        {
            dtoList.Add(await MapToJobVacancyDtoAsync(job, cancellationToken));
        }

        return Ok(dtoList);
    }
}
