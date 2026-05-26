using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("matching_factors")]
public class MatchingFactor
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid MatchingEvaluationId { get; set; }

    [ForeignKey(nameof(MatchingEvaluationId))]
    public virtual MatchingEvaluation MatchingEvaluation { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string FactorName { get; set; } = null!; // CapabilityMatch, EvidenceStrength, Recency, TrustFactor

    [Required]
    public int FactorScore { get; set; } // 0 to 100

    [Required]
    public double Weight { get; set; } // 0.0 to 1.0
}
