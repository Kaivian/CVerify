using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("pipeline_tasks_durable")]
public class PipelineTaskEntity
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid ExecutionId { get; set; }

    [ForeignKey(nameof(ExecutionId))]
    public virtual PipelineExecution Execution { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string TaskIdentifier { get; set; } = null!; // E.g., "L1-001"

    [Required]
    [MaxLength(100)]
    public string TaskName { get; set; } = null!;

    [Required]
    [MaxLength(30)]
    public string Status { get; set; } = "Pending"; // Pending, Running, Completed, Failed, Cancelled

    [Required]
    [Column(TypeName = "numeric(5, 2)")]
    public decimal Progress { get; set; } = 0.00m;

    public DateTimeOffset? StartedAt { get; set; }

    public DateTimeOffset? CompletedAt { get; set; }

    public long? DurationMs { get; set; }

    [Required]
    public int RetryCount { get; set; } = 0;

    [MaxLength(2000)]
    public string? ErrorMessage { get; set; }

    public int? PromptTokens { get; set; }

    public int? CompletionTokens { get; set; }

    public int? CacheReadTokens { get; set; }

    public int? CacheWriteTokens { get; set; }

    [Column(TypeName = "numeric(10, 6)")]
    public decimal? EstimatedCostUsd { get; set; }

    [MaxLength(100)]
    public string? ModelName { get; set; }

    [Column(TypeName = "jsonb")]
    public string? MetadataJson { get; set; }

    [Required]
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}
