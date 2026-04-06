using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Core.Entities;

public enum RecoveryTokenType
{
    CandidatePasswordReset,
    OrganizationRecoveryOtp,
    OrganizationRecoveryReset,
    OrganizationBootstrap
}

public class RecoveryToken
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    public Guid? UserId { get; set; }

    [ForeignKey(nameof(UserId))]
    public virtual User? User { get; set; }

    public Guid? OrganizationId { get; set; }

    [ForeignKey(nameof(OrganizationId))]
    public virtual Organization? Organization { get; set; }

    [Required]
    [MaxLength(255)]
    public string TokenHash { get; set; } = null!;

    [Required]
    public RecoveryTokenType TokenType { get; set; }

    [Required]
    [MaxLength(100)]
    public string Purpose { get; set; } = null!; // "ForgotPassword", "CorporateReclaim", etc.

    public string? MetadataJson { get; set; } // Housed browser, IP, fingerprinting telemetry

    [Required]
    public DateTimeOffset ExpiresAt { get; set; }

    public DateTimeOffset? ConsumedAt { get; set; }

    public DateTimeOffset? RevokedAt { get; set; }

    [Required]
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public bool IsExpired => DateTimeOffset.UtcNow >= ExpiresAt;
    public bool IsConsumed => ConsumedAt != null;
    public bool IsRevoked => RevokedAt != null;
    public bool IsActive => !IsConsumed && !IsExpired && !IsRevoked;

    [ConcurrencyCheck]
    public uint Version { get; set; } // Map PostgreSQL xmin system column
}
