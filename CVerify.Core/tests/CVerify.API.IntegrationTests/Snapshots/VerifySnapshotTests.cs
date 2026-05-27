using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using VerifyXunit;
using Xunit;
using CVerify.API.IntegrationTests.Fixtures;
using CVerify.API.Modules.Shared.Email.Services;

namespace CVerify.API.IntegrationTests.Snapshots;

/// <summary>
/// Execution tests using Verify.Xunit snapshot comparison engine to validate HTML structures and contracts.
[Collection("Shared Containers Collection")]
public class VerifySnapshotTests
{
    private readonly SharedTestcontainerFixture _fixture;
    private readonly IEmailTemplateService _templateService;

    /// <summary>
    /// Initializes a new instance of the <see cref="VerifySnapshotTests"/> class.
    /// </summary>
    public VerifySnapshotTests(SharedTestcontainerFixture fixture)
    {
        _fixture = fixture;
        var factory = new IntegrationTestApplicationFactory(_fixture);
        _templateService = factory.Services.GetRequiredService<IEmailTemplateService>();
    }

    [Fact]
    public async Task VerificationEmailTemplate_SnapshotTest()
    {
        // Arrange
        var model = new Dictionary<string, object>
        {
            { "full_name", "Luc Snapshot Tester" },
            { "verification_link", "https://cverify.ai/verify?token=verify_snapshot_123_abc" },
            { "greeting_text", "Hi Luc Snapshot Tester," }
        };

        // Act
        var html = await _templateService.RenderTemplateAsync("VerificationEmail.html", model).ConfigureAwait(false);

        // Assert
        // Verifier saves dynamic HTML outputs and compares them to pre-recorded .received and .verified states
        await Verifier.Verify(html, "html").ConfigureAwait(false);
    }

    [Fact]
    public async Task ResetPasswordEmailTemplate_SnapshotTest()
    {
        // Arrange
        var model = new Dictionary<string, object>
        {
            { "full_name", "Luc Snapshot Tester" },
            { "reset_link", "https://cverify.ai/reset?token=reset_snapshot_123_abc" },
            { "greeting_text", "Hi Luc Snapshot Tester," }
        };

        // Act
        var html = await _templateService.RenderTemplateAsync("ResetPasswordEmail.html", model).ConfigureAwait(false);

        // Assert
        await Verifier.Verify(html, "html").ConfigureAwait(false);
    }

    [Fact]
    public async Task WelcomeEmailTemplate_SnapshotTest()
    {
        // Arrange
        var model = new Dictionary<string, object>
        {
            { "full_name", "Luc Welcome Snapshot" },
            { "greeting_text", "Hi Luc Welcome Snapshot," }
        };

        // Act
        var html = await _templateService.RenderTemplateAsync("WelcomeEmail.html", model).ConfigureAwait(false);

        // Assert
        await Verifier.Verify(html, "html").ConfigureAwait(false);
    }

    [Fact]
    public async Task OtpVerificationEmailTemplate_SnapshotTest()
    {
        // Arrange
        var model = new Dictionary<string, object>
        {
            { "full_name", "Luc OTP Tester" },
            { "otp_code", "948201" },
            { "greeting_text", "Hi Luc OTP Tester," }
        };

        // Act
        var html = await _templateService.RenderTemplateAsync("OtpVerificationEmail.html", model).ConfigureAwait(false);

        // Assert
        await Verifier.Verify(html, "html").ConfigureAwait(false);
    }

    [Fact]
    public async Task SecurityAlertEmailTemplate_SnapshotTest()
    {
        // Arrange
        var model = new Dictionary<string, object>
        {
            { "full_name", "Luc Security Alert" },
            { "alert_title", "Suspicious Identity Account Access" },
            { "alert_message", "A new login attempt was detected from a location and device that is not recognized. Please verify if this activity was authorized by you." },
            { "activity_type", "Account Login / Verification" },
            { "activity_time", "2026-05-23T21:42:00Z" },
            { "ip_address", "192.168.1.155" },
            { "user_agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0" },
            { "action_link", "https://cverify.ai/lock-account?token=security_alert_123_abc" },
            { "greeting_text", "Hi Luc Security Alert," }
        };

        // Act
        var html = await _templateService.RenderTemplateAsync("SecurityAlertEmail.html", model).ConfigureAwait(false);

        // Assert
        await Verifier.Verify(html, "html").ConfigureAwait(false);
    }

    [Fact]
    public async Task CompanyVerificationEmailTemplate_SnapshotTest()
    {
        // Arrange
        var model = new Dictionary<string, object>
        {
            { "full_name", "Luc Company Recruiter" },
            { "company_name", "DevTech Systems" },
            { "verification_link", "https://cverify.ai/company/verify?token=company_verify_123_abc" },
            { "greeting_text", "Hi Luc Company Recruiter," }
        };

        // Act
        var html = await _templateService.RenderTemplateAsync("CompanyVerificationEmail.html", model).ConfigureAwait(false);

        // Assert
        await Verifier.Verify(html, "html").ConfigureAwait(false);
    }

    [Fact]
    public async Task WorkspaceOnboardingEmailTemplate_SnapshotTest()
    {
        // Arrange
        var model = new Dictionary<string, object>
        {
            { "full_name", "Luc Recruiter Admin" },
            { "company_name", "DevTech Systems" },
            { "workspace_id", "devtech-systems-workspace" },
            { "workspace_url", "https://devtech.cverify.ai" },
            { "greeting_text", "Hi Luc Recruiter Admin," }
        };

        // Act
        var html = await _templateService.RenderTemplateAsync("WorkspaceOnboardingEmail.html", model).ConfigureAwait(false);

        // Assert
        await Verifier.Verify(html, "html").ConfigureAwait(false);
    }
}
