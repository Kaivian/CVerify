using System;
using System.Collections.Generic;

namespace CVerify.API.Pipelines.Shared.Contracts;

public class ArtifactEnvelope<TPayload>
{
    public MetadataSection Metadata { get; set; } = null!;
    public ConfidenceSection Confidence { get; set; } = null!;
    public List<EvidenceSection> Evidence { get; set; } = new();
    public LineageSection Lineage { get; set; } = null!;
    public TPayload Payload { get; set; } = default!;
}

public class MetadataSection
{
    public Guid JobId { get; set; }
    public string TaskIdentifier { get; set; } = null!;
    public string AnalyzerVersion { get; set; } = null!;
    public string PromptVersion { get; set; } = null!;
    public string ModelVersion { get; set; } = null!;
    public long DurationMs { get; set; }
    public decimal CostUsd { get; set; }
    public TokenUsage Tokens { get; set; } = null!;
}

public class TokenUsage
{
    public int Prompt { get; set; }
    public int Completion { get; set; }
    public int CacheRead { get; set; }
    public int CacheWrite { get; set; }
}

public class ConfidenceSection
{
    public double Score { get; set; }
    public string Rationale { get; set; } = null!;
}

public class EvidenceSection
{
    public string FilePath { get; set; } = null!;
    public string LineRange { get; set; } = null!;
    public string Citation { get; set; } = null!;
    public string Category { get; set; } = null!;
}

public class LineageSection
{
    public List<InputLineage> Inputs { get; set; } = new();
}

public class InputLineage
{
    public string ArtifactId { get; set; } = null!;
    public string Checksum { get; set; } = null!;
}
