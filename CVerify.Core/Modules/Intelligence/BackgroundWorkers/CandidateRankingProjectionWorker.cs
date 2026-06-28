using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System.Linq;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Shared.Persistence;
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

        // 2. Perform one-time backfill of historical candidate capability data
        try
        {
            _logger.LogInformation("Running historical candidate capability data backfill... Action: Backfill");
            using var backfillScope = _serviceProvider.CreateScope();
            var backfillContext = backfillScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var evaluationService = backfillScope.ServiceProvider.GetRequiredService<ICandidateEvaluationService>();
            
            // Find all active non-deleted candidates who have a completed assessment but 0 candidate capability records
            var candidatesToBackfill = await backfillContext.UserProfiles
                .Where(up => up.DeletedAt == null && up.User.DeletedAt == null)
                .Where(up => backfillContext.CandidateAssessments.Any(ca => ca.UserId == up.UserId && ca.Status == "Completed"))
                .Where(up => !backfillContext.CandidateCapabilities.Any(cc => cc.CandidateId == up.UserId))
                .Select(up => up.UserId)
                .ToListAsync(stoppingToken)
                .ConfigureAwait(false);

            _logger.LogInformation("Found {Count} candidates requiring capability backfill. Action: Backfill", candidatesToBackfill.Count);

            int backfillSuccessCount = 0;
            int backfillFailureCount = 0;
            var stopwatch = System.Diagnostics.Stopwatch.StartNew();

            foreach (var candidateId in candidatesToBackfill)
            {
                if (stoppingToken.IsCancellationRequested) break;

                try
                {
                    _logger.LogInformation("Backfilling capability data for candidate {CandidateId}... Action: Backfill", candidateId);
                    await evaluationService.EvaluateAndSnapshotCandidateAsync(candidateId, stoppingToken).ConfigureAwait(false);
                    backfillSuccessCount++;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to backfill capability data for candidate {CandidateId}. Action: Backfill", candidateId);
                    backfillFailureCount++;
                }
            }
            stopwatch.Stop();
            _logger.LogInformation("Historical capability data backfill completed in {DurationMs}ms. Action: Backfill, TotalProcessed: {Total}, Success: {Success}, Failure: {Failure}",
                stopwatch.ElapsedMilliseconds, candidatesToBackfill.Count, backfillSuccessCount, backfillFailureCount);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred during historical capability data backfill. Action: Backfill");
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
