using System;
using System.Net.Sockets;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using CVerify.API.Infrastructure.Configuration;

namespace CVerify.API.Infrastructure.Diagnostics;

/// <summary>
/// Exposes real-time connectivity state checks for active SMTP and SendGrid gateways to the ASP.NET Core Health Checks middleware.
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
            // If SMTP or Failover mode is active, check SMTP socket reachability
            if (_settings.Provider == EmailProvider.Smtp || _settings.Provider == EmailProvider.Failover)
            {
                using var tcpClient = new TcpClient();
                
                // Set a strict 5-second socket connection timeout
                var connectTask = tcpClient.ConnectAsync(_settings.Smtp.Host, _settings.Smtp.Port, cancellationToken);
                await connectTask.AsTask().WaitAsync(TimeSpan.FromSeconds(5), cancellationToken).ConfigureAwait(false);

                if (!tcpClient.Connected)
                {
                    return HealthCheckResult.Unhealthy($"SMTP transport is unreachable. Failed to open TCP socket connection to {_settings.Smtp.Host}:{_settings.Smtp.Port}");
                }
            }

            // If SendGrid or Failover mode is active, check DNS resolution of the SendGrid API endpoint
            if (_settings.Provider == EmailProvider.SendGrid || _settings.Provider == EmailProvider.Failover)
            {
                var ips = await System.Net.Dns.GetHostAddressesAsync("api.sendgrid.com", cancellationToken).ConfigureAwait(false);
                if (ips.Length == 0)
                {
                    return HealthCheckResult.Unhealthy("SendGrid transport is unhealthy. DNS resolution for 'api.sendgrid.com' failed.");
                }
            }

            return HealthCheckResult.Healthy($"Email infrastructure operational. Primary provider: {_settings.Provider}");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("Email infrastructure health check threw an exception.", ex);
        }
    }
}
