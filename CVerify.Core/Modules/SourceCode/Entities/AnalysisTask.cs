using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.SourceCode.Entities;

public class AnalysisTask
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid JobId { get; set; }

    [ForeignKey(nameof(JobId))]
    public virtual AnalysisJob Job { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string TaskType { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string Status { get; set; } = "Queued";

    [Required]
    public double Progress { get; set; } = 0.0;

    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public long? DurationMs { get; set; }

    [Required]
    public int RetryCount { get; set; } = 0;

    [MaxLength(2000)]
    public string? ErrorMessage { get; set; }

    // Token & Cost Observability
    public int? PromptTokens { get; set; }
    public int? CompletionTokens { get; set; }
    public int? CacheReadTokens { get; set; }
    public int? CacheWriteTokens { get; set; }

    [Column(TypeName = "numeric(10, 6)")]
    public decimal? EstimatedCostUsd { get; set; }

    [MaxLength(100)]
    public string? ModelName { get; set; }

    [Column(TypeName = "jsonb")]
    public string? Metadata { get; set; }

    [Required]
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;

    [Required]
    public DateTimeOffset LastUpdatedUtc { get; set; } = DateTimeOffset.UtcNow;
}
