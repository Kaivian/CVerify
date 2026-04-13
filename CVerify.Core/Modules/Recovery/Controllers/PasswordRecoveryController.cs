using System;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.AiChat.Entities;
using CVerify.API.Modules.Auth.Entities;
using CVerify.API.Modules.Auth.Services;
using CVerify.API.Modules.Recovery.DTOs;
using CVerify.API.Modules.Recovery.Entities;
using CVerify.API.Modules.Recovery.Services;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Exceptions;
using CVerify.API.Modules.Shared.Persistence;

namespace CVerify.API.Modules.Recovery.Controllers;

[ApiController]
[Route("api/auth/password-recovery")]
[Authorize]
public class PasswordRecoveryController : ControllerBase
{
    private readonly IPasswordRecoveryService _passwordRecoveryService;
    private readonly ApplicationDbContext _dbContext;
    private readonly Microsoft.Extensions.Logging.ILogger<PasswordRecoveryController> _logger;

    public PasswordRecoveryController(
        IPasswordRecoveryService passwordRecoveryService,
        ApplicationDbContext dbContext,
        Microsoft.Extensions.Logging.ILogger<PasswordRecoveryController> logger)
    {
        _passwordRecoveryService = passwordRecoveryService;
        _dbContext = dbContext;
        _logger = logger;
    }

    [HttpPost("send-otp")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> SendOtp(CancellationToken cancellationToken)
    {
        var email = User.FindFirst(ClaimTypes.Email)?.Value;
        if (string.IsNullOrEmpty(email))
        {
            return Unauthorized(new { message = "User email not found in token claims." });
        }

        var userAgent = Request.Headers.UserAgent.ToString();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";

        try
        {
            var result = await _passwordRecoveryService.SendOtpAsync(email, userAgent, ipAddress, cancellationToken);
            
            // Get the generated OtpVerification to find the exact CooldownUntil
            var verification = await _dbContext.OtpVerifications
                .FirstOrDefaultAsync(v => v.ChallengeId == result.ChallengeId, cancellationToken);

            var cooldownUntil = verification?.CooldownUntil ?? DateTimeOffset.UtcNow.AddSeconds(result.CooldownSeconds);

            return Ok(new
            {
                success = true,
                cooldownSeconds = result.CooldownSeconds,
                cooldownUntil = cooldownUntil.ToString("yyyy-MM-ddTHH:mm:ssZ"),
                otpExpiresIn = 300
            });
        }
        catch (AuthException ex)
        {
            return BadRequest(new { code = ex.Code, message = ex.Message });
        }
    }

    [HttpPost("verify-otp")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> VerifyOtp([FromBody] VerifyRecoveryOtpRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var email = User.FindFirst(ClaimTypes.Email)?.Value;
        if (string.IsNullOrEmpty(email))
        {
            return Unauthorized(new { message = "User email not found in token claims." });
        }

        try
        {
            var result = await _passwordRecoveryService.VerifyOtpAsync(email, request.Otp, cancellationToken);
            return Ok(new
            {
                success = true,
                verified = true,
                recoveryToken = result.VerificationToken,
                expiresIn = 600
            });
        }
        catch (AuthException ex)
        {
            return BadRequest(new { code = ex.Code, message = ex.Message });
        }
    }

    [HttpPost("change-password")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordViaRecoveryRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var email = User.FindFirst(ClaimTypes.Email)?.Value;
        if (string.IsNullOrEmpty(email))
        {
            return Unauthorized(new { message = "User email not found in token claims." });
        }

        try
        {
            var success = await _passwordRecoveryService.ChangePasswordAsync(
                email,
                request.RecoveryToken,
                request.NewPassword,
                request.ConfirmPassword,
                cancellationToken
            );
            return Ok(new { success });
        }
        catch (AuthException ex)
        {
            return BadRequest(new { code = ex.Code, message = ex.Message });
        }
        catch (ResourceNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }
}
