using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Intelligence.Services;

namespace CVerify.API.Modules.Shared.System.Services;

public interface IRecommendationProvider
{
    Task<List<JobVacancy>> GetRecommendedJobsAsync(Guid userId, int limit, CancellationToken cancellationToken);
}

public class DefaultRecommendationProvider : IRecommendationProvider
{
    private readonly ApplicationDbContext _context;
    private readonly IExplainableMatchService _matchService;
    private readonly IJobRankingStrategy _rankingStrategy;

    public DefaultRecommendationProvider(
        ApplicationDbContext context,
        IExplainableMatchService matchService,
        IJobRankingStrategy rankingStrategy)
    {
        _context = context;
        _matchService = matchService;
        _rankingStrategy = rankingStrategy;
    }

    public async Task<List<JobVacancy>> GetRecommendedJobsAsync(Guid userId, int limit, CancellationToken cancellationToken)
    {
        var candidateProfile = await _context.CandidateSearchProfiles
            .FirstOrDefaultAsync(p => p.CandidateId == userId, cancellationToken);

        if (candidateProfile == null)
        {
            // Fallback: return latest published jobs
            return await _context.JobVacancies
                .Include(j => j.Organization)
                .Where(j => j.Status == "Published" && j.IsActive)
                .OrderByDescending(j => j.CreatedAt)
                .Take(limit)
                .ToListAsync(cancellationToken);
        }

        // Fetch up to 50 active published jobs to run recommendation matching
        var activeJobs = await _context.JobVacancies
            .Include(j => j.Organization)
            .Where(j => j.Status == "Published" && j.IsActive)
            .OrderByDescending(j => j.CreatedAt)
            .Take(50)
            .ToListAsync(cancellationToken);

        var scoredJobs = new List<(JobVacancy Job, double RankScore)>();

        foreach (var job in activeJobs)
        {
            try
            {
                var evaluation = await _matchService.EvaluateMatchAsync(job.Id, userId);
                double rank = _rankingStrategy.CalculateRank(job, candidateProfile, evaluation);
                scoredJobs.Add((job, rank));
            }
            catch
            {
                // Skip if match evaluation errors out
            }
        }

        return scoredJobs
            .OrderByDescending(x => x.RankScore)
            .Select(x => x.Job)
            .Take(limit)
            .ToList();
    }
}
