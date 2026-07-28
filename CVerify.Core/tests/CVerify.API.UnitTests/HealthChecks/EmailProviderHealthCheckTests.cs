
using System;
using System.Threading.Tasks;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using FluentAssertions;
using Xunit;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.Diagnostics;

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
        var result = await healthCheck.CheckHealthAsync(context);

        // Assert
        result.Status.Should().Be(HealthStatus.Unhealthy);
        result.Description.Should().Contain("infrastructure health check threw an exception");
        result.Exception.Should().NotBeNull();
    }
}
