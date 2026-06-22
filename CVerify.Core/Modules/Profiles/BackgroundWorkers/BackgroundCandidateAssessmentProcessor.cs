using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.Profiles.Services;

namespace CVerify.API.Modules.Profiles.BackgroundWorkers;

public class BackgroundCandidateAssessmentProcessor : BackgroundService
{
    private readonly ICandidateAssessmentQueue _queue;
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<BackgroundCandidateAssessmentProcessor> _logger;

    public BackgroundCandidateAssessmentProcessor(
        ICandidateAssessmentQueue queue,
        IServiceProvider serviceProvider,
        ILogger<BackgroundCandidateAssessmentProcessor> logger)
    {
        _queue = queue;
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Background Candidate Assessment Processor started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var assessmentId = await _queue.DequeueAssessmentAsync();
                if (assessmentId == null)
                {
                    // Delay to prevent CPU spinning when queue is empty
                    await Task.Delay(1000, stoppingToken);
                    continue;
                }

                _logger.LogInformation("Background processor picked up candidate assessment job {AssessmentId}.", assessmentId);

                using var scope = _serviceProvider.CreateScope();
                var assessmentService = scope.ServiceProvider.GetRequiredService<ICandidateAssessmentService>();

                try
                {
                    await assessmentService.ProcessAssessmentJobAsync(assessmentId.Value, stoppingToken);
                    _logger.LogInformation("Successfully processed candidate assessment job {AssessmentId}.", assessmentId);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to process candidate assessment job {AssessmentId}.", assessmentId);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                _logger.LogInformation("Background candidate assessment processor loop cancelled.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An unhandled exception occurred in the Background Candidate Assessment Processor loop.");
                await Task.Delay(2000, stoppingToken);
            }
        }

        _logger.LogInformation("Background Candidate Assessment Processor loop exited.");
    }
}
