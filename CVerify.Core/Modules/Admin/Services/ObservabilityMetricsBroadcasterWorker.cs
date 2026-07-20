using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.Admin.Hubs;

namespace CVerify.API.Modules.Admin.Services;

public class ObservabilityMetricsBroadcasterWorker : BackgroundService
{
    private readonly IObservabilityMetricsCollector _collector;
    private readonly IHubContext<AdminHub> _hubContext;
    private readonly ILogger<ObservabilityMetricsBroadcasterWorker> _logger;

    public ObservabilityMetricsBroadcasterWorker(
        IObservabilityMetricsCollector collector,
        IHubContext<AdminHub> hubContext,
        ILogger<ObservabilityMetricsBroadcasterWorker> logger)
    {
        _collector = collector;
        _hubContext = hubContext;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var metrics = await _collector.CollectMetricsAsync();
                await _hubContext.Clients.Group("admins").SendAsync("ReceiveSystemMetrics", metrics, stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Error broadcasting observability metrics.");
            }

            await Task.Delay(2000, stoppingToken);
        }
    }
}
