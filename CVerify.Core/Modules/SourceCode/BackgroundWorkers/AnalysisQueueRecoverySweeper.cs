using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.SourceCode.Entities;

namespace CVerify.API.Modules.SourceCode.BackgroundWorkers;

public class AnalysisQueueRecoverySweeper : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<AnalysisQueueRecoverySweeper> _logger;
    private readonly TimeProvider _timeProvider;

    public AnalysisQueueRecoverySweeper(
        IServiceProvider serviceProvider,
        ILogger<AnalysisQueueRecoverySweeper> logger,
        TimeProvider timeProvider)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _timeProvider = timeProvider;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Analysis Queue Recovery Sweeper started. Sweeping database for stuck jobs...");

        try
        {
            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var activeStates = new[] { "Queued", "Preparing", "CloningRepository", "DetectingTechnologyStack", "SamplingCode", "RunningAgents", "AggregatingResults", "SavingReport" };
            
            var stuckJobs = await context.AnalysisJobs
                .Where(j => activeStates.Contains(j.Status))
                .ToListAsync(stoppingToken);

            if (stuckJobs.Any())
            {
                _logger.LogInformation("Found {Count} stuck repository analysis jobs. Marking them as Failed due to server restart.", stuckJobs.Count);

                foreach (var job in stuckJobs)
                {
                    job.Status = "Failed";
                    job.ErrorMessage = "Job interrupted by server reboot or restart.";
                    job.CompletedAt = _timeProvider.GetUtcNow();
                    job.LastUpdatedUtc = _timeProvider.GetUtcNow();

                    var ev = new AnalysisJobEvent
                    {
                        Id = Guid.CreateVersion7(),
                        JobId = job.Id,
                        Step = "Failed",
                        Progress = job.Progress,
                        Message = "Job interrupted by server reboot or restart.",
                        CreatedAtUtc = _timeProvider.GetUtcNow()
                    };
                    context.AnalysisJobEvents.Add(ev);
                }

                await context.SaveChangesAsync(stoppingToken);
                _logger.LogInformation("Successfully swept and updated stuck analysis jobs.");
            }
            else
            {
                _logger.LogInformation("No stuck repository analysis jobs found.");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An error occurred while running the Analysis Queue Recovery Sweeper.");
        }
    }
}
