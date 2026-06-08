using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("ai_streaming_sessions")]
public class AiStreamingSession
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    [MaxLength(100)]
    public string PipelineId { get; set; } = null!; // E.g., "candidate-assessment", "repository-analysis"

    public Guid? UserId { get; set; }

    [ForeignKey(nameof(UserId))]
    public virtual User? User { get; set; }

    public Guid? WorkspaceId { get; set; }

    [ForeignKey(nameof(WorkspaceId))]
    public virtual Workspace? Workspace { get; set; }

    [Required]
    [MaxLength(50)]
    public string Status { get; set; } = "Pending"; // Pending, Running, Completed, Failed, Cancelled

    [Required]
    public double Progress { get; set; } = 0.0;

    [MaxLength(100)]
    public string? CurrentStep { get; set; }

    [MaxLength(100)]
    public string? ModelName { get; set; }

    [MaxLength(100)]
    public string? Provider { get; set; }

    public DateTimeOffset? StartedAt { get; set; }

    public DateTimeOffset? CompletedAt { get; set; }

    [Column(TypeName = "numeric(10, 6)")]
    public decimal? TotalCostUsd { get; set; } = 0m;

    public int? TotalInputTokens { get; set; } = 0;

    public int? TotalOutputTokens { get; set; } = 0;

    [MaxLength(2000)]
    public string? ErrorMessage { get; set; }

    [Column(TypeName = "jsonb")]
    public string? SummaryData { get; set; } // JSON serialized custom pipeline output summary

    [Column(TypeName = "jsonb")]
    public string? ExpectedOutputs { get; set; } // JSON configuration of expected outputs

    [Required]
    [MaxLength(50)]
    public string PipelineVersion { get; set; } = "1.0.0";

    [Required]
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;

    [Required]
    public DateTimeOffset LastUpdatedUtc { get; set; } = DateTimeOffset.UtcNow;
}
