using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Pipelines.Shared.Orchestration.Entities;

[Table("pipeline_tasks")]
public class PipelineTask
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid JobId { get; set; }

    [ForeignKey(nameof(JobId))]
    public virtual PipelineJob Job { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string TaskIdentifier { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string TaskName { get; set; } = null!;

    [Required]
    [MaxLength(30)]
    public string Status { get; set; } = "Pending";

    public DateTimeOffset? StartedAt { get; set; }

    public DateTimeOffset? CompletedAt { get; set; }

    [Required]
    public int RetryCount { get; set; } = 0;

    public DateTimeOffset? LeaseExpiresAt { get; set; }

    [MaxLength(100)]
    public string? WorkerId { get; set; }

    public string? ErrorDetails { get; set; }

    [Required]
    public decimal CostUsd { get; set; } = 0.00m;

    [Required]
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;

    [Required]
    public DateTimeOffset LastUpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}
