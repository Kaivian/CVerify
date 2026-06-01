using System;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using FluentAssertions;
using Xunit;
using CVerify.API.IntegrationTests.Fixtures;
using CVerify.API.Modules.Shared.Domain.Entities;

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
}
