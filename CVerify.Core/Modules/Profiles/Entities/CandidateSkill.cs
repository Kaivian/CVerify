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

    public double Score { get; set; }

    public double Confidence { get; set; }

    [Required]
    [MaxLength(50)]
    public string Level { get; set; } = null!; // Awareness, Working, Practitioner, Expert

    [Column(TypeName = "jsonb")]
    public string? EvidenceSources { get; set; } // JSON list of supporting repositories and experience entries
}
