using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("ai_streaming_metrics")]
public class AiStreamingMetric
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid SessionId { get; set; }

    [ForeignKey(nameof(SessionId))]
    public virtual AiStreamingSession Session { get; set; } = null!;

    [MaxLength(100)]
    public string? StageId { get; set; }

    [Required]
    [MaxLength(100)]
    public string MetricName { get; set; } = null!; // E.g., "input_tokens", "cost_usd", "latency_ms"

    [Required]
    public double MetricValue { get; set; }

    [Required]
    public DateTimeOffset Timestamp { get; set; } = DateTimeOffset.UtcNow;
}
