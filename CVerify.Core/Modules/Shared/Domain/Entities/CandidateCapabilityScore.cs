using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("candidate_capability_scores")]
public class CandidateCapabilityScore
{
    [Key]
    [ForeignKey(nameof(CandidateCapability))]
    public Guid CandidateCapabilityId { get; set; }

    public virtual CandidateCapability CandidateCapability { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string ExpertiseLevel { get; set; } = null!; // e.g. Conceptual, Production, Architecture

    [Required]
    public double ProficiencyScore { get; set; } = 0.0; // 0.0 to 100.0

    [Required]
    public double RecencyIndex { get; set; } = 1.0; // Time decay (0.0 to 1.0)

    [Required]
    public DateTimeOffset CalculatedAt { get; set; } = DateTimeOffset.UtcNow;
}
