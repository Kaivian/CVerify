using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using CVerify.API.Application.Interfaces;
using CVerify.API.Infrastructure.Security;
using CVerify.API.Infrastructure.Services;

namespace CVerify.API.API.Controllers;

/// <summary>
/// Developer-only endpoints to trigger email flows, review structured audit trails, and check tokens.
/// </summary>
[ApiController]
[Route("api/emailtest")]
public class EmailTestController : ControllerBase
{
    private readonly IEmailService _emailService;

    /// <summary>
    /// Initializes a new instance of the <see cref="EmailTestController"/> class.
    /// </summary>
    public EmailTestController(IEmailService emailService)
    {
        _emailService = emailService;
    }

    /// <summary>
    /// Model to trigger verification emails.
    /// </summary>
    public class VerificationRequest
    {
        public string Email { get; set; } = null!;
        public string FullName { get; set; } = null!;
        public string? VerificationLink { get; set; }
    }

    /// <summary>
    /// Model to trigger reset password emails.
    /// </summary>
    public class ResetRequest
    {
        public string Email { get; set; } = null!;
        public string FullName { get; set; } = null!;
        public string? ResetLink { get; set; }
    }

    /// <summary>
    /// Sends a high-fidelity verification card to the designated address.
    /// </summary>
    [HttpPost("send-verification")]
    public async Task<IActionResult> SendVerification([FromBody] VerificationRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.FullName))
        {
            return BadRequest("Email and FullName are required parameters.");
        }

        // Auto-generate verification link containing secure Base64Url token if not supplied
        var verificationLink = request.VerificationLink;
        if (string.IsNullOrWhiteSpace(verificationLink))
        {
            var token = EmailTokenGenerator.GenerateSecureToken();
            verificationLink = $"https://cverify.ai/verify?token={token}";
        }

        await _emailService.SendVerificationEmailAsync(request.Email, request.FullName, verificationLink);

        return Ok(new
        {
            status = "Verification email triggered successfully.",
            recipient = request.Email,
            link = verificationLink
        });
    }

    /// <summary>
    /// Sends a security password reset warning containing a quick-action button.
    /// </summary>
    [HttpPost("send-reset")]
    public async Task<IActionResult> SendResetPassword([FromBody] ResetRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.FullName))
        {
            return BadRequest("Email and FullName are required parameters.");
        }

        // Auto-generate password reset link containing secure Base64Url token if not supplied
        var resetLink = request.ResetLink;
        if (string.IsNullOrWhiteSpace(resetLink))
        {
            var token = EmailTokenGenerator.GenerateSecureToken();
            resetLink = $"https://cverify.ai/reset?token={token}";
        }

        await _emailService.SendResetPasswordEmailAsync(request.Email, request.FullName, resetLink);

        return Ok(new
        {
            status = "Password reset email triggered successfully.",
            recipient = request.Email,
            link = resetLink
        });
    }

    /// <summary>
    /// Retrieves the in-memory buffered structured audit traces.
    /// </summary>
    [HttpGet("logs")]
    public ActionResult<IEnumerable<string>> GetAuditLogs()
    {
        var logs = StructuredEmailAuditLogger.GetDiagnosticTraces();
        return Ok(logs);
    }

    /// <summary>
    /// Clears the in-memory buffered audit logs.
    /// </summary>
    [HttpDelete("logs")]
    public IActionResult ClearAuditLogs()
    {
        StructuredEmailAuditLogger.ClearDiagnosticTraces();
        return Ok("InMemory diagnostic audit log buffer successfully cleared.");
    }

    /// <summary>
    /// Helper endpoint to generate a secure random URL-safe Base64Url token.
    /// </summary>
    [HttpGet("generate-token")]
    public IActionResult GenerateSecureToken([FromQuery] int byteLength = 32)
    {
        if (byteLength <= 0 || byteLength > 1024)
        {
            byteLength = 32;
        }

        var token = EmailTokenGenerator.GenerateSecureToken(byteLength);
        return Ok(new
        {
            token = token,
            length = token.Length,
            entropyBytes = byteLength
        });
    }
}
