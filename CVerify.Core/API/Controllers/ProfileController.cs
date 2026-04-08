using System;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using CVerify.API.Application.DTOs;
using CVerify.API.Application.Interfaces;

namespace CVerify.API.API.Controllers;

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
}
