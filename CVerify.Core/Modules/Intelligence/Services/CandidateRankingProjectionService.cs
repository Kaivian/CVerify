using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Persistence;

namespace CVerify.API.Modules.Intelligence.Services;

public class CandidateRankingProjectionService : ICandidateRankingProjectionService
{
    private readonly ApplicationDbContext _context;
    private readonly ICandidateRankingCalculator _rankingCalculator;
    private readonly ILogger<CandidateRankingProjectionService> _logger;

    public CandidateRankingProjectionService(
        ApplicationDbContext context,
        ICandidateRankingCalculator rankingCalculator,
        ILogger<CandidateRankingProjectionService> logger)
    {
        _context = context;
        _rankingCalculator = rankingCalculator;
        _logger = logger;
    }

    public async Task RebuildRankingProjectionsAsync(CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Starting candidate ranking projections rebuild... Action: Rebuild");
        var stopwatch = System.Diagnostics.Stopwatch.StartNew();

        try
        {
            // 1. Fetch all active candidates with public profiles who completed AI assessment
            var activePublicCandidates = await _context.UserProfiles
                .Include(up => up.User)
                .Where(up => up.ProfileVisibility == "public" &&
                             up.DeletedAt == null &&
                             up.User.DeletedAt == null &&
                             up.User.Status == UserStatus.ACTIVE)
                .Where(up => _context.CandidateAssessments.Any(ca => ca.UserId == up.UserId && ca.Status == "Completed"))
                .Select(up => up.UserId)
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);

            _logger.LogInformation("Found {Count} active public candidates for ranking.", activePublicCandidates.Count);

            var computedProjections = new List<CandidateRankingProjection>();

            // 2. Compute ranking signals for each candidate
            foreach (var candidateId in activePublicCandidates)
            {
                try
                {
                    var proj = await _rankingCalculator.CalculateCandidateRankingAsync(candidateId, cancellationToken).ConfigureAwait(false);
                    computedProjections.Add(proj);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to compute ranking signals for candidate {CandidateId}. Skipping.", candidateId);
                }
            }

            // 3. Sort projections to assign ranks (CompositeScore DESC, then TrustScore DESC, then AiScore DESC)
            var sortedProjections = computedProjections
                .OrderByDescending(p => p.CompositeScore)
                .ThenByDescending(p => p.TrustScore)
                .ThenByDescending(p => p.AiScore)
                .ToList();

            // 4. Fetch existing projections to preserve previous positions
            var existingProjections = await _context.CandidateRankingProjections
                .ToDictionaryAsync(p => p.CandidateId, cancellationToken)
                .ConfigureAwait(false);

            // 5. Update global positions and previous delta tracking
            int currentRank = 1;
            foreach (var newProj in sortedProjections)
            {
                if (existingProjections.TryGetValue(newProj.CandidateId, out var existing))
                {
                    newProj.PreviousGlobalRankPosition = existing.GlobalRankPosition;
                }
                else
                {
                    newProj.PreviousGlobalRankPosition = 0;
                }
                newProj.GlobalRankPosition = currentRank;
                currentRank++;
            }

            // 6. Atomically replace projections in a single transaction
            using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
            try
            {
                if (existingProjections.Values.Any())
                {
                    _context.CandidateRankingProjections.RemoveRange(existingProjections.Values);
                }

                if (sortedProjections.Any())
                {
                    _context.CandidateRankingProjections.AddRange(sortedProjections);
                }

                await _context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
                await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
                stopwatch.Stop();

                _logger.LogInformation("Successfully rebuilt {Count} candidate ranking projections in {DurationMs}ms. Action: Rebuild", sortedProjections.Count, stopwatch.ElapsedMilliseconds);
            }
            catch (Exception ex)
            {
                stopwatch.Stop();
                await transaction.RollbackAsync(cancellationToken).ConfigureAwait(false);
                _logger.LogError(ex, "Error executing transaction during ranking projections rebuild in {DurationMs}ms. Action: Rebuild. Rollback successful.", stopwatch.ElapsedMilliseconds);
                throw;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to rebuild candidate ranking projections. Action: Rebuild");
            throw;
        }
    }
}
