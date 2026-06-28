using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Persistence;

using Microsoft.Extensions.Logging;

namespace CVerify.API.Modules.Intelligence.Services;

public interface IRepositoryIntelligencePipeline
{
    Task ExecutePipelineAsync(Guid candidateId, Guid repositoryId);
}

public class RepositoryIntelligencePipeline : IRepositoryIntelligencePipeline
{
    private readonly ApplicationDbContext _context;
    private readonly ICapabilityGraphService _capabilityService;
    private readonly ITrustEngineService _trustEngine;
    private readonly IOutboxPublisher _outboxPublisher;
    private readonly ICandidateEvaluationService _evaluationService;
    private readonly ICandidateRankingProjectionService _rankingProjectionService;
    private readonly ILogger<RepositoryIntelligencePipeline> _logger;

    public RepositoryIntelligencePipeline(
        ApplicationDbContext context,
        ICapabilityGraphService capabilityService,
        ITrustEngineService trustEngine,
        IOutboxPublisher outboxPublisher,
        ICandidateEvaluationService evaluationService,
        ICandidateRankingProjectionService rankingProjectionService,
        ILogger<RepositoryIntelligencePipeline> logger)
    {
        _context = context;
        _capabilityService = capabilityService;
        _trustEngine = trustEngine;
        _outboxPublisher = outboxPublisher;
        _evaluationService = evaluationService;
        _rankingProjectionService = rankingProjectionService;
        _logger = logger;
    }

    public async Task ExecutePipelineAsync(Guid candidateId, Guid repositoryId)
    {
        // 1. Sync & Analysis Completed: Generate Evidence Artifact
        var repo = await _context.SourceCodeRepositories
            .FirstOrDefaultAsync(r => r.Id == repositoryId)
            .ConfigureAwait(false);

        if (repo == null) return;

        var source = await _context.EvidenceSources
            .FirstOrDefaultAsync(s => s.ProviderType == "GitHub")
            .ConfigureAwait(false);

        if (source == null)
        {
            source = new EvidenceSource
            {
                Id = Guid.CreateVersion7(),
                Name = "GitHub Connector",
                ProviderType = "GitHub",
                IsActive = true,
                CreatedAt = DateTimeOffset.UtcNow
            };
            _context.EvidenceSources.Add(source);
            await _context.SaveChangesAsync().ConfigureAwait(false);
        }

        // Add Evidence Artifact
        var artifact = new EvidenceArtifact
        {
            Id = Guid.CreateVersion7(),
            SourceId = source.Id,
            ExternalIdentifier = repo.HtmlUrl ?? repo.Name,
            ArtifactType = "CodeRepository",
            Payload = JsonSerializer.Serialize(new
            {
                repo.Name,
                repo.PrimaryLanguage,
                repo.StarsCount,
                repo.ForksCount
            }),
            CreatedAt = DateTimeOffset.UtcNow
        };
        _context.EvidenceArtifacts.Add(artifact);

        // Add Evidence Claim
        var claim = new EvidenceClaim
        {
            Id = Guid.CreateVersion7(),
            CandidateId = candidateId,
            EvidenceArtifactId = artifact.Id,
            AssertionType = "AuthoredCode",
            ConfidenceScore = repo.IsVerified ? 0.95 : 0.60,
            CreatedAt = DateTimeOffset.UtcNow
        };
        _context.EvidenceClaims.Add(claim);

        // Add Verification
        var verification = new EvidenceVerification
        {
            Id = Guid.CreateVersion7(),
            EvidenceClaimId = claim.Id,
            VerificationType = "GPG_Signature",
            Status = repo.IsVerified ? "Verified" : "Pending",
            VerificationLog = JsonSerializer.Serialize(new { repo.LatestAnalysisStatus, repo.LatestRiskLevel }),
            VerifiedAt = repo.IsVerified ? DateTimeOffset.UtcNow : null,
            CreatedAt = DateTimeOffset.UtcNow
        };
        _context.EvidenceVerifications.Add(verification);
        await _context.SaveChangesAsync().ConfigureAwait(false);

        // Emit outbox events
        _outboxPublisher.Enqueue("RepositorySyncedEvent", new { CandidateId = candidateId, RepositoryId = repositoryId });
        _outboxPublisher.Enqueue("EvidenceArtifactGeneratedEvent", new { CandidateId = candidateId, ArtifactId = artifact.Id });

        // 2. Capability Extraction: Map repo language to Graph Node
        var languageNode = await _capabilityService.ResolveCapabilityAsync(repo.PrimaryLanguage ?? "Unknown").ConfigureAwait(false);
        if (languageNode == null && !string.IsNullOrEmpty(repo.PrimaryLanguage))
        {
            languageNode = new CapabilityNode
            {
                Id = Guid.CreateVersion7(),
                Name = repo.PrimaryLanguage,
                Slug = repo.PrimaryLanguage.ToLowerInvariant(),
                Category = "Language",
                CreatedAt = DateTimeOffset.UtcNow
            };
            _context.CapabilityNodes.Add(languageNode);
            await _context.SaveChangesAsync().ConfigureAwait(false);
        }

        if (languageNode != null)
        {
            // Link Candidate to Capability
            var candCap = await _context.CandidateCapabilities
                .FirstOrDefaultAsync(cc => cc.CandidateId == candidateId && cc.CapabilityNodeId == languageNode.Id)
                .ConfigureAwait(false);

            if (candCap == null)
            {
                candCap = new CandidateCapability
                {
                    Id = Guid.CreateVersion7(),
                    CandidateId = candidateId,
                    CapabilityNodeId = languageNode.Id,
                    CreatedAt = DateTimeOffset.UtcNow,
                    UpdatedAt = DateTimeOffset.UtcNow
                };
                _context.CandidateCapabilities.Add(candCap);
                await _context.SaveChangesAsync().ConfigureAwait(false);
            }

            // Link Capability to Evidence
            var capEvidence = new CandidateCapabilityEvidence
            {
                CandidateCapabilityId = candCap.Id,
                EvidenceArtifactId = artifact.Id,
                AddedAt = DateTimeOffset.UtcNow
            };
            _context.CandidateCapabilityEvidences.Add(capEvidence);

            // Update score
            var score = await _context.CandidateCapabilityScores
                .FirstOrDefaultAsync(s => s.CandidateCapabilityId == candCap.Id)
                .ConfigureAwait(false);

            var proficiency = repo.StarsCount > 10 ? 80.0 : 60.0;

            if (score == null)
            {
                score = new CandidateCapabilityScore
                {
                    CandidateCapabilityId = candCap.Id,
                    ExpertiseLevel = "Production",
                    ProficiencyScore = proficiency,
                    RecencyIndex = 1.0,
                    CalculatedAt = DateTimeOffset.UtcNow
                };
                _context.CandidateCapabilityScores.Add(score);
            }
            else
            {
                score.ProficiencyScore = proficiency;
                score.CalculatedAt = DateTimeOffset.UtcNow;
            }

            // Add history
            var history = new CandidateCapabilityHistory
            {
                Id = Guid.CreateVersion7(),
                CandidateCapabilityId = candCap.Id,
                ProficiencyScore = proficiency,
                RecordedAt = DateTimeOffset.UtcNow
            };
            _context.CandidateCapabilityHistories.Add(history);
            await _context.SaveChangesAsync().ConfigureAwait(false);

            _outboxPublisher.Enqueue("CandidateCapabilityUpdatedEvent", new { CandidateId = candidateId, CapabilityNodeId = languageNode.Id });
        }

        // 3. Trust Engine Recalculation
        var trustProj = await _trustEngine.RecalculateCandidateTrustAsync(candidateId).ConfigureAwait(false);
        _outboxPublisher.Enqueue("TrustScoreCalculatedEvent", new { CandidateId = candidateId, TrustScore = trustProj.AggregateScore });

        // 4. Update Candidate Evaluation Snapshot and Capability Projection
        await _evaluationService.EvaluateAndSnapshotCandidateAsync(candidateId).ConfigureAwait(false);

        // 5. Update Search Projections
        var user = await _context.Users.FindAsync(candidateId).ConfigureAwait(false);
        if (user != null)
        {
            var searchProj = await _context.CandidateSearchProfiles
                .FirstOrDefaultAsync(p => p.CandidateId == candidateId)
                .ConfigureAwait(false);

            var projection = await _context.CandidateCapabilityProjections
                .FirstOrDefaultAsync(p => p.CandidateId == candidateId)
                .ConfigureAwait(false);

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
                    TrustScore = trustProj.AggregateScore,
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
                searchProj.TrustScore = trustProj.AggregateScore;
                searchProj.TrustTier = trustProj.TrustTier;
                searchProj.CapabilitiesJson = capsJson;
                searchProj.LastProjectedAt = DateTimeOffset.UtcNow;
            }

            // Update Match Projection
            var matchProj = await _context.CandidateMatchProjections
                .FirstOrDefaultAsync(p => p.CandidateId == candidateId)
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

            await _context.SaveChangesAsync().ConfigureAwait(false);
            _outboxPublisher.Enqueue("SearchProjectionsUpdatedEvent", new { CandidateId = candidateId });

            // Rebuild global ranking projections immediately
            _logger.LogInformation("Rebuilding candidate ranking projections after repository intelligence pipeline execution. CandidateId: {CandidateId}, Action: Rebuild", candidateId);
            await _rankingProjectionService.RebuildRankingProjectionsAsync().ConfigureAwait(false);
        }
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
