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

namespace CVerify.API.Modules.Shared.System.Services;

public record EligibilityRequirementCheck(string Name, string Description, bool Passed, string RequiredValue, string ActualValue);

public record EligibilityReportDto(
    bool IsEligible,
    bool IsPartiallyEligible,
    List<EligibilityRequirementCheck> Checks,
    string Explanation
);

public interface IJobEligibilityService
{
    Task<bool> IsEligibleForDiscoveryAsync(Guid jobId, Guid? userId, CancellationToken cancellationToken);
    Task<EligibilityReportDto> CheckEligibilityAsync(Guid jobId, Guid userId, CancellationToken cancellationToken);
}

public class JobEligibilityService : IJobEligibilityService
{
    private readonly ApplicationDbContext _context;
    private readonly ICandidateAssessmentService _assessmentService;
    private readonly ICandidateEvaluationService _evaluationService;

    public JobEligibilityService(
        ApplicationDbContext context,
        ICandidateAssessmentService assessmentService,
        ICandidateEvaluationService evaluationService)
    {
        _context = context;
        _assessmentService = assessmentService;
        _evaluationService = evaluationService;
    }

    public async Task<bool> IsEligibleForDiscoveryAsync(Guid jobId, Guid? userId, CancellationToken cancellationToken)
    {
        var job = await _context.JobVacancies
            .FirstOrDefaultAsync(j => j.Id == jobId, cancellationToken);

        if (job == null) return false;

        // If the job is not published, only owner recruiters and platform admins can discover it.
        if (job.Status != "Published" || !job.IsActive)
        {
            if (userId == null) return false;

            // Check if user is platform admin
            var isAdmin = await _context.AdminMembers
                .AnyAsync(am => am.UserId == userId.Value && am.Status == "Active", cancellationToken);
            if (isAdmin) return true;

            // Check if user is owner/member of the owning organization
            var isMember = await _context.OrganizationMemberships
                .AnyAsync(om => om.OrganizationId == job.OrganizationId && om.UserId == userId.Value && om.Status == "active", cancellationToken);
            return isMember;
        }

        // Parse Discovery Rules
        if (string.IsNullOrEmpty(job.DiscoveryProfileJson))
        {
            return true; // No special discovery limits
        }

        try
        {
            using var doc = JsonDocument.Parse(job.DiscoveryProfileJson);
            var root = doc.RootElement;

            // If it requires a minimum trust score or verification limits
            int minTrustScore = 0;
            bool requireEmail = false;

            if (root.TryGetProperty("trustRequirements", out var trustProp))
            {
                if (trustProp.TryGetProperty("minimumTrustScore", out var minScoreProp))
                {
                    minTrustScore = minScoreProp.GetInt32();
                }
                if (trustProp.TryGetProperty("requireVerifiedEmail", out var reqEmailProp))
                {
                    requireEmail = reqEmailProp.GetBoolean();
                }
            }

            if (minTrustScore > 0 || requireEmail)
            {
                if (userId == null) return false; // Guest cannot discover strict jobs

                var searchProfile = await _context.CandidateSearchProfiles
                    .FirstOrDefaultAsync(p => p.CandidateId == userId.Value, cancellationToken);

                if (searchProfile == null) return false;

                if (searchProfile.TrustScore < minTrustScore) return false;

                if (requireEmail)
                {
                    var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId.Value, cancellationToken);
                    if (user == null || user.EmailVerifiedAt == null) return false;
                }
            }
        }
        catch
        {
            // If discovery JSON is malformed, default to visible
            return true;
        }

        return true;
    }

    public async Task<EligibilityReportDto> CheckEligibilityAsync(Guid jobId, Guid userId, CancellationToken cancellationToken)
    {
        var job = await _context.JobVacancies
            .Include(j => j.HiringRequirement)
            .FirstOrDefaultAsync(j => j.Id == jobId, cancellationToken);

        if (job == null)
        {
            throw new ArgumentException("Job vacancy not found.");
        }

        var checks = new List<EligibilityRequirementCheck>();

        // Ensure snapshot and capability projections are populated
        var snapshot = await _context.CandidateEvaluationSnapshots
            .FirstOrDefaultAsync(s => s.CandidateId == userId, cancellationToken)
            .ConfigureAwait(false);

        if (snapshot == null)
        {
            snapshot = await _evaluationService.EvaluateAndSnapshotCandidateAsync(userId, cancellationToken).ConfigureAwait(false);
        }

        // 1. Profile Completeness Check
        bool completenessPassed = snapshot.ProfileCompleteness >= 80;
        checks.Add(new EligibilityRequirementCheck(
            "ProfileCompleteness",
            "Requires candidate profile completeness score to be 80% or higher.",
            completenessPassed,
            "80%",
            $"{snapshot.ProfileCompleteness}%"
        ));

        // 2. Verified Profile Check (requires completed CandidateAssessment)
        var latestAssessment = await _context.CandidateAssessments
            .AnyAsync(ca => ca.UserId == userId && ca.Status == "Completed", cancellationToken);
        checks.Add(new EligibilityRequirementCheck(
            "VerifiedProfile",
            "Requires candidate to have a successfully completed technical assessment.",
            latestAssessment,
            "Verified",
            latestAssessment ? "Verified" : "Not Verified"
        ));

        // 3. Identity Verification Check (Trust Tier)
        string currentTier = snapshot.VerificationState ?? "Unverified";
        bool idPassed = currentTier != "Unverified";
        checks.Add(new EligibilityRequirementCheck(
            "IdentityVerification",
            "Requires candidate identity to be basic or evidence verified.",
            idPassed,
            "Verified Tier",
            currentTier
        ));

        // 4. Portfolio Presence Check (requires analyzed repositories for THIS user)
        var hasRepos = await _context.SourceCodeRepositories
            .AnyAsync(r => r.AuthProvider.UserId == userId && r.LatestAnalysisStatus == "Completed" && r.IsEnabled && r.IsAccessible, cancellationToken);
        checks.Add(new EligibilityRequirementCheck(
            "PortfolioRepositories",
            "Requires at least one successfully connected and analyzed source code repository.",
            hasRepos,
            "At least 1 analyzed repository",
            hasRepos ? "Yes" : "No"
        ));

        // 5. Trust Score Check (from Discovery Profile)
        int requiredTrustScore = 60;
        if (!string.IsNullOrEmpty(job.DiscoveryProfileJson))
        {
            try
            {
                using var doc = JsonDocument.Parse(job.DiscoveryProfileJson);
                var root = doc.RootElement;
                if (root.TryGetProperty("trustRequirements", out var trustProp) &&
                    trustProp.TryGetProperty("minimumTrustScore", out var minProp))
                {
                    requiredTrustScore = minProp.GetInt32();
                }
            }
            catch { }
        }
        int actualTrustScore = (int)snapshot.IdentityTrustScore;
        bool trustPassed = actualTrustScore >= requiredTrustScore;
        checks.Add(new EligibilityRequirementCheck(
            "TrustScore",
            $"Requires a minimum trust verification score of {requiredTrustScore}.",
            trustPassed,
            $">= {requiredTrustScore}",
            actualTrustScore.ToString()
        ));

        // 6. Capability Mappings Check
        if (job.HiringRequirement != null)
        {
            var reqCapabilities = await _context.RequirementCapabilities
                .Where(rc => rc.HiringRequirementId == job.HiringRequirementId)
                .ToListAsync(cancellationToken);

            var projection = await _context.CandidateCapabilityProjections
                .FirstOrDefaultAsync(p => p.CandidateId == userId, cancellationToken);

            var candCaps = new List<ProjectedCapabilityItem>();
            if (projection != null && !string.IsNullOrEmpty(projection.CapabilitiesJson))
            {
                candCaps = JsonSerializer.Deserialize<List<ProjectedCapabilityItem>>(
                    projection.CapabilitiesJson,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new();
            }

            var candidateSlugs = candCaps.Select(c => c.Slug).ToList();
            var candidateNodeIds = await _context.CapabilityNodes
                .Where(n => candidateSlugs.Contains(n.Slug))
                .Select(n => n.Id)
                .ToListAsync(cancellationToken);

            foreach (var req in reqCapabilities)
            {
                var matchedCandCap = candCaps.FirstOrDefault(cc =>
                    cc.Slug.Equals(req.CapabilityId, StringComparison.OrdinalIgnoreCase) ||
                    cc.Name.Equals(req.Name, StringComparison.OrdinalIgnoreCase));

                if (matchedCandCap == null)
                {
                    Guid? reqNodeId = null;
                    var reqNode = await _context.CapabilityNodes
                        .FirstOrDefaultAsync(n => n.Slug.ToLower() == req.CapabilityId.ToLower() || n.Name.ToLower() == req.Name.ToLower(), cancellationToken);
                    if (reqNode != null)
                    {
                        reqNodeId = reqNode.Id;
                    }

                    bool isRelated = false;
                    if (reqNodeId.HasValue)
                    {
                        isRelated = await _context.CapabilityEdges
                            .AnyAsync(e => e.SourceNodeId == reqNodeId.Value && candidateNodeIds.Contains(e.TargetNodeId), cancellationToken);
                    }

                    var alias = await _context.CapabilityAliases
                        .FirstOrDefaultAsync(a => a.AliasName.ToLower() == req.CapabilityId.ToLower(), cancellationToken);
                    if (alias != null)
                    {
                        matchedCandCap = candCaps.FirstOrDefault(cc => cc.Slug == alias.CanonicalId.ToLowerInvariant().Trim());
                    }

                    if (matchedCandCap != null || isRelated)
                    {
                        checks.Add(new EligibilityRequirementCheck(
                            $"Capability-{req.Name}",
                            $"Requires proficiency in {req.Name}.",
                            true,
                            "Required",
                            "Met via related/ancestral capability"
                        ));
                        continue;
                    }
                }

                bool capPassed = matchedCandCap != null;
                checks.Add(new EligibilityRequirementCheck(
                    $"Capability-{req.Name}",
                    $"Requires proficiency in {req.Name}.",
                    capPassed,
                    "Required",
                    capPassed ? "Met" : "Missing"
                ));
            }
        }

        bool isEligible = checks.All(c => c.Passed);
        bool isPartiallyEligible = !isEligible && checks.Take(4).All(c => c.Passed);

        string explanation = isEligible
            ? "Candidate meets all trust, capability, and profile requirements."
            : isPartiallyEligible
                ? "Candidate has verified profile setup but does not meet all capability/trust thresholds."
                : "Candidate profile does not meet core platform verification requirements.";

        return new EligibilityReportDto(isEligible, isPartiallyEligible, checks, explanation);
    }

    private class ProjectedCapabilityItem
    {
        public string Slug { get; set; } = null!;
        public string Name { get; set; } = null!;
        public string Source { get; set; } = null!;
        public double Score { get; set; }
        public double Recency { get; set; }
    }
}
