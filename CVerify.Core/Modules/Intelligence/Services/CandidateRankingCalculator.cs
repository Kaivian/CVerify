using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Profiles.Entities;

namespace CVerify.API.Modules.Intelligence.Services;

public class CandidateRankingCalculator : ICandidateRankingCalculator
{
    private readonly ApplicationDbContext _context;

    public CandidateRankingCalculator(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<CandidateRankingProjection> CalculateCandidateRankingAsync(Guid candidateId, CancellationToken cancellationToken = default)
    {
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == candidateId, cancellationToken)
            .ConfigureAwait(false);

        if (user == null)
        {
            throw new ArgumentException($"User with ID {candidateId} not found.");
        }

        var profile = await _context.UserProfiles
            .FirstOrDefaultAsync(up => up.UserId == candidateId, cancellationToken)
            .ConfigureAwait(false);

        if (profile == null)
        {
            throw new ArgumentException($"User profile for ID {candidateId} not found.");
        }

        var careerPref = await _context.CareerPreferences
            .FirstOrDefaultAsync(cp => cp.UserId == candidateId, cancellationToken)
            .ConfigureAwait(false);

        var snapshot = await _context.CandidateEvaluationSnapshots
            .FirstOrDefaultAsync(ces => ces.CandidateId == candidateId, cancellationToken)
            .ConfigureAwait(false);

        var trustProj = await _context.CandidateTrustProjections
            .FirstOrDefaultAsync(ctp => ctp.CandidateId == candidateId, cancellationToken)
            .ConfigureAwait(false);

        var latestAssessment = await _context.CandidateAssessments
            .Where(ca => ca.UserId == candidateId && ca.Status == "Completed")
            .OrderByDescending(ca => ca.CompletedAtUtc)
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

        // 1. Gather repository statistics
        var repos = await _context.SourceCodeRepositories
            .Where(r => r.AuthProvider.UserId == candidateId && r.IsEnabled)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        int verifiedRepoCount = repos.Count(r => r.IsVerified);
        int totalStars = repos.Sum(r => r.StarsCount);
        int totalForks = repos.Sum(r => r.ForksCount);

        // 2. Gather verified contributions
        int verifiedContributionCount = await _context.ProjectEntries
            .CountAsync(p => p.UserId == candidateId && p.DeletedAt == null && p.VerificationStatus.ToString() == "Verified", cancellationToken)
            .ConfigureAwait(false);

        // 3. Extract top 5 capabilities
        var topCapabilities = await _context.CandidateCapabilities
            .Include(cc => cc.CapabilityNode)
            .Include(cc => cc.Score)
            .Where(cc => cc.CandidateId == candidateId && cc.Score != null)
            .OrderByDescending(cc => cc.Score!.ProficiencyScore)
            .Take(5)
            .Select(cc => new
            {
                name = cc.CapabilityNode.Name,
                score = cc.Score!.ProficiencyScore
            })
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        string topCapabilitiesJson = JsonSerializer.Serialize(topCapabilities);

        // 4. Dynamic social counts
        int followersCount = await _context.UserFollowers
            .CountAsync(f => f.FolloweeId == candidateId, cancellationToken)
            .ConfigureAwait(false);

        int followingCount = await _context.UserFollowers
            .CountAsync(f => f.FollowerId == candidateId, cancellationToken)
            .ConfigureAwait(false);

        // 5. Gather raw scoring fields
        double aiScore = latestAssessment?.OverallScore ?? 0.0;
        double trustScore = trustProj?.AggregateScore ?? 0.0;
        double completeness = snapshot?.ProfileCompleteness ?? 0.0;
        double evidenceTrustScore = snapshot?.EvidenceTrustScore ?? 0.0;

        // 6. Compute OSS Impact Score
        double ossImpactScore = CalculateRepositoryImpactScore(totalStars, totalForks, verifiedRepoCount);

        // 7. Compute final composite score
        double compositeScore = (aiScore * 0.35) + (trustScore * 0.35) + (completeness * 0.15) + (ossImpactScore * 0.15);

        // 8. Build ranking projection record
        return new CandidateRankingProjection
        {
            CandidateId = candidateId,
            FullName = user.FullName,
            Username = profile.Username ?? user.Username,
            Bio = profile.Bio,
            Headline = profile.Headline,
            Location = profile.Location,
            AvatarUrl = user.AvatarUrl,
            CompositeScore = Math.Round(compositeScore, 2),
            AiScore = aiScore,
            TrustScore = trustScore,
            ProfileCompleteness = completeness,
            EvidenceTrustScore = evidenceTrustScore,
            VerifiedRepoCount = verifiedRepoCount,
            TotalStarsCount = totalStars,
            TotalForksCount = totalForks,
            VerifiedContributionCount = verifiedContributionCount,
            TopCapabilitiesJson = topCapabilitiesJson,
            PrimaryDomain = latestAssessment?.PrimaryTendency ?? "General",
            CareerLevelLabel = latestAssessment?.CareerLevelLabel ?? "Unknown",
            FollowersCount = followersCount,
            FollowingCount = followingCount,
            AvailableForHire = careerPref?.AvailableForHire ?? true,
            OpenToWorkStatus = careerPref?.OpenToWorkStatus ?? "casual",
            LastUpdatedAt = DateTimeOffset.UtcNow
        };
    }

    public static double CalculateRepositoryImpactScore(int totalStars, int totalForks, int verifiedRepoCount)
    {
        double starsScore = Math.Min(totalStars * 5.0, 50.0);
        double forksScore = Math.Min(totalForks * 10.0, 30.0);
        double repoScore = Math.Min(verifiedRepoCount * 10.0, 20.0);
        return starsScore + forksScore + repoScore;
    }
}
