using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("evidence_claims")]
public class EvidenceClaim
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid CandidateId { get; set; }

    [ForeignKey(nameof(CandidateId))]
    public virtual User Candidate { get; set; } = null!;

    [Required]
    public Guid EvidenceArtifactId { get; set; }

    [ForeignKey(nameof(EvidenceArtifactId))]
    public virtual EvidenceArtifact EvidenceArtifact { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string AssertionType { get; set; } = null!; // AuthoredCode, ReceivedDegree, WorkedPosition

    [Required]
    public double ConfidenceScore { get; set; } = 1.0;

    [Required]
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public virtual ICollection<EvidenceVerification> Verifications { get; set; } = new List<EvidenceVerification>();
}
