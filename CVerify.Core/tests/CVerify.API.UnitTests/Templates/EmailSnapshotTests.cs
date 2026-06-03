using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.Extensions.Options;
using Xunit;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.Email.Services;

namespace CVerify.API.UnitTests.Templates;

/// <summary>
/// Snapshot tests ensuring that visual styling, layout compilation, and branding values of transactional emails do not drift.
/// </summary>
public class EmailSnapshotTests
{
    private readonly string _templatesDirectory;
    private readonly string _snapshotsDirectory;
    private readonly EmailTemplateService _service;

    /// <summary>
    /// Initializes a new instance of the <see cref="EmailSnapshotTests"/> class.
    /// </summary>
    public EmailSnapshotTests()
    {
        // Point to the real templates copied to the build output
        _templatesDirectory = Path.Combine(AppContext.BaseDirectory, "Modules", "Shared", "Email", "Templates");
        
        // Save snapshots inside the project source folder so they are checked into git,
        // and fall back to bin directory if running in isolated settings.
        var projectDir = Path.Combine(AppContext.BaseDirectory, "..", "..", "..");
        var targetSnapshotsDir = Path.Combine(projectDir, "Snapshots");
        
        if (Directory.Exists(projectDir))
        {
            _snapshotsDirectory = targetSnapshotsDir;
        }
        else
        {
            _snapshotsDirectory = Path.Combine(AppContext.BaseDirectory, "Snapshots");
        }

        Directory.CreateDirectory(_snapshotsDirectory);

        var settings = new EmailSettings
        {
            UseLegacyEmailTemplates = false,
            ProductName = "CVerify",
            SupportEmail = "support@cverify.ai",
            WebsiteUrl = "https://cverify.ai",
            AssetBaseUrl = "https://cverify.ai",
            Colors = new EmailColors
            {
                Accent = "#854e28",
                AccentLight = "#fdfaf8",
                Background = "#f5f5f5",
                Border = "#dfdedd",
                Separator = "#e5e4e3",
                Success = "#169c46",
                Warning = "#ff9555",
                WarningLight = "#fff9f5",
                WarningDark = "#854e28",
                Danger = "#cf202f",
                DangerLight = "#fff4f2",
                DangerDark = "#cf202f",
                Foreground = "#191818",
                ForegroundMuted = "#737170",
                Text = "#191818",
                Surface = "#fffffe",
                SurfaceSecondary = "#f0efee",
                SurfaceTertiary = "#ebeae9",
                Muted = "#737170"
            }
        };

        _service = new EmailTemplateService(Options.Create(settings), _templatesDirectory);
    }

    /// <summary>
    /// Compares fully compiled layout and template output against frozen snapshot files to guarantee visual consistency.
    /// </summary>
    [Theory]
    [InlineData("OtpVerificationEmail.html")]
    [InlineData("Login2FaEmail.html")]
    [InlineData("PasswordRecoveryEmail.html")]
    [InlineData("WelcomeEmail.html")]
    [InlineData("ResetPasswordEmail.html")]
    [InlineData("EmailChangeVerificationEmail.html")]
    [InlineData("SecurityAlertEmail.html")]
    [InlineData("SecurityActionEmail.html")]
    [InlineData("BusinessVerificationEmail.html")]
    [InlineData("CompanyOwnerVerificationEmail.html")]
    [InlineData("CompanyVerificationEmail.html")]
    [InlineData("WorkspaceOnboardingEmail.html")]
    [InlineData("VerificationEmail.html")]
    public async Task ValidateTemplateSnapshots(string templateName)
    {
        // Arrange
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
            { "activity_time", "Wednesday, June 3, 2026 1:00 PM" }, // Hardcoded for determinism
            { "ip_address", "192.168.1.100 (Hanoi, VN)" },
            { "user_agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
            { "action_link", "https://cverify.ai/lock-account?token=mock_lock_token_789" },
            { "greeting_text", "Hi John Doe," }
        };

        // Act
        var renderedHtml = await _service.RenderTemplateAsync(templateName, mockModel).ConfigureAwait(false);

        // Assert
        var snapshotPath = Path.Combine(_snapshotsDirectory, templateName);
        if (!File.Exists(snapshotPath))
        {
            // Auto-generate snapshot on the first run
            await File.WriteAllTextAsync(snapshotPath, renderedHtml).ConfigureAwait(false);
        }

        var expectedHtml = await File.ReadAllTextAsync(snapshotPath).ConfigureAwait(false);
        
        // Normalize line endings to avoid cross-platform OS mismatches
        var normalizedRendered = renderedHtml.Replace("\r\n", "\n").Trim();
        var normalizedExpected = expectedHtml.Replace("\r\n", "\n").Trim();

        normalizedRendered.Should().Be(normalizedExpected);
    }
}
