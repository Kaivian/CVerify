using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("ai_streaming_stages")]
public class AiStreamingStage
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid SessionId { get; set; }

    [ForeignKey(nameof(SessionId))]
    public virtual AiStreamingSession Session { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string StageId { get; set; } = null!; // E.g., "L2-001", "RepoStructure"

    [Required]
    [MaxLength(200)]
    public string StageName { get; set; } = null!;

    [MaxLength(100)]
    public string? ParentStageId { get; set; } // For nested sub-stages

    [Required]
    [MaxLength(50)]
    public string Status { get; set; } = "Pending"; // Pending, Running, Completed, Failed, Skipped

    [Required]
    public double Progress { get; set; } = 0.0;

    [MaxLength(1000)]
    public string? Description { get; set; }

    [Column(TypeName = "jsonb")]
    public string? Details { get; set; } // Rich metadata/details for stage output

    public DateTimeOffset? StartedAt { get; set; }

    public DateTimeOffset? CompletedAt { get; set; }

    public long? DurationMs { get; set; }

    [Required]
    public int RetryCount { get; set; } = 0;
}
