using System;
using System.IO;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Pipelines.Shared.Storage;
using CVerify.API.Pipelines.Shared.Artifacts;
using CVerify.API.Pipelines.Shared.Contracts;
using CVerify.API.Pipelines.RepositoryIntelligence.Models;

namespace CVerify.API.Pipelines.RepositoryIntelligence.Readers;

public class RepositoryArtifactReader : IRepositoryArtifactReader
{
    private readonly IArtifactStorageProvider _storage;
    private readonly IArtifactRegistry _registry;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public RepositoryArtifactReader(IArtifactStorageProvider storage, IArtifactRegistry registry)
    {
        _storage = storage ?? throw new ArgumentNullException(nameof(storage));
        _registry = registry ?? throw new ArgumentNullException(nameof(registry));
    }

    private async Task<TPayload> ReadPayloadAsync<TPayload>(Guid jobId, string artifactId, CancellationToken cancellationToken)
    {
        var meta = await _registry.GetLatestArtifactMetaAsync(jobId, artifactId, cancellationToken);
        if (meta == null)
        {
            throw new FileNotFoundException($"Artifact registration metadata '{artifactId}' not found for job {jobId}.");
        }

        var rawJson = await _storage.ReadArtifactTextAsync(meta.StoragePath, cancellationToken);
        var envelope = JsonSerializer.Deserialize<ArtifactEnvelope<TPayload>>(rawJson, JsonOptions);
        if (envelope == null || envelope.Payload == null)
        {
            throw new InvalidDataException($"Artifact envelope for '{artifactId}' is invalid or empty.");
        }

        return envelope.Payload;
    }

    public Task<TechStackModel> GetTechStackAsync(Guid jobId, CancellationToken cancellationToken = default)
    {
        return ReadPayloadAsync<TechStackModel>(jobId, "L1-004-tech_stack", cancellationToken);
    }

    public Task<ArchitecturePatternsModel> GetArchitectureAsync(Guid jobId, CancellationToken cancellationToken = default)
    {
        return ReadPayloadAsync<ArchitecturePatternsModel>(jobId, "L1-006-architecture_patterns", cancellationToken);
    }

    public Task<OwnershipScoreModel> GetOwnershipMapAsync(Guid jobId, CancellationToken cancellationToken = default)
    {
        return ReadPayloadAsync<OwnershipScoreModel>(jobId, "L1-015-ownership_score", cancellationToken);
    }

    public Task<TrustSignalsModel> GetTrustSignalsAsync(Guid jobId, CancellationToken cancellationToken = default)
    {
        return ReadPayloadAsync<TrustSignalsModel>(jobId, "L1-018-trust_signals", cancellationToken);
    }

    public Task<SkillEvidenceGraphModel> GetSkillGraphAsync(Guid jobId, CancellationToken cancellationToken = default)
    {
        return ReadPayloadAsync<SkillEvidenceGraphModel>(jobId, "L1-017-skill_evidence_graph", cancellationToken);
    }
}
