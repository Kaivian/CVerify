using System;

namespace CVerify.API.Pipelines.Shared.Artifacts.Entities;

public class ArtifactRegistryEntry
{
    public Guid Id { get; set; }
    public string ArtifactId { get; set; } = null!;
    public string Checksum { get; set; } = null!;
    public DateTimeOffset CreatedAtUtc { get; set; }
    public Guid JobId { get; set; }
    public string MetadataJson { get; set; } = null!;
    public string Name { get; set; } = null!;
    public string StoragePath { get; set; } = null!;
}
