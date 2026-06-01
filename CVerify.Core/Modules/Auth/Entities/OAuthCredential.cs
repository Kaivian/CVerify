using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Auth.Entities;

public class OAuthCredential
{
    [Key]
    [ForeignKey(nameof(AuthProvider))]
    public Guid AuthProviderId { get; set; }

    public virtual AuthProvider AuthProvider { get; set; } = null!;

    [Required]
    [MaxLength(1000)]
    public string EncryptedAccessToken { get; set; } = null!;

    [MaxLength(1000)]
    public string? EncryptedRefreshToken { get; set; }

    public DateTimeOffset? ExpiresAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
