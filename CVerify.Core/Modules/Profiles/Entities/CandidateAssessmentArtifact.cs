using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Profiles.Entities;

public class CandidateAssessmentArtifact
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid AssessmentId { get; set; }

    [ForeignKey(nameof(AssessmentId))]
    public virtual CandidateAssessment Assessment { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string ArtifactType { get; set; } = null!; // CandidateProfile, SkillsList, Maturity, ProblemSolving, StrengthsGaps, Recommendations

    [Required]
    public string JsonData { get; set; } = null!;

    [Required]
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}
