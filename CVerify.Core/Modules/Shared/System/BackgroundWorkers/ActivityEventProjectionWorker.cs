using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.Shared.Domain.Services;
using CVerify.API.Modules.Shared.Persistence;

namespace CVerify.API.Modules.Shared.System.BackgroundWorkers;

public class ActivityEventProjectionWorker : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<ActivityEventProjectionWorker> _logger;

    public ActivityEventProjectionWorker(
        IServiceProvider serviceProvider,
        ILogger<ActivityEventProjectionWorker> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessPendingEventsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing pending activity events in background worker.");
            }

            await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
        }
    }

    private async Task ProcessPendingEventsAsync(CancellationToken stoppingToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var deliveryService = scope.ServiceProvider.GetRequiredService<INotificationDeliveryService>();

        var pendingEvents = await context.ActivityEvents
            .Where(ae => !ae.IsProjected)
            .OrderBy(ae => ae.CreatedAt)
            .Take(50)
            .ToListAsync(stoppingToken);

        if (!pendingEvents.Any())
        {
            return;
        }

        _logger.LogInformation("Processing {Count} pending activity events for projection.", pendingEvents.Count);

        foreach (var activityEvent in pendingEvents)
        {
            await deliveryService.RouteAndDeliverAsync(activityEvent);
            activityEvent.IsProjected = true;
        }

        await context.SaveChangesAsync(stoppingToken);
    }
}
