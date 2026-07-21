using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Profiles.Entities;

namespace CVerify.API.Modules.Intelligence.Services;

public interface IBusinessRuleEngine
{
    Task<List<CandidateAssessment>> FilterCandidatePoolAsync(
        List<CandidateAssessment> rawCandidatePool,
        Guid workspaceId,
        CancellationToken cancellationToken = default);
}

public class BusinessRuleEngine : IBusinessRuleEngine
{
    private readonly ApplicationDbContext _context;

    public BusinessRuleEngine(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<CandidateAssessment>> FilterCandidatePoolAsync(
        List<CandidateAssessment> rawCandidatePool,
        Guid workspaceId,
        CancellationToken cancellationToken = default)
    {
        if (rawCandidatePool == null || !rawCandidatePool.Any())
        {
            return new List<CandidateAssessment>();
        }

        // 1. Filter candidates against active candidate IDs
        var candidateUserIds = rawCandidatePool.Select(ca => ca.UserId).Distinct().ToList();

        // 2. Filter out candidates with recent application rejections (< 90 days) in this workspace
        var recentApplicationUserIds = await _context.JobApplications
            .Where(ja => ja.JobVacancy.HiringRequirement.WorkspaceId == workspaceId &&
                        ja.CreatedAt >= DateTimeOffset.UtcNow.AddDays(-90) &&
                        (ja.Status == "Rejected" || ja.Status == "Withdrawn"))
            .Select(ja => ja.CandidateId)
            .Distinct()
            .ToListAsync(cancellationToken);

        var filteredPool = rawCandidatePool
            .Where(ca => !recentApplicationUserIds.Contains(ca.UserId))
            .ToList();

        return filteredPool;
    }
}
