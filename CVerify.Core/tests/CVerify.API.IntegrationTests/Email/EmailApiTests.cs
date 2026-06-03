using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using FluentAssertions;
using Xunit;
using CVerify.API.IntegrationTests.Fixtures;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Email.Services;

namespace CVerify.API.IntegrationTests.Email;

/// <summary>
/// Verifies end-to-end HTTP API request deliveries, background processing queues, and real Redis-backed idempotency.
/// </summary>
public class EmailApiTests : BaseIntegrationTest
{
    /// <summary>
    /// Initializes a new instance of the <see cref="EmailApiTests"/> class.
    /// </summary>
    public EmailApiTests(SharedTestcontainerFixture containerFixture) : base(containerFixture)
    {
    }

    [Fact]
    public async Task SendVerification_ShouldEnqueueEmailAndReturnSuccess()
    {
        // Arrange
        var request = new
        {
            email = "integration-user@example.com",
            fullName = "Luc Integration User",
            verificationLink = "https://cverify.ai/verify?token=api_integration_test_123"
        };

        // Act
        var response = await Client.PostAsJsonAsync("/api/emailtest/send-verification", request).ConfigureAwait(false);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Yield processor slice for background queue draining
        await Task.Delay(200).ConfigureAwait(false);

        // Verify captured dispatch
        EmailSender.SentMessages.Should().ContainSingle();
        var sent = EmailSender.SentMessages.First();
        
        sent.ToEmail.Should().Be(request.email);
        sent.ToName.Should().Be(request.fullName);
        sent.CorrelationId.Should().NotBeNullOrWhiteSpace();
        sent.HtmlContent.Should().Contain("Confirm Email Address")
            .And.Contain(request.verificationLink);
    }

    [Fact]
    public async Task SendVerification_ShouldTriggerIdempotencyAndBlockDuplicateRequests()
    {
        // Arrange
        var request = new
        {
            email = "idempotency@example.com",
            fullName = "Idempotent User",
            verificationLink = "https://cverify.ai/verify?token=idempotency_token_abc"
        };

        // Act
        // 1st request should succeed and send email
        var response1 = await Client.PostAsJsonAsync("/api/emailtest/send-verification", request).ConfigureAwait(false);
        response1.StatusCode.Should().Be(HttpStatusCode.OK);

        // 2nd duplicate request immediately should get blocked silently
        var response2 = await Client.PostAsJsonAsync("/api/emailtest/send-verification", request).ConfigureAwait(false);
        response2.StatusCode.Should().Be(HttpStatusCode.OK);

        // Yield processor slice
        await Task.Delay(200).ConfigureAwait(false);

        // Assert - Only ONE message is sent because Redis locked out the duplicate
        EmailSender.SentMessages.Should().ContainSingle();
    }

    [Fact]
    public async Task SendReset_ShouldEnqueueEmailAndReturnSuccess()
    {
        // Arrange
        var request = new
        {
            email = "reset-user@example.com",
            fullName = "Reset User",
            resetLink = "https://cverify.ai/reset?token=api_integration_reset_abc"
        };

        // Act
        var response = await Client.PostAsJsonAsync("/api/emailtest/send-reset", request).ConfigureAwait(false);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        await Task.Delay(200).ConfigureAwait(false);

        EmailSender.SentMessages.Should().ContainSingle();
        var sent = EmailSender.SentMessages.First();
        
        sent.ToEmail.Should().Be(request.email);
        sent.HtmlContent.Should().Contain("Reset Password")
            .And.Contain(request.resetLink);
    }

    [Fact]
    public async Task OutboxPipeline_Should_DeliverToCorrectRecipient()
    {
        // Setup - Clear diagnostics
        StructuredEmailAuditLogger.ClearDiagnosticTraces();

        // Seed default roles required for registration
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<CVerify.API.Modules.Shared.Persistence.ApplicationDbContext>();
            var userRole = await db.Roles.FirstOrDefaultAsync(r => r.Name == "USER");
            if (userRole == null)
            {
                db.Roles.Add(new CVerify.API.Modules.Shared.Domain.Entities.Role
                {
                    Name = "USER",
                    DisplayName = "General User",
                    Description = "Basic application access",
                    IsSystem = true,
                    IsActive = true
                });
                await db.SaveChangesAsync();
            }
        }

        // 1. Trigger register flow that writes to outbox
        var registerRequest = new CVerify.API.Modules.Auth.DTOs.RegisterRequest(
            Email: "audit-pipeline@cverify.ai",
            Password: "SecurePassword123!",
            ConfirmPassword: "SecurePassword123!",
            FullName: "Kaivian Dev"
        );

        var registerResponse = await Client.PostAsJsonAsync("/api/auth/register", registerRequest).ConfigureAwait(false);
        registerResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // 2. Resolve background processor and run pending messages
        using (var scope = Factory.Services.CreateScope())
        {
            var processor = new CVerify.API.Modules.Shared.Email.BackgroundWorkers.EmailOutboxBackgroundProcessor(
                Factory.Services,
                scope.ServiceProvider.GetRequiredService<Microsoft.Extensions.Logging.ILogger<CVerify.API.Modules.Shared.Email.BackgroundWorkers.EmailOutboxBackgroundProcessor>>(),
                scope.ServiceProvider.GetRequiredService<TimeProvider>()
            );

            await processor.ProcessPendingMessagesAsync(default).ConfigureAwait(false);
        }

        // 3. Extract diagnostics
        var traces = StructuredEmailAuditLogger.GetDiagnosticTraces().ToList();

        // Find all traces starting with "DELIVERY_AUDIT:"
        var auditTraces = traces
            .Where(t => t.Contains("DELIVERY_AUDIT:"))
            .Select(t => {
                var clean = t.Substring(t.IndexOf("DELIVERY_AUDIT:"));
                var parts = clean.Split('|').Select(p => p.Trim()).ToList();
                var dict = new Dictionary<string, string>();
                foreach (var part in parts)
                {
                    if (part.StartsWith("DELIVERY_AUDIT:"))
                    {
                        var kv = part.Replace("DELIVERY_AUDIT:", "").Trim().Split('=');
                        dict[kv[0]] = kv[1];
                    }
                    else
                    {
                        var kv = part.Split('=');
                        if (kv.Length == 2)
                        {
                            dict[kv[0]] = kv[1];
                        }
                    }
                }
                return dict;
            })
            .ToList();

        // Assert 4 stages are logged
        auditTraces.Should().HaveCount(4);

        var serialization = auditTraces.Single(t => t["Stage"] == "Serialization");
        var backgroundProcessor = auditTraces.Single(t => t["Stage"] == "BackgroundProcessor");
        var emailService = auditTraces.Single(t => t["Stage"] == "EmailService");
        var smtpSender = auditTraces.Single(t => t["Stage"] == "SmtpSender");

        // Verify identical recipient email across all stages
        serialization["Recipient"].Should().Be("audit-pipeline@cverify.ai");
        backgroundProcessor["Recipient"].Should().Be("audit-pipeline@cverify.ai");
        emailService["Recipient"].Should().Be("audit-pipeline@cverify.ai");
        smtpSender["Recipient"].Should().Be("audit-pipeline@cverify.ai");

        // Verify identical correlation ID across all stages
        var correlationId = serialization["CorrelationId"];
        correlationId.Should().NotBeNullOrWhiteSpace();
        backgroundProcessor["CorrelationId"].Should().Be(correlationId);
        emailService["CorrelationId"].Should().Be(correlationId);
        smtpSender["CorrelationId"].Should().Be(correlationId);

        // Verify identical outbox ID across Serialization and BackgroundProcessor and EmailService
        var outboxId = serialization["OutboxId"];
        outboxId.Should().NotBeNullOrWhiteSpace();
        backgroundProcessor["OutboxId"].Should().Be(outboxId);
        emailService["OutboxId"].Should().Be(outboxId);

        // 4. Verify intercepted email content and that placeholders are not leaked
        EmailSender.SentMessages.Should().ContainSingle();
        var sentEmail = EmailSender.SentMessages.Single();
        sentEmail.ToEmail.Should().Be("audit-pipeline@cverify.ai");
        
        // HtmlContent must render greeting text with Kaivian Dev and NOT contain "Candidate User" or other placeholders
        sentEmail.HtmlContent.Should().Contain("Hi Kaivian Dev,")
            .And.NotContain("Candidate User")
            .And.NotContain("John Doe");
    }
}
