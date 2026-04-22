using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.SourceCode.Entities;

public class AnalysisTaskEvent
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid TaskId { get; set; }

    [ForeignKey(nameof(TaskId))]
    public virtual AnalysisTask Task { get; set; } = null!;

    [Required]
    public DateTimeOffset Timestamp { get; set; } = DateTimeOffset.UtcNow;

    [Required]
    [MaxLength(20)]
    public string Level { get; set; } = "Info"; // Info, Warning, Error, Debug

    [Required]
    [MaxLength(50)]
    public string EventType { get; set; } = null!; // StepStarted, ProgressUpdate, FileAnalyzed, SystemLog, ErrorOccurred

    [Required]
    [MaxLength(2000)]
    public string Message { get; set; } = null!;

    [Column(TypeName = "jsonb")]
    public string? Metadata { get; set; }
}
