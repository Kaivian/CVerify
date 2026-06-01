using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Recovery.Entities;

public class ApprovedRecoverySession
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid OrganizationId { get; set; }

    [ForeignKey(nameof(OrganizationId))]
    public virtual Organization Organization { get; set; } = null!;

    [Required]
    [MaxLength(255)]
    public string ApprovedRepresentative { get; set; } = null!;

    [Required]
    [MaxLength(255)]
    public string VerifiedRecoveryEmail { get; set; } = null!;

    [Required]
    [MaxLength(255)]
    public string RecoveryTokenHash { get; set; } = null!;

    [Required]
    public DateTimeOffset ExpiresAt { get; set; }

    [Required]
    [MaxLength(100)]
    public string ApprovedBy { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string SuggestedStrategy { get; set; } = "OptionB"; // "OptionA", "OptionB"

    public bool IsConsumed { get; set; } = false;

    public DateTimeOffset? UsedAt { get; set; }

    [MaxLength(45)]
    public string? UsedByIp { get; set; }

    [MaxLength(500)]
    public string? UsedByDevice { get; set; }

    public DateTimeOffset? RevokedAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
