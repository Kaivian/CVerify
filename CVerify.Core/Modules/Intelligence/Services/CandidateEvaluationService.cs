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
    Task<CandidateCapabilityIntelligence> GetCapabilityIntelligenceAsync(Guid candidateId, bool forceRefresh = false, CancellationToken cancellationToken = default);
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
                string targetFile = "";
                string rationale = "";
                if (!string.IsNullOrEmpty(rc.EvidenceJson))
                {
                    try
                    {
                        using var evDoc = JsonDocument.Parse(rc.EvidenceJson);
                        var root = evDoc.RootElement;
                        if (root.TryGetProperty("evidence", out var evProp) && evProp.ValueKind == JsonValueKind.Array && evProp.GetArrayLength() > 0)
                        {
                            targetFile = evProp[0].GetString() ?? "";
                        }
                        else if (root.TryGetProperty("file_path", out var pathProp))
                        {
                            targetFile = pathProp.GetString() ?? "";
                        }

                        if (root.TryGetProperty("description", out var descProp))
                        {
                            rationale = descProp.GetString() ?? "";
                        }
                    }
                    catch {}
                }

                item = new ProjectedCapabilityItem
                {
                    Slug = slug,
                    Name = rc.Name,
                    Source = "Verified",
                    Score = rc.Score,
                    Recency = 1.0,
                    Maturity = rc.Maturity,
                    Confidence = rc.Confidence,
                    Rationale = rationale,
                    TargetFilePath = targetFile
                };
                consolidated[slug] = item;
            }
            else
            {
                if (rc.Score > item.Score)
                {
                    item.Score = rc.Score;
                    item.Maturity = rc.Maturity;
                    item.Confidence = rc.Confidence;

                    string targetFile = "";
                    string rationale = "";
                    if (!string.IsNullOrEmpty(rc.EvidenceJson))
                    {
                        try
                        {
                            using var evDoc = JsonDocument.Parse(rc.EvidenceJson);
                            var root = evDoc.RootElement;
                            if (root.TryGetProperty("evidence", out var evProp) && evProp.ValueKind == JsonValueKind.Array && evProp.GetArrayLength() > 0)
                            {
                                targetFile = evProp[0].GetString() ?? "";
                            }
                            else if (root.TryGetProperty("file_path", out var pathProp))
                            {
                                targetFile = pathProp.GetString() ?? "";
                            }

                            if (root.TryGetProperty("description", out var descProp))
                            {
                                rationale = descProp.GetString() ?? "";
                            }
                        }
                        catch {}
                    }
                    item.TargetFilePath = targetFile;
                    item.Rationale = rationale;
                }
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
                    Recency = 1.0,
                    Maturity = "Intermediate",
                    Confidence = 0.85,
                    Rationale = "Verified in Candidate Assessment.",
                    TargetFilePath = ""
                };
                consolidated[slug] = item;
            }
            else
            {
                if (cs.Score > item.Score)
                {
                    item.Score = cs.Score;
                }
                item.Source = "Verified";
            }
        }

        // Process self-declared skills (only add if not already verified)
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
                    Score = 50.0,
                    Recency = 1.0,
                    Maturity = "Basic",
                    Confidence = 0.20,
                    Rationale = "Self-declared skill in profile.",
                    TargetFilePath = ""
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

    public async Task<CandidateCapabilityIntelligence> GetCapabilityIntelligenceAsync(
        Guid candidateId, 
        bool forceRefresh = false, 
        CancellationToken cancellationToken = default)
    {
        var snapshot = await _context.CandidateEvaluationSnapshots
            .FirstOrDefaultAsync(s => s.CandidateId == candidateId, cancellationToken)
            .ConfigureAwait(false);

        var projection = await _context.CandidateCapabilityProjections
            .FirstOrDefaultAsync(p => p.CandidateId == candidateId, cancellationToken)
            .ConfigureAwait(false);

        if (snapshot == null || projection == null || forceRefresh)
        {
            snapshot = await EvaluateAndSnapshotCandidateAsync(candidateId, cancellationToken).ConfigureAwait(false);
            projection = await _context.CandidateCapabilityProjections
                .FirstOrDefaultAsync(p => p.CandidateId == candidateId, cancellationToken)
                .ConfigureAwait(false);
        }

        var capabilities = new List<CapabilityItem>();
        if (projection != null && !string.IsNullOrEmpty(projection.CapabilitiesJson))
        {
            capabilities = JsonSerializer.Deserialize<List<CapabilityItem>>(
                projection.CapabilitiesJson,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new();
        }

        decimal? expectedSalaryMin = null;
        decimal? expectedSalaryMax = null;
        string? targetWorkplaceType = null;

        var careerPref = await _context.CareerPreferences
            .FirstOrDefaultAsync(cp => cp.UserId == candidateId, cancellationToken)
            .ConfigureAwait(false);

        if (careerPref != null)
        {
            expectedSalaryMin = careerPref.ExpectedSalaryMin ?? careerPref.SalaryExpectations;
            expectedSalaryMax = careerPref.ExpectedSalaryMax ?? careerPref.SalaryExpectations;
            targetWorkplaceType = careerPref.RemotePreference;
        }

        var careerLevel = "";
        var careerLevelLabel = "";
        
        var latestAssessment = await _context.CandidateAssessments
            .Where(ca => ca.UserId == candidateId && ca.Status == "Completed")
            .OrderByDescending(ca => ca.CompletedAtUtc)
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

        if (latestAssessment != null)
        {
            careerLevel = latestAssessment.CareerLevel ?? "";
            careerLevelLabel = latestAssessment.CareerLevelLabel ?? "";
        }

        return new CandidateCapabilityIntelligence
        {
            CandidateId = candidateId,
            Capabilities = capabilities,
            IdentityTrustScore = snapshot?.IdentityTrustScore ?? 0.0,
            EvidenceTrustScore = snapshot?.EvidenceTrustScore ?? 0.0,
            CareerLevel = careerLevel,
            CareerLevelLabel = careerLevelLabel,
            ExpectedSalaryMin = expectedSalaryMin,
            ExpectedSalaryMax = expectedSalaryMax,
            TargetWorkplaceType = targetWorkplaceType,
            CalculatedAt = projection?.ProjectedAt ?? DateTimeOffset.UtcNow
        };
    }

    private class ProjectedCapabilityItem
    {
        public string Slug { get; set; } = null!;
        public string Name { get; set; } = null!;
        public string Source { get; set; } = null!; // Verified, SelfDeclared
        public double Score { get; set; }
        public double Recency { get; set; }
        public string Maturity { get; set; } = "Basic";
        public double Confidence { get; set; } = 1.0;
        public string Rationale { get; set; } = "";
        public string TargetFilePath { get; set; } = "";
    }
}
