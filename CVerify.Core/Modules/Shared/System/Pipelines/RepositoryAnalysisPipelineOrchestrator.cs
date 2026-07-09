using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.SourceCode.Services;

namespace CVerify.API.Modules.Shared.System.Pipelines;

public class RepositoryAnalysisPipelineOrchestrator : IPipelineOrchestrator
{
    private readonly IRepositoryAnalysisService _analysisService;
    private readonly ApplicationDbContext _context;

    public RepositoryAnalysisPipelineOrchestrator(
        IRepositoryAnalysisService analysisService,
        ApplicationDbContext context)
    {
        _analysisService = analysisService;
        _context = context;
    }

    public string PipelineType => "repository-analysis";

    public async Task<bool> CancelAsync(Guid executionId, CancellationToken cancellationToken = default)
    {
        var job = await _context.AnalysisJobs.FirstOrDefaultAsync(j => j.Id == executionId, cancellationToken);
        if (job == null) return false;

        return await _analysisService.CancelJobAsync(job.UserId, executionId);
    }

    public async Task<bool> RetryAsync(Guid executionId, Guid? taskId = null, CancellationToken cancellationToken = default)
    {
        var job = await _context.AnalysisJobs.FirstOrDefaultAsync(j => j.Id == executionId, cancellationToken);
        if (job == null) return false;

        if (taskId.HasValue)
        {
            return await _analysisService.RetryTaskAsync(job.UserId, executionId, taskId.Value);
        }

        // Re-run/re-enqueue entire job
        await _analysisService.EnqueueAnalysisJobAsync(job.UserId, job.RepositoryId);
        return true;
    }

    public async Task<bool> PauseAsync(Guid executionId, CancellationToken cancellationToken = default)
    {
        var job = await _context.AnalysisJobs.FirstOrDefaultAsync(j => j.Id == executionId, cancellationToken);
        if (job == null) return false;

        job.Status = "Paused";
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> ResumeAsync(Guid executionId, CancellationToken cancellationToken = default)
    {
        var job = await _context.AnalysisJobs.FirstOrDefaultAsync(j => j.Id == executionId, cancellationToken);
        if (job == null) return false;

        job.Status = "Running";
        await _context.SaveChangesAsync(cancellationToken);

        // Re-trigger scheduling
        var scheduler = _context.Database.BeginTransactionAsync(); // Not needed if sweeper picks up
        return true;
    }
}
