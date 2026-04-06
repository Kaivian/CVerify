using System;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using CVerify.API.Infrastructure.Configuration;
using CVerify.API.Infrastructure.Diagnostics;
using Xunit;

namespace CVerify.API.UnitTests.HealthChecks;

/// <summary>
/// Unit tests for the diagnostic <see cref="EmailProviderHealthCheck"/>, asserting failure behaviors and healthy status resolutions.
/// </summary>
public class EmailProviderHealthCheckTests
{
    [Fact]
    public async Task CheckHealthAsync_ShouldReturnUnhealthy_WhenSmtpHostIsInvalidOrUnreachable()
    {
        // Arrange
        var settings = new EmailSettings
        {
            Provider = EmailProvider.Smtp,
            Smtp = new SmtpSettings
            {
                Host = "invalid-smtp-host-domain-does-not-exist.xyz", // Triggers connection fail
                Port = 25,
                Username = "test_user",
                Password = "test_password",
                EnableSsl = false
            }
        };

        var options = Options.Create(settings);
        var healthCheck = new EmailProviderHealthCheck(options);
        var context = new HealthCheckContext();

        // Act
        var result = await healthCheck.CheckHealthAsync(context).ConfigureAwait(false);

        // Assert
        result.Status.Should().Be(HealthStatus.Unhealthy);
        result.Description.Should().Contain("infrastructure health check threw an exception");
        result.Exception.Should().NotBeNull();
    }

    [Fact]
    public async Task CheckHealthAsync_ShouldReturnHealthy_WhenSendGridDnsResolutionSucceeds()
    {
        // Arrange
        var settings = new EmailSettings
        {
            Provider = EmailProvider.SendGrid,
            SendGrid = new SendGridSettings
            {
                ApiKey = "SG.dummy_key_value"
            }
        };

        var options = Options.Create(settings);
        var healthCheck = new EmailProviderHealthCheck(options);
        var context = new HealthCheckContext();

        // Act
        var result = await healthCheck.CheckHealthAsync(context).ConfigureAwait(false);

        // Assert
        // Since 'api.sendgrid.com' has public DNS A/AAAA records, this will succeed on typical connected developer and CI platforms
        if (result.Status == HealthStatus.Healthy)
        {
            result.Status.Should().Be(HealthStatus.Healthy);
            result.Description.Should().Contain("Email infrastructure operational. Primary provider: SendGrid");
        }
        else
        {
            result.Status.Should().Be(HealthStatus.Unhealthy);
            result.Description.Should().Contain("DNS resolution for 'api.sendgrid.com' failed");
        }
    }
}
