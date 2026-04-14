using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using CVerify.API.Modules.Profiles.DTOs;
using CVerify.API.Modules.Profiles.Services;

namespace CVerify.API.Modules.Profiles.Controllers;

[ApiController]
[Route("api/v1/users/work-experience")]
[Authorize]
public class WorkExperienceController : ControllerBase
{
    private readonly IWorkExperienceService _workExperienceService;

    public WorkExperienceController(IWorkExperienceService workExperienceService)
    {
        _workExperienceService = workExperienceService;
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
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(List<WorkExperienceResponse>))]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetWorkExperiences(CancellationToken cancellationToken)
    {
        var entries = await _workExperienceService.GetWorkExperiencesAsync(CurrentUserId, cancellationToken);
        return Ok(entries);
    }

    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created, Type = typeof(WorkExperienceResponse))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> AddWorkExperience([FromBody] WorkExperienceRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var entry = await _workExperienceService.CreateWorkExperienceAsync(CurrentUserId, request, cancellationToken);
        return CreatedAtAction(nameof(GetWorkExperiences), null, entry);
    }

    [HttpPut("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(WorkExperienceResponse))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> UpdateWorkExperience(Guid id, [FromBody] WorkExperienceRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var updated = await _workExperienceService.UpdateWorkExperienceAsync(CurrentUserId, id, request, cancellationToken);
        return Ok(updated);
    }

    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> DeleteWorkExperience(Guid id, CancellationToken cancellationToken)
    {
        await _workExperienceService.DeleteWorkExperienceAsync(CurrentUserId, id, cancellationToken);
        return NoContent();
    }

    [HttpPut("reorder")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> ReorderWorkExperiences([FromBody] ReorderItemsRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        await _workExperienceService.ReorderWorkExperiencesAsync(CurrentUserId, request.OrderedIds, cancellationToken);
        return NoContent();
    }
}
