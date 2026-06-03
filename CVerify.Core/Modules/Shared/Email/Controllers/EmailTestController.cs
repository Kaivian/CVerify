
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Hosting;
using CVerify.API.Modules.Auth.Entities;
using CVerify.API.Modules.Shared.Email.Services;
using CVerify.API.Modules.Shared.Security;

namespace CVerify.API.Modules.Shared.Email.Controllers;

/// <summary>
/// Developer-only endpoints to trigger email flows, review structured audit trails, and check tokens.
/// </summary>
[ApiController]
[Route("api/emailtest")]
public class EmailTestController : ControllerBase
{
    private readonly IEmailService _emailService;
    private readonly IEmailTemplateService _templateService;
    private readonly IWebHostEnvironment _environment;

    /// <summary>
    /// Initializes a new instance of the <see cref="EmailTestController"/> class.
    /// </summary>
    public EmailTestController(
        IEmailService emailService,
        IEmailTemplateService templateService,
        IWebHostEnvironment environment)
    {
        _emailService = emailService;
        _templateService = templateService;
        _environment = environment;
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

    /// <summary>
    /// Development-only endpoint to preview the fully compiled and rendered email templates.
    /// </summary>
    [HttpGet("/api/email/preview/{template}")]
    public async Task<IActionResult> PreviewEmailTemplate(string template)
    {
        if (!_environment.IsDevelopment())
        {
            return NotFound("Email preview is only available in Development mode.");
        }

        if (string.IsNullOrWhiteSpace(template))
        {
            return BadRequest("Template name is required.");
        }

        var templateName = template;
        if (!templateName.EndsWith(".html", StringComparison.OrdinalIgnoreCase))
        {
            templateName += ".html";
        }

        var mockModel = new Dictionary<string, object>
        {
            { "full_name", "John Doe" },
            { "verification_link", "https://cverify.ai/verify?token=mock_verification_token_123" },
            { "reset_link", "https://cverify.ai/reset?token=mock_reset_token_456" },
            { "otp_code", "123456" },
            { "company_name", "Acme Corporation" },
            { "workspace_id", "ws_acme_prod_99" },
            { "workspace_url", "https://cverify.ai/workspaces/ws_acme_prod_99" },
            { "alert_title", "Unusual Account Activity Detected" },
            { "alert_message", "We detected a login attempt from a new IP address or device that you do not normally use." },
            { "activity_type", "Login from New Device" },
            { "activity_time", DateTime.UtcNow.ToString("f") },
            { "ip_address", "192.168.1.100 (Hanoi, VN)" },
            { "user_agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
            { "action_link", "https://cverify.ai/lock-account?token=mock_lock_token_789" }
        };

        try
        {
            var html = await _templateService.RenderTemplateAsync(templateName, mockModel);
            return Content(html, "text/html");
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}
