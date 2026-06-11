using System;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Pipelines.Shared.Artifacts.Entities;

namespace CVerify.API.Pipelines.Shared.Artifacts;

public interface IArtifactRegistry
{
    Task<ArtifactRegistryEntry?> GetLatestArtifactMetaAsync(Guid jobId, string artifactId, CancellationToken cancellationToken = default);
}
