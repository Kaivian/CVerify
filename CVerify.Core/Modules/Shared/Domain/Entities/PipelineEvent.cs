using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("pipeline_events_durable")]
public class PipelineEvent
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid ExecutionId { get; set; }

    [ForeignKey(nameof(ExecutionId))]
    public virtual PipelineExecution Execution { get; set; } = null!;

    [MaxLength(100)]
    public string? StageId { get; set; }

    [Required]
    [MaxLength(20)]
    public string LogLevel { get; set; } = "Info"; // Info, Success, Warning, Error, Debug

    [MaxLength(100)]
    public string? Component { get; set; }

    [Required]
    public string Message { get; set; } = null!;

    [Required]
    public DateTimeOffset Timestamp { get; set; } = DateTimeOffset.UtcNow;

    [Column(TypeName = "jsonb")]
    public string? MetadataJson { get; set; }

    public Guid? CorrelationId { get; set; }
}
