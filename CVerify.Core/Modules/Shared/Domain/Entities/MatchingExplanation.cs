using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("matching_explanations")]
public class MatchingExplanation
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid MatchingEvaluationId { get; set; }

    [ForeignKey(nameof(MatchingEvaluationId))]
    public virtual MatchingEvaluation MatchingEvaluation { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string ExplanationType { get; set; } = null!; // Strength, Gap, EvidenceCitation

    public Guid? CapabilityNodeId { get; set; }

    [ForeignKey(nameof(CapabilityNodeId))]
    public virtual CapabilityNode? CapabilityNode { get; set; }

    [Required]
    public string AssertionText { get; set; } = null!; // e.g. "Candidate has 15 commits with Go in repo X"

    public Guid? SupportingArtifactId { get; set; }

    [ForeignKey(nameof(SupportingArtifactId))]
    public virtual EvidenceArtifact? SupportingArtifact { get; set; }
}
