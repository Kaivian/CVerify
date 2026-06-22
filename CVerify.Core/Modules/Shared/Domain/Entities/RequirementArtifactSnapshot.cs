using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("requirement_artifact_snapshots")]
public class RequirementArtifactSnapshot
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid RequirementSnapshotId { get; set; }

    [JsonIgnore]
    [ForeignKey(nameof(RequirementSnapshotId))]
    public virtual RequirementSnapshot RequirementSnapshot { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string ArtifactType { get; set; } = null!;

    [Required]
    public string MarkdownContent { get; set; } = null!;

    [Column(TypeName = "jsonb")]
    public string? StructuredContentJson { get; set; }

    public DateTimeOffset SnapshottedAt { get; set; } = DateTimeOffset.UtcNow;
}
