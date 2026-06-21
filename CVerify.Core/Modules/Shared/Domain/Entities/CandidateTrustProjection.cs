using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("candidate_trust_projections")]
public class CandidateTrustProjection
{
    [Key]
    [ForeignKey(nameof(Candidate))]
    public Guid CandidateId { get; set; }

    public virtual User Candidate { get; set; } = null!;

    [Required]
    public Guid TrustProfileId { get; set; }

    [ForeignKey(nameof(TrustProfileId))]
    public virtual TrustProfile TrustProfile { get; set; } = null!;

    [Required]
    public int AggregateScore { get; set; }

    [Required]
    [MaxLength(30)]
    public string TrustTier { get; set; } = null!; // Unverified, BasicVerified, EvidenceVerified, HighTrust

    [Required]
    public DateTimeOffset LastUpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
