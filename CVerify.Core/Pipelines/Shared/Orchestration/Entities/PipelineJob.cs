using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Pipelines.Shared.Orchestration.Entities;

[Table("pipeline_jobs")]
public class PipelineJob
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    [MaxLength(50)]
    public string PipelineType { get; set; } = null!;

    [Required]
    public Guid ReferenceId { get; set; }

    [Required]
    [MaxLength(30)]
    public string Status { get; set; } = "Queued";

    [Required]
    public decimal Progress { get; set; } = 0.00m;

    public DateTimeOffset? StartedAt { get; set; }

    public DateTimeOffset? CompletedAt { get; set; }

    [MaxLength(2000)]
    public string? ErrorMessage { get; set; }

    [Required]
    public int RetryCount { get; set; } = 0;

    [Required]
    public decimal MaxBudgetUsd { get; set; } = 5.00m;

    [Required]
    public decimal CumulativeCostUsd { get; set; } = 0.00m;

    [Required]
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;

    [Required]
    public DateTimeOffset LastUpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}
