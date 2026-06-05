using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.SourceCode.Entities;

public class AnalysisReport
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid JobId { get; set; }

    [ForeignKey(nameof(JobId))]
    public virtual AnalysisJob Job { get; set; } = null!;

    [Required]
    public Guid RepositoryId { get; set; }

    [ForeignKey(nameof(RepositoryId))]
    public virtual SourceCodeRepository Repository { get; set; } = null!;

    [Required]
    [Column(TypeName = "jsonb")]
    public string ReportData { get; set; } = null!;

    [Required]
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}
