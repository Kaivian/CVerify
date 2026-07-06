using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("pipeline_executions")]
public class PipelineExecution
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    [MaxLength(50)]
    public string PipelineType { get; set; } = null!; // e.g. "repository-analysis", "candidate-assessment", "jd-generation"

    [Required]
    public Guid ReferenceId { get; set; } // Entity being processed

    [Required]
    [MaxLength(30)]
    public string Status { get; set; } = "Queued"; // Queued, Running, Completed, Failed, Cancelled, Paused

    [Required]
    [Column(TypeName = "numeric(5, 2)")]
    public decimal Progress { get; set; } = 0.00m;

    [MaxLength(100)]
    public string? CurrentStep { get; set; }

    public DateTimeOffset? StartedAt { get; set; }

    public DateTimeOffset? CompletedAt { get; set; }

    [MaxLength(2000)]
    public string? ErrorMessage { get; set; }

    [Required]
    public int RetryCount { get; set; } = 0;

    [Required]
    [Column(TypeName = "numeric(10, 6)")]
    public decimal MaxBudgetUsd { get; set; } = 5.00m;

    [Required]
    [Column(TypeName = "numeric(10, 6)")]
    public decimal CumulativeCostUsd { get; set; } = 0.00m;

    public int? TotalInputTokens { get; set; } = 0;

    public int? TotalOutputTokens { get; set; } = 0;

    public Guid? UserId { get; set; } // Triggered by candidate/user

    [ForeignKey(nameof(UserId))]
    public virtual User? User { get; set; }

    public Guid? WorkspaceId { get; set; } // Organizational workspace context

    [ForeignKey(nameof(WorkspaceId))]
    public virtual Workspace? Workspace { get; set; }

    [MaxLength(100)]
    public string? ModelName { get; set; }

    [MaxLength(100)]
    public string? Provider { get; set; }

    [Required]
    [MaxLength(50)]
    public string PipelineVersion { get; set; } = "1.0.0";

    [Required]
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;

    [Required]
    public DateTimeOffset LastUpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}
