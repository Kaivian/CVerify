using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

using System.Text.Json.Serialization;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("interview_blueprint_snapshots")]
public class InterviewBlueprintSnapshot
{
    [Key]
    [ForeignKey(nameof(RequirementSnapshot))]
    public Guid RequirementSnapshotId { get; set; }

    [JsonIgnore]
    public virtual RequirementSnapshot RequirementSnapshot { get; set; } = null!;

    [Column(TypeName = "jsonb")]
    public string? CapabilityQuestions { get; set; }

    [Column(TypeName = "jsonb")]
    public string? Dimensions { get; set; }

    public DateTimeOffset SnapshottedAt { get; set; } = DateTimeOffset.UtcNow;
}
