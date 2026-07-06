using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.Modules.Shared.System.Pipelines;

public class HiringRequirementPipelineOrchestrator : IPipelineOrchestrator
{
    private readonly IHiringRequirementService _hiringService;
    private readonly ApplicationDbContext _context;

    public HiringRequirementPipelineOrchestrator(
        IHiringRequirementService hiringService,
        ApplicationDbContext context)
    {
        _hiringService = hiringService;
        _context = context;
    }

    public string PipelineType => "jd-generation";

    public async Task<bool> CancelAsync(Guid executionId, CancellationToken cancellationToken = default)
    {
        // Cancel all artifacts or specific ones
        await _hiringService.CancelGenerationAsync(executionId, "all");
        return true;
    }

    public async Task<bool> RetryAsync(Guid executionId, Guid? taskId = null, CancellationToken cancellationToken = default)
    {
        var session = await _context.AiStreamingSessions.FirstOrDefaultAsync(s => s.Id == executionId, cancellationToken);
        var userId = session?.UserId ?? Guid.Empty;

        // Re-generate artifacts
        await _hiringService.GenerateArtifactsAsync(executionId, userId, cancellationToken);
        return true;
    }

    public async Task<bool> PauseAsync(Guid executionId, CancellationToken cancellationToken = default)
    {
        // Pause generation
        var session = await _context.AiStreamingSessions.FirstOrDefaultAsync(s => s.Id == executionId, cancellationToken);
        if (session == null) return false;
        session.Status = "Paused";
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> ResumeAsync(Guid executionId, CancellationToken cancellationToken = default)
    {
        var session = await _context.AiStreamingSessions.FirstOrDefaultAsync(s => s.Id == executionId, cancellationToken);
        if (session == null) return false;
        session.Status = "Running";
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}
