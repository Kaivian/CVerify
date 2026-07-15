using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Profiles.Services;

namespace CVerify.API.Modules.Shared.System.Pipelines;

public class CandidateAssessmentPipelineOrchestrator : IPipelineOrchestrator
{
    private readonly ICandidateAssessmentService _assessmentService;
    private readonly ApplicationDbContext _context;

    public CandidateAssessmentPipelineOrchestrator(
        ICandidateAssessmentService assessmentService,
        ApplicationDbContext context)
    {
        _assessmentService = assessmentService;
        _context = context;
    }

    public string PipelineType => "candidate-assessment";

    public async Task<bool> CancelAsync(Guid executionId, CancellationToken cancellationToken = default)
    {
        var assessment = await _context.CandidateAssessments.FirstOrDefaultAsync(ca => ca.Id == executionId, cancellationToken);
        if (assessment == null) return false;

        return await _assessmentService.CancelAssessmentAsync(assessment.UserId, executionId);
    }

    public async Task<bool> RetryAsync(Guid executionId, Guid? taskId = null, CancellationToken cancellationToken = default)
    {
        // Re-trigger assessment calculation
        await _assessmentService.ReprocessAssessmentAsync(executionId, cancellationToken);
        return true;
    }

    public async Task<bool> PauseAsync(Guid executionId, CancellationToken cancellationToken = default)
    {
        var assessment = await _context.CandidateAssessments.FirstOrDefaultAsync(ca => ca.Id == executionId, cancellationToken);
        if (assessment == null) return false;

        assessment.Status = "Paused";
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> ResumeAsync(Guid executionId, CancellationToken cancellationToken = default)
    {
        var assessment = await _context.CandidateAssessments.FirstOrDefaultAsync(ca => ca.Id == executionId, cancellationToken);
        if (assessment == null) return false;

        assessment.Status = "Running";
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}
