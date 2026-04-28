using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.SourceCode.Entities;

public class AnalysisExecution
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid JobId { get; set; }

    [ForeignKey(nameof(JobId))]
    public virtual AnalysisJob Job { get; set; } = null!;

    [Required]
    public Guid TaskId { get; set; }

    [ForeignKey(nameof(TaskId))]
    public virtual AnalysisTask Task { get; set; } = null!;

    [Required]
    public Guid UserId { get; set; }

    [ForeignKey(nameof(UserId))]
    public virtual User User { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string ExecutionType { get; set; } = "LLM_CALL"; // e.g. LLM_CALL, TOOL, AGENT_STEP

    [Required]
    [MaxLength(50)]
    public string Provider { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string Model { get; set; } = null!;

    [Required]
    public int PromptTokens { get; set; }

    [Required]
    public int CompletionTokens { get; set; }

    [Required]
    public int TotalTokens { get; set; }

    [Required]
    public int CachedTokens { get; set; }

    [Required]
    [Column(TypeName = "numeric(10, 6)")]
    public decimal EstimatedCostUsd { get; set; }

    [Required]
    public long DurationMs { get; set; }

    [Required]
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}
