using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using CVerify.API.Modules.AiChat.Entities;
using CVerify.API.Modules.Recovery.DTOs;
using CVerify.API.Modules.Recovery.Services;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Recovery.Controllers;

[ApiController]
[Route("api/auth/recovery/level2")]
public class Level2RecoveryController : ControllerBase
{
    private readonly ILevel2RecoveryService _level2RecoveryService;

    public Level2RecoveryController(ILevel2RecoveryService level2RecoveryService)
    {
        _level2RecoveryService = level2RecoveryService;
    }

    [HttpGet("check")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(Level2CheckResponse))]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CheckOrganization([FromQuery] string taxCode, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _level2RecoveryService.CheckOrganizationAsync(taxCode, cancellationToken);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPost("request-rotation")]
    [AllowAnonymous]
    [EnableRateLimiting("ForgotPasswordLimit")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(RepresentativeRotationRequestResponse))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> RequestRotation(
        [FromBody] RepresentativeRotationRequestDto request,
        CancellationToken cancellationToken)
    {
        var userAgent = Request.Headers.UserAgent.ToString();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";

        try
        {
            var result = await _level2RecoveryService.RequestRotationAsync(request, userAgent, ipAddress, cancellationToken);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("requests")]
    [Authorize(Roles = "SUPER_ADMIN,ADMIN")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(List<RepresentativeRotationRequestResponse>))]
    public async Task<IActionResult> GetRequestsQueue(CancellationToken cancellationToken)
    {
        var result = await _level2RecoveryService.GetRequestsQueueAsync(cancellationToken);
        return Ok(result);
    }

    [HttpPost("requests/{id}/verification-call")]
    [Authorize(Roles = "SUPER_ADMIN,ADMIN")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> RecordVerificationCall(
        Guid id,
        [FromBody] VerificationCallRequest request,
        CancellationToken cancellationToken)
    {
        var reviewerName = User.FindFirst(ClaimTypes.Email)?.Value ?? User.Identity?.Name ?? "system_admin";

        try
        {
            var result = await _level2RecoveryService.RecordVerificationCallAsync(id, request.Notes, request.Status, reviewerName, cancellationToken);
            return Ok(new { success = result });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("requests/{id}/support-approval")]
    [Authorize(Roles = "SUPER_ADMIN,ADMIN")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ReviewSupportApproval(
        Guid id,
        [FromBody] SupportApprovalRequest request,
        CancellationToken cancellationToken)
    {
        var reviewerName = User.FindFirst(ClaimTypes.Email)?.Value ?? User.Identity?.Name ?? "system_admin";
        var userAgent = Request.Headers.UserAgent.ToString();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";

        try
        {
            var result = await _level2RecoveryService.ReviewSupportApprovalAsync(id, request.Decision, reviewerName, userAgent, ipAddress, cancellationToken);
            return Ok(new { success = result });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("vote")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> SubmitAdminVote(
        [FromBody] AdminVoteRequest request,
        CancellationToken cancellationToken)
    {
        var userAgent = Request.Headers.UserAgent.ToString();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";

        try
        {
            var result = await _level2RecoveryService.SubmitAdminVoteAsync(request.Token, request.Decision, ipAddress, userAgent, cancellationToken);
            return Ok(new { success = result });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpGet("organization/{organizationId}/history")]
    [Authorize(Roles = "SUPER_ADMIN,ADMIN")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(List<RepresentativeAuthorityHistoryResponse>))]
    public async Task<IActionResult> GetOrganizationHistory(Guid organizationId, CancellationToken cancellationToken)
    {
        var result = await _level2RecoveryService.GetOrganizationHistoryAsync(organizationId, cancellationToken);
        return Ok(result);
    }
}
