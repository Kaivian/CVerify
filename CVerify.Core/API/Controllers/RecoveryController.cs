using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using CVerify.API.Application.DTOs;
using CVerify.API.Application.Interfaces;
using CVerify.API.Application.Exceptions;

namespace CVerify.API.API.Controllers;

[ApiController]
[Route("api/auth/recovery")]
public class RecoveryController : ControllerBase
{
    private readonly ICandidateRecoveryService _candidateRecoveryService;
    private readonly IOrganizationRecoveryService _organizationRecoveryService;
    private readonly IOrganizationReclaimService _organizationReclaimService;

    public RecoveryController(
        ICandidateRecoveryService candidateRecoveryService,
        IOrganizationRecoveryService organizationRecoveryService,
        IOrganizationReclaimService organizationReclaimService)
    {
        _candidateRecoveryService = candidateRecoveryService;
        _organizationRecoveryService = organizationRecoveryService;
        _organizationReclaimService = organizationReclaimService;
    }

    // ==========================================
    // 1. CANDIDATE RECOVERY FLOW
    // ==========================================

    [HttpPost("candidate/forgot")]
    [AllowAnonymous]
    [EnableRateLimiting("ForgotPasswordLimit")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CandidateForgot([FromBody] ForgotPasswordRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _candidateRecoveryService.ForgotPasswordAsync(request, cancellationToken);
            if (result)
            {
                return Ok(new { message = "If the email is registered, a password reset link has been enqueued." });
            }
            return BadRequest(new { message = "Request could not be processed." });
        }
        catch (AuthException ex)
        {
            return BadRequest(new { code = ex.Code, message = ex.Message });
        }
    }

    [HttpPost("candidate/reset")]
    [AllowAnonymous]
    [EnableRateLimiting("ResetPasswordLimit")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(AuthResponse))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CandidateReset([FromBody] ResetPasswordRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _candidateRecoveryService.ResetPasswordAsync(request, cancellationToken);
            if (result != null)
            {
                return Ok(result);
            }
            return BadRequest(new { message = "Password reset could not be processed." });
        }
        catch (AuthException ex)
        {
            return BadRequest(new { code = ex.Code, message = ex.Message });
        }
    }

    // ==========================================
    // 2. STANDARD ORGANIZATION RECOVERY FLOW
    // ==========================================

    [HttpPost("organization/forgot")]
    [AllowAnonymous]
    [EnableRateLimiting("ForgotPasswordLimit")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(OrganizationForgotResponse))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> OrganizationForgot([FromBody] OrganizationForgotRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var response = await _organizationRecoveryService.ForgotPasswordAsync(request, cancellationToken);
            return Ok(response);
        }
        catch (AuthException ex)
        {
            return BadRequest(new { code = ex.Code, message = ex.Message });
        }
    }

    [HttpPost("organization/verify-otp")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(VerifyOrganizationOtpResponse))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> OrganizationVerifyOtp([FromBody] VerifyOrganizationOtpRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var response = await _organizationRecoveryService.VerifyRecoveryOtpAsync(request, cancellationToken);
            return Ok(response);
        }
        catch (AuthException ex)
        {
            return BadRequest(new { code = ex.Code, message = ex.Message });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPost("organization/reset-password")]
    [AllowAnonymous]
    [EnableRateLimiting("ResetPasswordLimit")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(AuthResponse))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> OrganizationResetPassword([FromBody] ResetOrganizationPasswordRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var response = await _organizationRecoveryService.ResetPasswordAsync(request, cancellationToken);
            if (response != null)
            {
                return Ok(response);
            }
            return BadRequest(new { message = "Corporate credential rotation failed." });
        }
        catch (AuthException ex)
        {
            return BadRequest(new { code = ex.Code, message = ex.Message });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    // ==========================================
    // 3. ENTERPRISE ORGANIZATION RECLAIM FLOW
    // ==========================================

    [HttpPost("reclaim/submit-claim")]
    [AllowAnonymous]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(SubmitClaimResponse))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> SubmitReclaimClaim(
        [FromForm] SubmitClaimRequest request,
        [FromForm] List<IFormFile> documents,
        CancellationToken cancellationToken)
    {
        if (request == null)
        {
            return BadRequest("Reclaim claim request payload is missing.");
        }

        var userAgent = Request.Headers.UserAgent.ToString();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";

        var docList = new List<(System.IO.Stream fileStream, string fileName, string contentType)>();
        foreach (var file in documents)
        {
            docList.Add((file.OpenReadStream(), file.FileName, file.ContentType));
        }

        try
        {
            var response = await _organizationReclaimService.SubmitClaimAsync(request, docList, userAgent, ipAddress, cancellationToken);
            return Ok(response);
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

    [HttpGet("reclaim/claims")]
    [Authorize(Roles = "SUPER_ADMIN,ADMIN")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(List<ClaimDetailsResponse>))]
    public async Task<IActionResult> GetReclaimClaims(CancellationToken cancellationToken)
    {
        var claims = await _organizationReclaimService.GetPendingClaimsAsync(cancellationToken);
        return Ok(claims);
    }

    [HttpPost("reclaim/claims/{id}/review")]
    [Authorize(Roles = "SUPER_ADMIN,ADMIN")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ReviewReclaimClaim(
        Guid id,
        [FromBody] ReviewClaimRequest request,
        CancellationToken cancellationToken)
    {
        var reviewerName = User.FindFirst(ClaimTypes.Email)?.Value ?? User.Identity?.Name ?? "system_admin";
        
        try
        {
            var result = await _organizationReclaimService.ReviewClaimAsync(id, request, reviewerName, cancellationToken);
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

    [HttpGet("reclaim/claims/{id}/document/{docId}")]
    [Authorize(Roles = "SUPER_ADMIN,ADMIN")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> DownloadReclaimDocument(
        Guid id,
        Guid docId,
        CancellationToken cancellationToken)
    {
        var reviewerName = User.FindFirst(ClaimTypes.Email)?.Value ?? User.Identity?.Name ?? "system_admin";

        try
        {
            var (fileStream, fileName, contentType) = await _organizationReclaimService.DownloadDocumentAsync(docId, reviewerName, cancellationToken);
            return File(fileStream, contentType, fileName);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpGet("reclaim/bootstrap/verify")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(VerifyBootstrapResponse))]
    public async Task<IActionResult> VerifyReclaimBootstrap([FromQuery] string token, CancellationToken cancellationToken)
    {
        var response = await _organizationReclaimService.VerifyBootstrapTokenAsync(token, cancellationToken);
        if (!response.IsValid)
        {
            return BadRequest(new { message = "Recovery token is invalid, expired, or has already been used." });
        }

        return Ok(response);
    }

    [HttpPost("reclaim/bootstrap/setup-credentials")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(SetupRecoveryCredentialsResponse))]
    public async Task<IActionResult> SetupReclaimCredentials([FromBody] SetupRecoveryCredentialsRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var response = await _organizationReclaimService.SetupRecoveryCredentialsAsync(request, cancellationToken);
            return Ok(response);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("reclaim/bootstrap/execute")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(AuthResponse))]
    public async Task<IActionResult> ExecuteReclaimRecovery([FromBody] ExecuteRecoveryRequest request, CancellationToken cancellationToken)
    {
        var userAgent = Request.Headers.UserAgent.ToString();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";

        try
        {
            var response = await _organizationReclaimService.ExecuteRecoveryAsync(request, userAgent, ipAddress, cancellationToken);
            return Ok(response);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
