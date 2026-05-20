using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Profiles.Entities;

[Table("candidate_domain_profiles")]
public class CandidateDomainProfile
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
    public string DomainName { get; set; } = null!; // Backend Engineering, DevOps, etc.

    public double Score { get; set; } // Domain-specific score

    public double Confidence { get; set; } // 0.0 to 1.0

    [Required]
    [MaxLength(50)]
    public string Seniority { get; set; } = null!; // Junior, Mid-Level, Senior, Staff, Principal

    [Column(TypeName = "jsonb")]
    public string? SupportingEvidence { get; set; } // Repository and skill attribution mapping json
}
