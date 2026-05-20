using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.Modules.SourceCode.Services;

public class CandidateRepositoryProvider : ICandidateRepositoryProvider
{
    private readonly ApplicationDbContext _context;

    public CandidateRepositoryProvider(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<DateTimeOffset> GetLastRepositoryAnalysisAtAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var lastRepoAnalysisAt = await _context.SourceCodeRepositories
            .Where(r => r.AuthProvider.UserId == userId && r.IsEnabled && r.LatestAnalysisStatus == "Completed" && r.IsAccessible)
            .MaxAsync(r => (DateTimeOffset?)r.LatestAnalysisCompletedAtUtc, cancellationToken);

        return lastRepoAnalysisAt ?? DateTimeOffset.MinValue;
    }

    public async Task<bool> HasCompletedRepositoriesAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _context.SourceCodeRepositories
            .AnyAsync(r => r.AuthProvider.UserId == userId && r.IsEnabled && r.LatestAnalysisStatus == "Completed" && r.IsAccessible, cancellationToken);
    }

    public async Task<List<string>> GetCompletedAnalysisJobIdsAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var repos = await _context.SourceCodeRepositories
            .Where(r => r.AuthProvider.UserId == userId && r.IsEnabled && r.LatestAnalysisStatus == "Completed" && r.IsAccessible)
            .ToListAsync(cancellationToken);

        var jobIds = new List<string>();
        foreach (var repo in repos)
        {
            var job = await _context.AnalysisJobs
                .Where(j => j.RepositoryId == repo.Id && j.Status == "Completed")
                .OrderByDescending(j => j.CompletedAt)
                .FirstOrDefaultAsync(cancellationToken);

            if (job != null)
            {
                jobIds.Add(job.Id.ToString());
            }
        }

        return jobIds;
    }
}
