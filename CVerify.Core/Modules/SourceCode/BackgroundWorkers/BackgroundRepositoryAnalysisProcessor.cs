using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.SourceCode.Services;

namespace CVerify.API.Modules.SourceCode.BackgroundWorkers;

public class BackgroundRepositoryAnalysisProcessor : BackgroundService
{
    private readonly IRepositoryAnalysisQueue _queue;
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<BackgroundRepositoryAnalysisProcessor> _logger;

    public BackgroundRepositoryAnalysisProcessor(
        IRepositoryAnalysisQueue queue,
        IServiceProvider serviceProvider,
        ILogger<BackgroundRepositoryAnalysisProcessor> logger)
    {
        _queue = queue;
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Background Repository Analysis Processor started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var jobId = await _queue.DequeueJobAsync();
                if (jobId == null)
                {
                    // Delay to prevent CPU spinning when queue is empty
                    await Task.Delay(1000, stoppingToken);
                    continue;
                }

                _logger.LogInformation("Background processor picked up analysis job {JobId}.", jobId);

                using var scope = _serviceProvider.CreateScope();
                var analysisService = scope.ServiceProvider.GetRequiredService<IRepositoryAnalysisService>();

                try
                {
                    await analysisService.ExecuteAnalysisJobAsync(jobId.Value, stoppingToken);
                    _logger.LogInformation("Successfully processed analysis job {JobId}.", jobId);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to execute repository analysis job {JobId}.", jobId);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                _logger.LogInformation("Background repository analysis processor loop cancelled.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An unhandled exception occurred in the Background Repository Analysis Processor loop.");
                await Task.Delay(2000, stoppingToken);
            }
        }

        _logger.LogInformation("Background Repository Analysis Processor loop exited.");
    }
}
