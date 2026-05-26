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
using CVerify.API.Modules.Profiles.Services;
using CVerify.API.Modules.Intelligence.Services;

namespace CVerify.API.Modules.Intelligence.Services;

public interface ICandidateEvaluationService
{
    Task<CandidateEvaluationSnapshot> EvaluateAndSnapshotCandidateAsync(Guid candidateId, CancellationToken cancellationToken = default);
}

public class CandidateEvaluationService : ICandidateEvaluationService
{
    private readonly ApplicationDbContext _context;
    private readonly ICareerReadinessEngine _readinessEngine;
    private readonly ITrustEngineService _trustEngine;

    public CandidateEvaluationService(
        ApplicationDbContext context,
        ICareerReadinessEngine readinessEngine,
        ITrustEngineService trustEngine)
    {
        _context = context;
        _readinessEngine = readinessEngine;
        _trustEngine = trustEngine;
    }

    public async Task<CandidateEvaluationSnapshot> EvaluateAndSnapshotCandidateAsync(Guid candidateId, CancellationToken cancellationToken = default)
    {
        // 1. Calculate Profile Completeness
        double profileCompleteness = 0.0;
        var careerPref = await _context.CareerPreferences
            .FirstOrDefaultAsync(cp => cp.UserId == candidateId, cancellationToken)
            .ConfigureAwait(false);
        if (careerPref != null)
        {
            var readinessReport = await _readinessEngine.CalculateReadinessAsync(careerPref, cancellationToken).ConfigureAwait(false);
            profileCompleteness = readinessReport.CompletenessPercent; // readiness completeness score (0-100)
        }

        // 2. Calculate Identity Trust Score (from Core Trust Engine)
        var trustProjection = await _trustEngine.RecalculateCandidateTrustAsync(candidateId).ConfigureAwait(false);
        double identityTrustScore = trustProjection.AggregateScore;
        string verificationState = trustProjection.TrustTier;

        // 3. Calculate Evidence Trust Score (from latest completed assessment TrustLevel)
        double evidenceTrustScore = 0.0;
        var latestAssessment = await _context.CandidateAssessments
            .Where(ca => ca.UserId == candidateId && ca.Status == "Completed")
            .OrderByDescending(ca => ca.CompletedAtUtc)
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);
        if (latestAssessment != null)
        {
            evidenceTrustScore = latestAssessment.TrustLevel;
        }

        // 4. Update CandidateEvaluationSnapshot
        var snapshot = await _context.CandidateEvaluationSnapshots
            .FirstOrDefaultAsync(s => s.CandidateId == candidateId, cancellationToken)
            .ConfigureAwait(false);

        if (snapshot == null)
        {
            snapshot = new CandidateEvaluationSnapshot
            {
                CandidateId = candidateId,
                ProfileCompleteness = profileCompleteness,
                IdentityTrustScore = identityTrustScore,
                EvidenceTrustScore = evidenceTrustScore,
                VerificationState = verificationState,
                EvaluatedAt = DateTimeOffset.UtcNow
            };
            _context.CandidateEvaluationSnapshots.Add(snapshot);
        }
        else
        {
            snapshot.ProfileCompleteness = profileCompleteness;
            snapshot.IdentityTrustScore = identityTrustScore;
            snapshot.EvidenceTrustScore = evidenceTrustScore;
            snapshot.VerificationState = verificationState;
            snapshot.EvaluatedAt = DateTimeOffset.UtcNow;
        }

        // 5. Build Capability Projections
        // a) Query verified capabilities from completed repository assessments
        var repoAssessments = await _context.RepositoryAssessments
            .Join(_context.SourceCodeRepositories,
                ra => ra.RepositoryId,
                r => r.Id,
                (ra, r) => new { ra, r })
            .Where(x => x.r.AuthProvider.UserId == candidateId && x.ra.Status == "Completed")
            .Select(x => x.ra)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
        var repoAssessmentIds = repoAssessments.Select(ra => ra.Id).ToList();

        var verifiedRepoCaps = await _context.RepositoryCapabilities
            .Where(rc => repoAssessmentIds.Contains(rc.RepositoryAssessmentId))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        // b) Query verified candidate skills from candidate assessments
        var verifiedSkills = new List<CandidateSkill>();
        if (latestAssessment != null)
        {
            verifiedSkills = await _context.CandidateSkills
                .Where(cs => cs.CandidateAssessmentId == latestAssessment.Id)
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);
        }

        // c) Query self-declared skills
        var selfDeclaredSkills = await _context.UserSkills
            .Where(us => us.UserId == candidateId)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        // Consolidation dictionary (Key: slug)
        var consolidated = new Dictionary<string, ProjectedCapabilityItem>();

        // Process verified repo capabilities
        foreach (var rc in verifiedRepoCaps)
        {
            var slug = rc.Name.ToLowerInvariant().Trim();
            if (string.IsNullOrEmpty(slug)) continue;

            if (!consolidated.TryGetValue(slug, out var item))
            {
                item = new ProjectedCapabilityItem
                {
                    Slug = slug,
                    Name = rc.Name,
                    Source = "Verified",
                    Score = rc.Score,
                    Recency = 1.0
                };
                consolidated[slug] = item;
            }
            else
            {
                item.Score = Math.Max(item.Score, rc.Score);
                item.Source = "Verified";
            }
        }

        // Process verified candidate assessment skills
        foreach (var cs in verifiedSkills)
        {
            var slug = cs.SkillName.ToLowerInvariant().Trim();
            if (string.IsNullOrEmpty(slug)) continue;

            if (!consolidated.TryGetValue(slug, out var item))
            {
                item = new ProjectedCapabilityItem
                {
                    Slug = slug,
                    Name = cs.SkillName,
                    Source = "Verified",
                    Score = cs.Score,
                    Recency = 1.0
                };
                consolidated[slug] = item;
            }
            else
            {
                item.Score = Math.Max(item.Score, cs.Score);
                item.Source = "Verified";
            }
        }

        // Process self-declared skills (only add if not already verified or if score is lower)
        foreach (var sd in selfDeclaredSkills)
        {
            var slug = sd.Skill.ToLowerInvariant().Trim();
            if (string.IsNullOrEmpty(slug)) continue;

            if (!consolidated.TryGetValue(slug, out var item))
            {
                consolidated[slug] = new ProjectedCapabilityItem
                {
                    Slug = slug,
                    Name = sd.Skill,
                    Source = "SelfDeclared",
                    Score = 50.0, // Default baseline score for self-declared skills
                    Recency = 1.0
                };
            }
        }

        var projectionList = consolidated.Values.ToList();
        var capabilitiesJson = JsonSerializer.Serialize(projectionList);

        // Update CandidateCapabilityProjection
        var projection = await _context.CandidateCapabilityProjections
            .FirstOrDefaultAsync(p => p.CandidateId == candidateId, cancellationToken)
            .ConfigureAwait(false);

        if (projection == null)
        {
            projection = new CandidateCapabilityProjection
            {
                CandidateId = candidateId,
                CapabilitiesJson = capabilitiesJson,
                ProjectedAt = DateTimeOffset.UtcNow
            };
            _context.CandidateCapabilityProjections.Add(projection);
        }
        else
        {
            projection.CapabilitiesJson = capabilitiesJson;
            projection.ProjectedAt = DateTimeOffset.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

        return snapshot;
    }

    private class ProjectedCapabilityItem
    {
        public string Slug { get; set; } = null!;
        public string Name { get; set; } = null!;
        public string Source { get; set; } = null!; // Verified, SelfDeclared
        public double Score { get; set; }
        public double Recency { get; set; }
    }
}
