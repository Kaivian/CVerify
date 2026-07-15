
using System;
using System.Net.Sockets;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using CVerify.API.Modules.Shared.Configuration;

namespace CVerify.API.Modules.Shared.Diagnostics;

/// <summary>
/// Exposes real-time connectivity state checks for the SMTP gateway to the ASP.NET Core Health Checks middleware.
/// </summary>
public class EmailProviderHealthCheck : IHealthCheck
{
    private readonly EmailSettings _settings;

    /// <summary>
    /// Initializes a new instance of the <see cref="EmailProviderHealthCheck"/> class.
    /// </summary>
    public EmailProviderHealthCheck(IOptions<EmailSettings> settings)
    {
        _settings = settings.Value;
    }

    /// <inheritdoc />
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            using var tcpClient = new TcpClient();

            // Set a strict 5-second socket connection timeout
            var connectTask = tcpClient.ConnectAsync(_settings.Smtp.Host, _settings.Smtp.Port, cancellationToken);
            await connectTask.AsTask().WaitAsync(TimeSpan.FromSeconds(5), cancellationToken).ConfigureAwait(false);

            if (!tcpClient.Connected)
            {
                return HealthCheckResult.Unhealthy($"SMTP transport is unreachable. Failed to open TCP socket connection to {_settings.Smtp.Host}:{_settings.Smtp.Port}");
            }

            return HealthCheckResult.Healthy("Email infrastructure operational via SMTP.");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("Email infrastructure health check threw an exception.", ex);
        }
    }
}
