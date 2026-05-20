using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Profiles.Entities;

[Table("candidate_intelligence_signals")]
public class CandidateIntelligenceSignal
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid CandidateAssessmentId { get; set; }

    [ForeignKey(nameof(CandidateAssessmentId))]
    public virtual CandidateAssessment Assessment { get; set; } = null!;

    public double ScopeSignal { get; set; }
    public double ComplexitySignal { get; set; }
    public double OwnershipSignal { get; set; }
    public double LeadershipSignal { get; set; }
    public double ConsistencySignal { get; set; }
    public double DeliverySignal { get; set; }
    public double EngineeringMaturitySignal { get; set; }
    public double ProblemSolvingSignal { get; set; }

    public DateTimeOffset LastUpdatedUtc { get; set; } = DateTimeOffset.UtcNow;
}
