using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("candidate_capability_evidences")]
public class CandidateCapabilityEvidence
{
    [Required]
    public Guid CandidateCapabilityId { get; set; }

    [ForeignKey(nameof(CandidateCapabilityId))]
    public virtual CandidateCapability CandidateCapability { get; set; } = null!;

    [Required]
    public Guid EvidenceArtifactId { get; set; }

    [ForeignKey(nameof(EvidenceArtifactId))]
    public virtual EvidenceArtifact EvidenceArtifact { get; set; } = null!;

    [Required]
    public DateTimeOffset AddedAt { get; set; } = DateTimeOffset.UtcNow;
}
