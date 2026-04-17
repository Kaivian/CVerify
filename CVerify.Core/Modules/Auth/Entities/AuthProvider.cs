using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;

namespace CVerify.API.Modules.Auth.Entities;

public class AuthProvider
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

    [MaxLength(500)]
    public string? ProviderAvatarUrl { get; set; }

    [MaxLength(255)]
    public string? ProviderDisplayName { get; set; }

    [MaxLength(500)]
    public string? ProviderProfileUrl { get; set; }

    [MaxLength(500)]
    public string? GrantedScopes { get; set; }

    public DateTimeOffset? LastScopeValidationAt { get; set; }

    [Required]
    public ProviderScopeStatus ScopeValidationStatus { get; set; } = ProviderScopeStatus.Valid;

    public DateTimeOffset? LastSuccessfulRefreshAt { get; set; }

    public int RefreshFailureCount { get; set; } = 0;

    public DateTimeOffset? LastProviderSyncAt { get; set; }

    [Required]
    [MaxLength(50)]
    public string SyncStatus { get; set; } = "Pending";

    public string? SyncError { get; set; }

    public virtual OAuthCredential? OAuthCredential { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? DeletedAt { get; set; }
}
