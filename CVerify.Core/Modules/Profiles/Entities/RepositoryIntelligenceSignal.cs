using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Profiles.Entities;

[Table("repository_intelligence_signals")]
public class RepositoryIntelligenceSignal
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid RepositoryAssessmentId { get; set; }

    public double ScopeSignal { get; set; }

    public double ComplexitySignal { get; set; }

    public double OwnershipSignal { get; set; }

    public double LeadershipSignal { get; set; }

    public double ConsistencySignal { get; set; }

    public DateTimeOffset LastUpdatedUtc { get; set; } = DateTimeOffset.UtcNow;

    [Required]
    [MaxLength(20)]
    public string AssessmentVersion { get; set; } = "2.2.0";

    [Required]
    [MaxLength(20)]
    public string AnalysisVersion { get; set; } = "1.0.0";

    [Required]
    [MaxLength(100)]
    public string ModelVersion { get; set; } = "claude-3-5-sonnet-20241022";

    [Required]
    [MaxLength(50)]
    public string PromptVersion { get; set; } = "v2.3.0";
}
