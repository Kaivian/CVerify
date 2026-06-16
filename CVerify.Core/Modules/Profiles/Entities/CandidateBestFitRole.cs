using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Profiles.Entities;

[Table("candidate_best_fit_roles")]
public class CandidateBestFitRole
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
    public string RoleTitle { get; set; } = null!; // Senior Backend Engineer

    public double MatchScore { get; set; }

    public double Confidence { get; set; }

    public int Rank { get; set; } // 1, 2, 3...

    [Required]
    [MaxLength(20)]
    public string MatchingEngineVersion { get; set; } = "V1";

    [Column(TypeName = "jsonb")]
    public string? Evidence { get; set; } // Supporting repos and matching skills JSON

    [Column(TypeName = "jsonb")]
    public string? EngineMetadata { get; set; } // Extension point for Pipeline 3 custom weights/scores
}
