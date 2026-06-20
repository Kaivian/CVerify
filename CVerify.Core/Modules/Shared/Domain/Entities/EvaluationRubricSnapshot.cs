using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

using System.Text.Json.Serialization;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("evaluation_rubric_snapshots")]
public class EvaluationRubricSnapshot
{
    [Key]
    [ForeignKey(nameof(RequirementSnapshot))]
    public Guid RequirementSnapshotId { get; set; }

    [JsonIgnore]
    public virtual RequirementSnapshot RequirementSnapshot { get; set; } = null!;

    [Column(TypeName = "jsonb")]
    public string? CapabilityWeights { get; set; }

    [Column(TypeName = "jsonb")]
    public string? ScoringRules { get; set; }

    [Column(TypeName = "jsonb")]
    public string? EvidenceRequirements { get; set; }

    public DateTimeOffset SnapshottedAt { get; set; } = DateTimeOffset.UtcNow;
}
