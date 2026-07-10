using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Auth.Entities;

public class VerificationLink
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    [MaxLength(255)]
    public string Email { get; set; } = null!;

    [MaxLength(50)]
    public string? TaxCode { get; set; }

    [MaxLength(255)]
    public string? OrganizationName { get; set; }

    [Obsolete("Use OrganizationName instead")]
    [NotMapped]
    public string? CompanyName { get => OrganizationName; set => OrganizationName = value; }

    [Required]
    [MaxLength(255)]
    public string TokenHash { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string Purpose { get; set; } = null!; // "OrganizationVerification", "RecruiterInvite", "WorkspaceInvite", "EmailVerification"

    public Guid? UserId { get; set; }

    [ForeignKey(nameof(UserId))]
    public virtual User? User { get; set; }

    public Guid? OrganizationId { get; set; }

    [ForeignKey(nameof(OrganizationId))]
    public virtual Organization? Organization { get; set; }

    public DateTimeOffset ExpiresAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? ConsumedAt { get; set; }

    [MaxLength(45)]
    public string? ConsumedByIp { get; set; }

    [MaxLength(500)]
    public string? ConsumedByUserAgent { get; set; }

    public DateTimeOffset? DeletedAt { get; set; }
}
