using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("candidate_evaluation_snapshots")]
public class CandidateEvaluationSnapshot
{
    [Key]
    [ForeignKey(nameof(Candidate))]
    public Guid CandidateId { get; set; }

    public virtual User Candidate { get; set; } = null!;

    [Required]
    public double ProfileCompleteness { get; set; }

    [Required]
    public double IdentityTrustScore { get; set; }

    [Required]
    public double EvidenceTrustScore { get; set; }

    [Required]
    [MaxLength(50)]
    public string VerificationState { get; set; } = null!;

    [Required]
    public DateTimeOffset EvaluatedAt { get; set; } = DateTimeOffset.UtcNow;
}
