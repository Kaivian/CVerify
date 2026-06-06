using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.SourceCode.Entities;

public class AnalysisTaskResult
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid TaskId { get; set; }

    [ForeignKey(nameof(TaskId))]
    public virtual AnalysisTask Task { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string SchemaVersion { get; set; } = "2.0.0";

    [Required]
    [Column(TypeName = "jsonb")]
    public string ResultData { get; set; } = null!;

    [Required]
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}
