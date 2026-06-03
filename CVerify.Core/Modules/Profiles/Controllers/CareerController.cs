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

namespace CVerify.API.Modules.Profiles.Controllers;

[ApiController]
[Route("api/v1/users/career")]
[Authorize]
public class CareerController : ControllerBase
{
    private readonly ICareerService _careerService;

    public CareerController(ICareerService careerService)
    {
        _careerService = careerService;
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

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(CareerPreferenceResponse))]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetCareer(CancellationToken cancellationToken)
    {
        var career = await _careerService.GetCareerPreferenceByUserIdAsync(CurrentUserId, cancellationToken);
        return Ok(career);
    }

    [HttpPut]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(CareerPreferenceResponse))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> UpdateCareer([FromBody] UpdateCareerPreferenceRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var career = await _careerService.UpdateCareerPreferenceAsync(CurrentUserId, request, cancellationToken);
        return Ok(career);
    }
}
