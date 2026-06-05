using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.SourceCode.Entities;

public class AnalysisJobEvent
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid JobId { get; set; }

    [ForeignKey(nameof(JobId))]
    public virtual AnalysisJob Job { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string Step { get; set; } = null!;

    [Required]
    public double Progress { get; set; }

    [Required]
    [MaxLength(2000)]
    public string Message { get; set; } = null!;

    [Required]
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}
