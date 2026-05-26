using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

using System.Text.Json.Serialization;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("requirement_vector_snapshots")]
public class RequirementVectorSnapshot
{
    [Key]
    [ForeignKey(nameof(RequirementSnapshot))]
    public Guid RequirementSnapshotId { get; set; }

    [JsonIgnore]
    public virtual RequirementSnapshot RequirementSnapshot { get; set; } = null!;

    [Required]
    public float[] Vector { get; set; } = null!;

    public int Dimension { get; set; }

    public DateTimeOffset SnapshottedAt { get; set; } = DateTimeOffset.UtcNow;
}
