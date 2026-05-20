using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Profiles.Entities;

[Table("candidate_strengths_weaknesses")]
public class CandidateStrengthWeakness
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid CandidateAssessmentId { get; set; }

    [ForeignKey(nameof(CandidateAssessmentId))]
    public virtual CandidateAssessment Assessment { get; set; } = null!;

    [Required]
    [MaxLength(20)]
    public string FindingType { get; set; } = null!; // Strength, ImprovementArea

    [Required]
    [MaxLength(150)]
    public string Topic { get; set; } = null!; // Distributed Systems, Test Coverage

    [Required]
    [MaxLength(1000)]
    public string Description { get; set; } = null!;

    [Column(TypeName = "jsonb")]
    public string? Evidence { get; set; } // Citing specific repositories or skills
}
