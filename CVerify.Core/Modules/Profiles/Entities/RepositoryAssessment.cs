using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Profiles.Entities;

[Table("repository_assessments")]
public class RepositoryAssessment
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid RepositoryId { get; set; }

    [Required]
    public Guid AnalysisJobId { get; set; }

    [Required]
    [MaxLength(30)]
    public string Status { get; set; } = "Queued"; // Queued, Running, Completed, Failed

    [Required]
    [MaxLength(100)]
    public string CommitSha { get; set; } = null!;

    public double OverallScore { get; set; } = 0.0;

    [Column(TypeName = "jsonb")]
    public string? TechStack { get; set; }

    [Column(TypeName = "jsonb")]
    public string? Patterns { get; set; }

    [Column(TypeName = "jsonb")]
    public string? QualityMetrics { get; set; }

    [Column(TypeName = "jsonb")]
    public string? JsonData { get; set; } // Detailed qualitative assessment JSON

    [MaxLength(100)]
    public string? ModelVersion { get; set; }

    [MaxLength(50)]
    public string? PromptVersion { get; set; }

    [MaxLength(20)]
    public string? AssessmentSchemaVersion { get; set; }

    [MaxLength(20)]
    public string? PipelineVersion { get; set; }

    [Required]
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? CompletedAtUtc { get; set; }
}
