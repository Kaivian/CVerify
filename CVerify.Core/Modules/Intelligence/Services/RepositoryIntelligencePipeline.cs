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

        // Add Evidence Artifact (idempotent lookup)
        var externalIdentifier = repo.HtmlUrl ?? repo.Name;
        var artifact = await _context.EvidenceArtifacts
            .FirstOrDefaultAsync(a => a.SourceId == source.Id && a.ExternalIdentifier == externalIdentifier)
            .ConfigureAwait(false);

        Guid artifactId;
        if (artifact == null)
        {
            artifact = new EvidenceArtifact
            {
                Id = Guid.CreateVersion7(),
                SourceId = source.Id,
                ExternalIdentifier = externalIdentifier,
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
            await _context.SaveChangesAsync().ConfigureAwait(false);
            artifactId = artifact.Id;
        }
        else
        {
            artifactId = artifact.Id;
        }

        // Add Evidence Claim (idempotent lookup)
        var claim = await _context.EvidenceClaims
            .FirstOrDefaultAsync(c => c.CandidateId == candidateId && c.EvidenceArtifactId == artifactId)
            .ConfigureAwait(false);

        Guid claimId;
        if (claim == null)
        {
            claim = new EvidenceClaim
            {
                Id = Guid.CreateVersion7(),
                CandidateId = candidateId,
                EvidenceArtifactId = artifactId,
                AssertionType = "AuthoredCode",
                ConfidenceScore = repo.IsVerified ? 0.95 : 0.60,
                CreatedAt = DateTimeOffset.UtcNow
            };
            _context.EvidenceClaims.Add(claim);
            await _context.SaveChangesAsync().ConfigureAwait(false);
            claimId = claim.Id;
        }
        else
        {
            claimId = claim.Id;
        }

        // Add Verification (idempotent lookup)
        var verification = await _context.EvidenceVerifications
            .FirstOrDefaultAsync(v => v.EvidenceClaimId == claimId)
            .ConfigureAwait(false);

        if (verification == null)
        {
            verification = new EvidenceVerification
            {
                Id = Guid.CreateVersion7(),
                EvidenceClaimId = claimId,
                VerificationType = "GPG_Signature",
                Status = repo.IsVerified ? "Verified" : "Pending",
                VerificationLog = JsonSerializer.Serialize(new { repo.LatestAnalysisStatus, repo.LatestRiskLevel }),
                VerifiedAt = repo.IsVerified ? DateTimeOffset.UtcNow : null,
                CreatedAt = DateTimeOffset.UtcNow
            };
            _context.EvidenceVerifications.Add(verification);
            await _context.SaveChangesAsync().ConfigureAwait(false);
        }

        // Emit outbox events
        _outboxPublisher.Enqueue("RepositorySyncedEvent", new { CandidateId = candidateId, RepositoryId = repositoryId });
        _outboxPublisher.Enqueue("EvidenceArtifactGeneratedEvent", new { CandidateId = candidateId, ArtifactId = artifactId });

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

        // 5. Update Search Projections (Delegated to CandidateEvaluationService)
        await _evaluationService.UpdateSearchProfileAsync(candidateId).ConfigureAwait(false);
        _outboxPublisher.Enqueue("SearchProjectionsUpdatedEvent", new { CandidateId = candidateId });

        // Rebuild global ranking projections immediately
        _logger.LogInformation("Rebuilding candidate ranking projections after repository intelligence pipeline execution. CandidateId: {CandidateId}, Action: Rebuild", candidateId);
        await _rankingProjectionService.RebuildRankingProjectionsAsync().ConfigureAwait(false);
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
