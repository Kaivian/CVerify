using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Core.Entities;

public class PendingAuthProvider
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid UserId { get; set; }

    [ForeignKey(nameof(UserId))]
    public virtual User User { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string ProviderName { get; set; } = null!;

    [Required]
    [MaxLength(255)]
    public string ProviderKey { get; set; } = null!;

    [MaxLength(100)]
    public string? ProviderAccountId { get; set; }

    [MaxLength(255)]
    public string? ProviderUsername { get; set; }

    [MaxLength(255)]
    public string? ProviderDisplayName { get; set; }

    [MaxLength(500)]
    public string? ProviderAvatarUrl { get; set; }

    [MaxLength(500)]
    public string? ProviderProfileUrl { get; set; }

    [Required]
    [MaxLength(1000)]
    public string EncryptedAccessToken { get; set; } = null!;

    [MaxLength(1000)]
    public string? EncryptedRefreshToken { get; set; }

    [Required]
    public DateTimeOffset ExpiresAt { get; set; }

    [Required]
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
