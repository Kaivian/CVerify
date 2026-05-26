using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("trust_components")]
public class TrustComponent
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid TrustProfileId { get; set; }

    [ForeignKey(nameof(TrustProfileId))]
    public virtual TrustProfile TrustProfile { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string ComponentName { get; set; } = null!; // KYC_Identity, GitAuthorship, DomainMatch, etc.

    [Required]
    public int ComponentScore { get; set; } // 0 to 100

    [Required]
    public double Weight { get; set; } // 0.0 to 1.0

    [Column(TypeName = "jsonb")]
    public string? ExplanationMetadata { get; set; } // Metadata explaining the calculation

    [Required]
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
