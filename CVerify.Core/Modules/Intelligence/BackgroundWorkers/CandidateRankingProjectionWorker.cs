using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.Intelligence.Services;

namespace CVerify.API.Modules.Intelligence.BackgroundWorkers;

public class CandidateRankingProjectionWorker : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<CandidateRankingProjectionWorker> _logger;

    public CandidateRankingProjectionWorker(
        IServiceProvider serviceProvider,
        ILogger<CandidateRankingProjectionWorker> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Candidate Ranking Projection Worker starting execution.");

        // 1. Initial delay of 10 seconds to allow the system to fully boot
        try
        {
            await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken).ConfigureAwait(false);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                _logger.LogInformation("Triggering scheduled candidate ranking projections rebuild...");
                using var scope = _serviceProvider.CreateScope();
                var projectionService = scope.ServiceProvider.GetRequiredService<ICandidateRankingProjectionService>();
                
                await projectionService.RebuildRankingProjectionsAsync(stoppingToken).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred during candidate ranking projections rebuild background task.");
            }

            // 2. Wait 15 minutes before the next calculation cycle
            try
            {
                await Task.Delay(TimeSpan.FromMinutes(15), stoppingToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }

        _logger.LogInformation("Candidate Ranking Projection Worker stopping execution.");
    }
}
