using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Profiles.Entities;
using CVerify.API.Modules.Profiles.Services;
using CVerify.API.Modules.SourceCode.Entities;

namespace CVerify.API.Modules.Profiles.BackgroundWorkers;

public class BackgroundCandidateAssessmentBackfillProcessor : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<BackgroundCandidateAssessmentBackfillProcessor> _logger;

    public BackgroundCandidateAssessmentBackfillProcessor(
        IServiceProvider serviceProvider,
        ILogger<BackgroundCandidateAssessmentBackfillProcessor> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Background Candidate Assessment Backfill Processor started.");

        // Wait a small delay to ensure startup has completed
        await Task.Delay(5000, stoppingToken);

        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var queue = scope.ServiceProvider.GetRequiredService<ICandidateAssessmentQueue>();

        try
        {
            var assessmentsToBackfill = await context.CandidateAssessments
                .Where(ca => ca.Status == "Completed")
                .Where(ca => !context.CandidateSkills.Any(cs => cs.CandidateAssessmentId == ca.Id))
                .ToListAsync(stoppingToken);

            if (assessmentsToBackfill.Count == 0)
            {
                _logger.LogInformation("No historical candidate assessments need backfilling.");
                return;
            }

            _logger.LogInformation("Found {Count} historical candidate assessments to backfill.", assessmentsToBackfill.Count);

            foreach (var ca in assessmentsToBackfill)
            {
                try
                {
                    var redis = scope.ServiceProvider.GetRequiredService<IConnectionMultiplexer>();
                    var db = redis.GetDatabase();
                    var lockKey = $"candidate:assessment:lock:{ca.UserId}";
                    var lockToken = Guid.NewGuid().ToString();

                    bool acquiredLock = await db.LockTakeAsync(lockKey, lockToken, TimeSpan.FromMinutes(10));
                    if (!acquiredLock)
                    {
                        _logger.LogWarning("Backfill Processor: Could not acquire lock for user {UserId}. Skipping for now.", ca.UserId);
                        continue;
                    }

                    try
                    {
                        _logger.LogInformation("Backfilling candidate assessment {AssessmentId} for user {UserId}...", ca.Id, ca.UserId);

                        var completedJobs = await context.AnalysisJobs
                            .Include(j => j.Repository)
                            .Where(j => j.UserId == ca.UserId && j.Status == "Completed")
                            .ToListAsync(stoppingToken);

                        var repos = completedJobs.Select(j => j.Repository)
                            .Where(r => r.IsEnabled)
                            .GroupBy(r => r.Id)
                            .Select(g => g.First())
                            .ToList();
                        var repoIds = repos.Select(r => r.Id).ToList();
                        var jobIds = completedJobs.Select(j => j.Id).ToList();

                        var repoAssessments = await context.RepositoryAssessments
                            .Where(ra => jobIds.Contains(ra.AnalysisJobId) && ra.Status == "Completed")
                            .ToListAsync(stoppingToken);

                        var repoAssessmentIds = repoAssessments.Select(ra => ra.Id).ToList();

                        bool allReposHaveAssets = true;
                        if (repoAssessments.Count == 0)
                        {
                            allReposHaveAssets = false;
                        }
                        else
                        {
                            foreach (var ra in repoAssessments)
                            {
                                var hasCaps = await context.RepositoryCapabilities.AnyAsync(c => c.RepositoryAssessmentId == ra.Id, stoppingToken);
                                var hasSkills = await context.RepositorySkillAttributions.AnyAsync(s => s.RepositoryAssessmentId == ra.Id, stoppingToken);
                                var hasDomains = await context.RepositoryDomains.AnyAsync(d => d.RepositoryAssessmentId == ra.Id, stoppingToken);
                                var hasSignal = await context.RepositoryIntelligenceSignals.AnyAsync(s => s.RepositoryAssessmentId == ra.Id, stoppingToken);

                                if (!hasCaps || !hasSkills || !hasDomains || !hasSignal)
                                {
                                    allReposHaveAssets = false;
                                    break;
                                }
                            }
                        }

                        if (!allReposHaveAssets)
                        {
                            _logger.LogInformation("Assessment {AssessmentId} lacks Pipeline 1 relational assets in repository assessments. Queueing for automated reassessment.", ca.Id);
                            
                            var maxVersion = await context.CandidateAssessments
                                .Where(x => x.UserId == ca.UserId)
                                .MaxAsync(x => (int?)x.Version, stoppingToken) ?? 0;

                            ca.Status = "Queued";
                            ca.Version = maxVersion + 1;
                            await context.SaveChangesAsync(stoppingToken);
                            
                            await queue.EnqueueAssessmentAsync(ca.Id);
                            continue;
                        }

                        var assessmentService = scope.ServiceProvider.GetRequiredService<ICandidateAssessmentService>();
                        await assessmentService.ReprocessAssessmentAsync(ca.Id, stoppingToken);

                        _logger.LogInformation("Successfully backfilled candidate assessment {AssessmentId}.", ca.Id);
                    }
                    finally
                    {
                        await db.LockReleaseAsync(lockKey, lockToken);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error backfilling candidate assessment {AssessmentId}.", ca.Id);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An unhandled exception occurred in the Backfill Processor.");
        }

        _logger.LogInformation("Background Candidate Assessment Backfill Processor completed.");
    }
}
