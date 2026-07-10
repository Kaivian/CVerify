using System;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using CVerify.API.Modules.Profiles.DTOs;
using CVerify.API.Modules.Profiles.Services;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Storage.Constants;
using CVerify.API.Modules.Shared.Exceptions;

namespace CVerify.API.Modules.Profiles.Controllers;

[ApiController]
[Route("api/v1/users/profile")]
[Authorize]
public class ProfileController : ControllerBase
{
    private readonly IProfileService _profileService;

    public ProfileController(IProfileService profileService)
    {
        _profileService = profileService;
    }

    private Guid CurrentUserId
    {
        get
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
            {
                throw new UnauthorizedAccessException("User is not authenticated or user ID is invalid.");
            }
            return userId;
        }
    }

    private (string? IpAddress, string? UserAgent) RequestMetadata
    {
        get
        {
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
            if (HttpContext.Request.Headers.TryGetValue("X-Forwarded-For", out var forwarded))
            {
                ip = forwarded.ToString();
            }
            var userAgent = HttpContext.Request.Headers["User-Agent"].ToString();
            return (ip, userAgent);
        }
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(ProfileResponse))]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetProfile(CancellationToken cancellationToken)
    {
        var profile = await _profileService.GetProfileByUserIdAsync(CurrentUserId, cancellationToken);
        return Ok(profile);
    }

    [HttpPut]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(ProfileResponse))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var (ip, ua) = RequestMetadata;
        var updatedProfile = await _profileService.UpdateProfileAsync(CurrentUserId, request, ip, ua, cancellationToken);
        return Ok(updatedProfile);
    }

    [HttpPut("username")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> UpdateUsername([FromBody] UpdateUsernameRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var (ip, ua) = RequestMetadata;
        await _profileService.UpdateUsernameAsync(CurrentUserId, request.NewUsername, ip, ua, cancellationToken);
        return NoContent();
    }

    [HttpPost("avatar")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(AvatarUploadResponse))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> UploadAvatar([FromForm] IFormFile file, CancellationToken cancellationToken)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest("File payload is empty or missing.");
        }

        // Validate file size limit
        if (file.Length > StorageConstants.MaxProfileSize)
        {
            return BadRequest($"File size exceeds the maximum allowed limit of {StorageConstants.MaxProfileSize / (1024 * 1024)}MB.");
        }

        // Validate MIME type
        if (!StorageConstants.AllowedImageTypes.Contains(file.ContentType))
        {
            return BadRequest($"MIME type '{file.ContentType}' is not supported. Only JPEG, PNG, WebP, and GIF are allowed.");
        }

        using var fileStream = file.OpenReadStream();
        var (signedUrl, objectKey) = await _profileService.UploadAvatarAsync(
            CurrentUserId,
            fileStream,
            file.FileName,
            file.ContentType,
            cancellationToken);

        return Ok(new AvatarUploadResponse(signedUrl));
    }

    [HttpPost("avatar/sync")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(AvatarUploadResponse))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> SyncAvatar([FromBody] SyncAvatarRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        try
        {
            var (signedUrl, objectKey) = await _profileService.SyncAvatarWithProviderAsync(
                CurrentUserId,
                request.ProviderName,
                cancellationToken);

            return Ok(new AvatarUploadResponse(signedUrl));
        }
        catch (BusinessRuleException ex)
        {
            return BadRequest(new { code = ex.ErrorCode, message = ex.Message });
        }
        catch (ResourceNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpDelete("avatar")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteAvatar(CancellationToken cancellationToken)
    {
        try
        {
            await _profileService.DeleteAvatarAsync(CurrentUserId, cancellationToken);
            return NoContent();
        }
        catch (ResourceNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpGet("public/{username}")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(PublicProfileResponse))]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPublicProfile(string username, CancellationToken cancellationToken)
    {
        try
        {
            var profile = await _profileService.GetPublicProfileByUsernameAsync(username, cancellationToken);
            return Ok(profile);
        }
        catch (ResourceNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpGet("ranking")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetRanking([FromQuery] RankingQueryDto query, CancellationToken cancellationToken)
    {
        Guid? currentUserId = null;
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!string.IsNullOrEmpty(userIdStr) && Guid.TryParse(userIdStr, out var parsedId))
        {
            currentUserId = parsedId;
        }

        var result = await _profileService.GetRankingAsync(currentUserId, query, cancellationToken);
        return Ok(result);
    }

    [HttpGet("ranking/stats")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(RankingStatsDto))]
    public async Task<IActionResult> GetRankingStats(CancellationToken cancellationToken)
    {
        var result = await _profileService.GetRankingStatsAsync(cancellationToken);
        return Ok(result);
    }

    [HttpPost("public/{username}/follow")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> FollowUser(string username, CancellationToken cancellationToken)
    {
        try
        {
            await _profileService.FollowUserAsync(CurrentUserId, username, cancellationToken);
            return NoContent();
        }
        catch (ResourceNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (BusinessRuleException ex)
        {
            return BadRequest(new { code = ex.ErrorCode, message = ex.Message });
        }
    }

    [HttpPost("public/{username}/unfollow")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UnfollowUser(string username, CancellationToken cancellationToken)
    {
        try
        {
            await _profileService.UnfollowUserAsync(CurrentUserId, username, cancellationToken);
            return NoContent();
        }
        catch (ResourceNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (BusinessRuleException ex)
        {
            return BadRequest(new { code = ex.ErrorCode, message = ex.Message });
        }
    }
}
