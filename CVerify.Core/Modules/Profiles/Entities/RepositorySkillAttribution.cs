using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Profiles.Entities;

[Table("repository_skill_attributions")]
public class RepositorySkillAttribution
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid RepositoryAssessmentId { get; set; }

    [Required]
    [MaxLength(100)]
    public string SkillName { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string SkillId { get; set; } = null!;

    [Required]
    [MaxLength(20)]
    public string TaxonomyVersion { get; set; } = "2026.07";

    [MaxLength(100)]
    public string? OriginalName { get; set; }

    [MaxLength(50)]
    public string? NormalizationSource { get; set; }

    [MaxLength(100)]
    public string? PipelineTraceId { get; set; }

    public double ContributionWeight { get; set; }

    public double Confidence { get; set; }

    [Required]
    [MaxLength(30)]
    public string VerificationLevel { get; set; } = null!;

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
