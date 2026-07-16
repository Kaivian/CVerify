using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Profiles.Entities;

[Table("candidate_skills")]
public class CandidateSkill
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid CandidateAssessmentId { get; set; }

    [ForeignKey(nameof(CandidateAssessmentId))]
    public virtual CandidateAssessment Assessment { get; set; } = null!;

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

    public double Score { get; set; }

    public double Confidence { get; set; }

    [Required]
    [MaxLength(50)]
    public string Level { get; set; } = null!; // Awareness, Working, Practitioner, Expert

    [Column(TypeName = "jsonb")]
    public string? EvidenceSources { get; set; } // JSON list of supporting repositories and experience entries
}
