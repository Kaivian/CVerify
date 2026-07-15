using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("pipeline_stages")]
public class PipelineStage
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid ExecutionId { get; set; }

    [ForeignKey(nameof(ExecutionId))]
    public virtual PipelineExecution Execution { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string StageId { get; set; } = null!; // E.g., "L1-001", "RepoStructure"

    [Required]
    [MaxLength(200)]
    public string StageName { get; set; } = null!;

    [MaxLength(100)]
    public string? ParentStageId { get; set; } // Nested sub-stages

    [Required]
    [MaxLength(30)]
    public string Status { get; set; } = "Pending"; // Pending, Running, Completed, Failed, Skipped

    [Required]
    [Column(TypeName = "numeric(5, 2)")]
    public decimal Progress { get; set; } = 0.00m;

    [MaxLength(1000)]
    public string? Description { get; set; }

    [Column(TypeName = "jsonb")]
    public string? DetailsJson { get; set; } // Detailed stage metadata

    public DateTimeOffset? StartedAt { get; set; }

    public DateTimeOffset? CompletedAt { get; set; }

    public long? DurationMs { get; set; }

    [Required]
    public int RetryCount { get; set; } = 0;
}
