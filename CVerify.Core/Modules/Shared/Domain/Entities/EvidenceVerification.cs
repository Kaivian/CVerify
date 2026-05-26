using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("evidence_verifications")]
public class EvidenceVerification
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid EvidenceClaimId { get; set; }

    [ForeignKey(nameof(EvidenceClaimId))]
    public virtual EvidenceClaim EvidenceClaim { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string VerificationType { get; set; } = null!; // GPG_Signature, Domain_DNS_Match, Sumsub_KYC_Check

    [Required]
    [MaxLength(30)]
    public string Status { get; set; } = "Pending"; // Pending, Verified, Rejected

    [Column(TypeName = "jsonb")]
    public string? VerificationLog { get; set; } // Detailed checking steps or vendor response payloads

    public DateTimeOffset? VerifiedAt { get; set; }

    public DateTimeOffset? ExpiresAt { get; set; }

    [Required]
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
