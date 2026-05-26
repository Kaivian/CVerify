using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

using System.Text.Json.Serialization;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("evidence_signals")]
public class EvidenceSignal
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid RequirementCapabilityId { get; set; }

    [JsonIgnore]
    [ForeignKey(nameof(RequirementCapabilityId))]
    public virtual RequirementCapability RequirementCapability { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string SignalType { get; set; } = null!; // AstSignature, BlameAuthorship, CommitDiffActivity, QualityAssertions, TelemetryObservability

    [Required]
    [MaxLength(255)]
    public string ExpectedMetric { get; set; } = null!;

    [MaxLength(1000)]
    public string? Rationale { get; set; }

    [Column(TypeName = "jsonb")]
    public string? Metadata { get; set; }
}
