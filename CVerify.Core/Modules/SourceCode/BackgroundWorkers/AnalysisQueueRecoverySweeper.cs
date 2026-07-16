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
using CVerify.API.Modules.Profiles.Entities;
using CVerify.API.Modules.Shared.System.Services;

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

            // 1. Sweep stuck candidate assessments
            var activeCandidateStates = new[] { "Queued", "Running" };
            var stuckCandidateAssessments = await context.CandidateAssessments
                .Where(ca => activeCandidateStates.Contains(ca.Status))
                .ToListAsync(stoppingToken);

            if (stuckCandidateAssessments.Any())
            {
                _logger.LogInformation("Found {Count} stuck candidate assessments. Marking them as Failed due to server restart.", stuckCandidateAssessments.Count);
                
                foreach (var ca in stuckCandidateAssessments)
                {
                    ca.Status = "Failed";
                    ca.FailedStage = ca.FailedStage ?? "Initialize";
                    ca.FailureReason = "Job interrupted by server reboot or restart.";
                    ca.CompletedAtUtc = _timeProvider.GetUtcNow();
                    
                    // Fail the transient streaming session and durable pipeline execution if they exist
                    var streamingSessionService = scope.ServiceProvider.GetRequiredService<IAiStreamingSessionService>();
                    try
                    {
                        await streamingSessionService.UpdateSessionStatusAsync(ca.Id, "Failed", "Job interrupted by server reboot or restart.");
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Failed to update streaming session status to Failed for stuck assessment {AssessmentId}", ca.Id);
                    }
                }

                await context.SaveChangesAsync(stoppingToken);
                _logger.LogInformation("Successfully swept and updated stuck candidate assessments.");
            }

            // 2. Sweep stuck repository analysis jobs
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

                // Update the repositories associated with stuck jobs to Failed status
                var repoIds = stuckJobs.Select(j => j.RepositoryId).Distinct().ToList();
                var repos = await context.SourceCodeRepositories
                    .Where(r => repoIds.Contains(r.Id))
                    .ToListAsync(stoppingToken);

                foreach (var repo in repos)
                {
                    repo.LatestAnalysisStatus = "Failed";
                    repo.LastUpdatedUtc = _timeProvider.GetUtcNow();
                }

                await context.SaveChangesAsync(stoppingToken);
                _logger.LogInformation("Successfully swept and updated stuck analysis jobs and repositories.");
            }
            else
            {
                _logger.LogInformation("No stuck repository analysis jobs found.");
            }

            // Sweep and recover any orphaned repositories that are stuck in "Pending" status but have no active job
            var pendingRepos = await context.SourceCodeRepositories
                .Where(r => r.LatestAnalysisStatus == "Pending")
                .ToListAsync(stoppingToken);

            if (pendingRepos.Any())
            {
                bool modified = false;
                foreach (var repo in pendingRepos)
                {
                    var hasActiveJob = await context.AnalysisJobs
                        .AnyAsync(j => j.RepositoryId == repo.Id && activeStates.Contains(j.Status), stoppingToken);

                    if (!hasActiveJob)
                    {
                        _logger.LogInformation("Found orphaned pending repository {RepoName} ({RepoId}). Resetting status to Failed.", repo.Name, repo.Id);
                        repo.LatestAnalysisStatus = "Failed";
                        repo.LastUpdatedUtc = _timeProvider.GetUtcNow();
                        modified = true;
                    }
                }

                if (modified)
                {
                    await context.SaveChangesAsync(stoppingToken);
                    _logger.LogInformation("Successfully swept and fixed orphaned pending repositories.");
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An error occurred while running the Analysis Queue Recovery Sweeper.");
        }
    }
}
