using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.SourceCode.Services;

namespace CVerify.API.Modules.SourceCode.BackgroundWorkers;

public class BackgroundRepositorySyncProcessor : BackgroundService
{
    private readonly IRepositorySyncQueue _syncQueue;
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<BackgroundRepositorySyncProcessor> _logger;

    public BackgroundRepositorySyncProcessor(
        IRepositorySyncQueue syncQueue,
        IServiceProvider serviceProvider,
        ILogger<BackgroundRepositorySyncProcessor> logger)
    {
        _syncQueue = syncQueue;
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Background Repository Sync Processor started.");

        while (true)
        {
            try
            {
                var hasItem = false;
                if (!stoppingToken.IsCancellationRequested)
                {
                    hasItem = await _syncQueue.WaitToReadAsync(stoppingToken).ConfigureAwait(false);
                }
                else
                {
                    hasItem = await _syncQueue.WaitToReadAsync(CancellationToken.None).ConfigureAwait(false);
                }

                if (!hasItem)
                {
                    break;
                }

                while (_syncQueue.TryDequeue(out var job))
                {
                    _logger.LogInformation("Background sync picked up job {JobId} for User {UserId}.", job.JobId, job.UserId);

                    using var scope = _serviceProvider.CreateScope();
                    var syncService = scope.ServiceProvider.GetRequiredService<ISourceCodeProviderService>();

                    try
                    {
                        await syncService.ExecuteSyncJobAsync(job, CancellationToken.None).ConfigureAwait(false);
                        _logger.LogInformation("Background sync job {JobId} successfully processed.", job.JobId);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Failed to execute sync job {JobId}.", job.JobId);
                    }
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                _logger.LogInformation("Background sync worker loop interrupted via regular cancellation.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An unhandled exception occurred in the Background Repository Sync Processor loop.");
                await Task.Delay(1000, CancellationToken.None).ConfigureAwait(false);
            }
        }

        _logger.LogInformation("Background Repository Sync Processor loop exited.");
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Stopping Background Repository Sync Processor.");
        _syncQueue.CompleteWriter();
        await base.StopAsync(cancellationToken).ConfigureAwait(false);
        _logger.LogInformation("Background Repository Sync Processor stopped successfully.");
    }
}
