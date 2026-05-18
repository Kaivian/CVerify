using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using CVerify.API.Modules.Auth.Entities;

namespace CVerify.API.Modules.SourceCode.Entities;

public class ExternalOrganization
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid AuthProviderId { get; set; }

    [ForeignKey(nameof(AuthProviderId))]
    public virtual AuthProvider AuthProvider { get; set; } = null!;

    [Required]
    [MaxLength(255)]
    public string ExternalId { get; set; } = null!;

    [Required]
    [MaxLength(255)]
    public string Name { get; set; } = null!;

    [Required]
    [MaxLength(255)]
    public string Login { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string Type { get; set; } = null!; // "github", "gitlab"

    [MaxLength(1000)]
    public string? AvatarUrl { get; set; }

    [MaxLength(1000)]
    public string? HtmlUrl { get; set; }

    [MaxLength(2000)]
    public string? Description { get; set; }

    [Required]
    public bool IsActive { get; set; } = true;

    [Required]
    public DateTimeOffset LastSyncedAt { get; set; } = DateTimeOffset.UtcNow;
}
