using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Pipelines.Shared.Artifacts.Entities;

namespace CVerify.API.Pipelines.Shared.Artifacts;

public class ArtifactRegistry : IArtifactRegistry
{
    private readonly ApplicationDbContext _context;

    public ArtifactRegistry(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<ArtifactRegistryEntry?> GetLatestArtifactMetaAsync(Guid jobId, string artifactId, CancellationToken cancellationToken = default)
    {
        return await _context.ArtifactRegistryEntries
            .FirstOrDefaultAsync(x => x.JobId == jobId && x.ArtifactId == artifactId, cancellationToken);
    }
}
