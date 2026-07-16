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

using Microsoft.Extensions.Logging;

namespace CVerify.API.Modules.Intelligence.Services;

public interface ICandidateEvaluationService
{
    Task<CandidateEvaluationSnapshot> EvaluateAndSnapshotCandidateAsync(Guid candidateId, CancellationToken cancellationToken = default);
    Task<CandidateCapabilityIntelligence> GetCapabilityIntelligenceAsync(Guid candidateId, bool forceRefresh = false, CancellationToken cancellationToken = default);
    Task UpdateSearchProfileAsync(Guid candidateId, CancellationToken cancellationToken = default);
}

public class CandidateEvaluationService : ICandidateEvaluationService
{
    private readonly ApplicationDbContext _context;
    private readonly ICareerReadinessEngine _readinessEngine;
    private readonly ITrustEngineService _trustEngine;
    private readonly ILogger<CandidateEvaluationService> _logger;

    public CandidateEvaluationService(
        ApplicationDbContext context,
        ICareerReadinessEngine readinessEngine,
        ITrustEngineService trustEngine,
        ILogger<CandidateEvaluationService> logger)
    {
        _context = context;
        _readinessEngine = readinessEngine;
        _trustEngine = trustEngine;
        _logger = logger;
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
                    catch { }
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
                        catch { }
                    }
                    item.TargetFilePath = targetFile;
                    item.Rationale = rationale;
                }
                item.Source = "Verified";
            }
        }

        // Build a mapping from raw name (OriginalName, SkillName) to canonical slug from verified skills
        var nameToCanonicalSlug = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var cs in verifiedSkills)
        {
            var canonicalSlug = !string.IsNullOrEmpty(cs.SkillId)
                ? cs.SkillId.Replace("skill:", "").ToLowerInvariant().Trim()
                : cs.SkillName.ToLowerInvariant().Trim();

            nameToCanonicalSlug[cs.SkillName] = canonicalSlug;
            if (!string.IsNullOrEmpty(cs.OriginalName))
            {
                nameToCanonicalSlug[cs.OriginalName] = canonicalSlug;
            }
        }

        // Process verified candidate assessment skills
        foreach (var cs in verifiedSkills)
        {
            var slug = !string.IsNullOrEmpty(cs.SkillId)
                ? cs.SkillId.Replace("skill:", "").ToLowerInvariant().Trim()
                : cs.SkillName.ToLowerInvariant().Trim();

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
            var slug = !string.IsNullOrEmpty(sd.SkillId)
                ? sd.SkillId.Replace("skill:", "").ToLowerInvariant().Trim()
                : (nameToCanonicalSlug.TryGetValue(sd.Skill, out var canonicalSlug)
                    ? canonicalSlug
                    : GetCleanSlug(sd.Skill));

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

        var stopwatch = System.Diagnostics.Stopwatch.StartNew();

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

        // Synchronize consolidated capabilities to CandidateCapability & CandidateCapabilityScore tables
        var existingCaps = await _context.CandidateCapabilities
            .Include(cc => cc.CapabilityNode)
            .Where(cc => cc.CandidateId == candidateId)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        var newSlugs = projectionList.Select(p => p.Slug).ToHashSet();

        // 1. Remove old capabilities not in the new list
        var toRemove = existingCaps.Where(ec => !newSlugs.Contains(ec.CapabilityNode.Slug)).ToList();
        int removedCount = toRemove.Count;
        if (toRemove.Any())
        {
            var toRemoveIds = toRemove.Select(r => r.Id).ToList();
            var scoresToRemove = await _context.CandidateCapabilityScores
                .Where(s => toRemoveIds.Contains(s.CandidateCapabilityId))
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);

            _context.CandidateCapabilityScores.RemoveRange(scoresToRemove);
            _context.CandidateCapabilities.RemoveRange(toRemove);
        }

        // 2. Add / Update capabilities
        var languages = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "C#", "TypeScript", "JavaScript", "Python", "Go", "Java", "C++", "C", "Ruby", "Rust", "Swift", "Kotlin", "PHP", "HTML", "CSS", "SQL" };
        var frameworks = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "React", "Next.js", "Angular", "Vue", "Django", "Spring", "Express", "ASP.NET Core", "Laravel", "Flask" };
        int addedCount = 0;
        int updatedCount = 0;

        foreach (var item in projectionList)
        {
            var node = await _context.CapabilityNodes
                .FirstOrDefaultAsync(n => n.Slug == item.Slug, cancellationToken)
                .ConfigureAwait(false);

            if (node == null)
            {
                string category = "Library";
                if (languages.Contains(item.Name)) category = "Language";
                else if (frameworks.Contains(item.Name)) category = "Framework";

                node = new CapabilityNode
                {
                    Id = Guid.CreateVersion7(),
                    Name = item.Name,
                    Slug = item.Slug,
                    Category = category,
                    CreatedAt = DateTimeOffset.UtcNow
                };
                _context.CapabilityNodes.Add(node);
            }

            var candCap = existingCaps.FirstOrDefault(cc => cc.CapabilityNode.Slug == item.Slug);
            if (candCap == null)
            {
                candCap = new CandidateCapability
                {
                    Id = Guid.CreateVersion7(),
                    CandidateId = candidateId,
                    CapabilityNodeId = node.Id,
                    CreatedAt = DateTimeOffset.UtcNow,
                    UpdatedAt = DateTimeOffset.UtcNow
                };
                _context.CandidateCapabilities.Add(candCap);
                addedCount++;
            }
            else
            {
                candCap.UpdatedAt = DateTimeOffset.UtcNow;
                updatedCount++;
            }

            var score = await _context.CandidateCapabilityScores
                .FirstOrDefaultAsync(s => s.CandidateCapabilityId == candCap.Id, cancellationToken)
                .ConfigureAwait(false);

            string expertise = item.Score >= 80 ? "Architecture" : item.Score >= 60 ? "Production" : "Conceptual";

            if (score == null)
            {
                score = new CandidateCapabilityScore
                {
                    CandidateCapabilityId = candCap.Id,
                    ExpertiseLevel = expertise,
                    ProficiencyScore = item.Score,
                    RecencyIndex = 1.0,
                    CalculatedAt = DateTimeOffset.UtcNow
                };
                _context.CandidateCapabilityScores.Add(score);
            }
            else
            {
                score.ExpertiseLevel = expertise;
                score.ProficiencyScore = item.Score;
                score.CalculatedAt = DateTimeOffset.UtcNow;
            }
        }

        await _context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        stopwatch.Stop();

        _logger.LogInformation("Capability sync completed for CandidateId: {CandidateId} in {DurationMs}ms. Action: Consolidate, ConsolidatedCount: {ConsolidatedCount}, AddedCount: {AddedCount}, UpdatedCount: {UpdatedCount}, RemovedCount: {RemovedCount}",
            candidateId, stopwatch.ElapsedMilliseconds, projectionList.Count, addedCount, updatedCount, removedCount);

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

    public async Task UpdateSearchProfileAsync(Guid candidateId, CancellationToken cancellationToken = default)
    {
        var user = await _context.Users.FindAsync(new object[] { candidateId }, cancellationToken).ConfigureAwait(false);
        if (user == null) return;

        var searchProj = await _context.CandidateSearchProfiles
            .FirstOrDefaultAsync(p => p.CandidateId == candidateId, cancellationToken)
            .ConfigureAwait(false);

        var projection = await _context.CandidateCapabilityProjections
            .FirstOrDefaultAsync(p => p.CandidateId == candidateId, cancellationToken)
            .ConfigureAwait(false);

        var trustProj = await _trustEngine.RecalculateCandidateTrustAsync(candidateId).ConfigureAwait(false);

        var capsJson = projection?.CapabilitiesJson ?? "[]";
        var projectionItems = string.IsNullOrEmpty(capsJson)
            ? new List<ProjectedCapabilityItem>()
            : JsonSerializer.Deserialize<List<ProjectedCapabilityItem>>(capsJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new();

        if (searchProj == null)
        {
            searchProj = new CandidateSearchProfile
            {
                CandidateId = candidateId,
                FullName = user.FullName,
                Headline = "Verified Software Engineer",
                Location = "Remote",
                TrustScore = (int)trustProj.AggregateScore,
                TrustTier = trustProj.TrustTier,
                CapabilitiesJson = capsJson,
                SearchEmbedding = new float[1536], // Mock empty embedding, resolved asynchronously by CVerify.AI
                LastProjectedAt = DateTimeOffset.UtcNow
            };
            _context.CandidateSearchProfiles.Add(searchProj);
        }
        else
        {
            searchProj.FullName = user.FullName;
            searchProj.TrustScore = (int)trustProj.AggregateScore;
            searchProj.TrustTier = trustProj.TrustTier;
            searchProj.CapabilitiesJson = capsJson;
            searchProj.LastProjectedAt = DateTimeOffset.UtcNow;
        }

        // Update Match Projection
        var matchProj = await _context.CandidateMatchProjections
            .FirstOrDefaultAsync(p => p.CandidateId == candidateId, cancellationToken)
            .ConfigureAwait(false);

        var verifiedCaps = projectionItems.Where(i => i.Source == "Verified").Select(i => i.Name).ToList();

        if (matchProj == null)
        {
            matchProj = new CandidateMatchProjection
            {
                CandidateId = candidateId,
                ProfileSummary = $"Developer with verified capabilities in {string.Join(", ", verifiedCaps)}.",
                NormalizedCapabilities = Array.Empty<Guid>(),
                LastProjectedAt = DateTimeOffset.UtcNow
            };
            _context.CandidateMatchProjections.Add(matchProj);
        }
        else
        {
            matchProj.ProfileSummary = $"Developer with verified capabilities in {string.Join(", ", verifiedCaps)}.";
            matchProj.NormalizedCapabilities = Array.Empty<Guid>();
            matchProj.LastProjectedAt = DateTimeOffset.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
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

    private static string GetCleanSlug(string name)
    {
        if (string.IsNullOrWhiteSpace(name)) return "";
        var cleaned = name.Trim().ToLowerInvariant()
            .Replace("#", "sharp")
            .Replace("+", "plus");
        return System.Text.RegularExpressions.Regex.Replace(cleaned, @"[^a-z0-9]", "");
    }
}
