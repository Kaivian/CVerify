using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Profiles.Entities;

[Table("candidate_skill_tree_nodes")]
public class CandidateSkillTreeNode
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid CandidateAssessmentId { get; set; }

    [ForeignKey(nameof(CandidateAssessmentId))]
    public virtual CandidateAssessment Assessment { get; set; } = null!;

    public Guid? ParentId { get; set; }

    [ForeignKey(nameof(ParentId))]
    public virtual CandidateSkillTreeNode? Parent { get; set; }

    [Required]
    [MaxLength(100)]
    public string DisplayName { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string Category { get; set; } = null!; // Domain, Subdomain, Technology, Framework, Library, Tool, Methodology

    [Required]
    [MaxLength(50)]
    public string ProficiencyLevel { get; set; } = null!; // e.g. Awareness, Working, Practitioner, Expert

    public double ConfidenceScore { get; set; }

    public double EstimatedExperienceMonths { get; set; }

    [Column(TypeName = "jsonb")]
    public string? SupportingEvidence { get; set; } // Structured JSON references to sources
}
