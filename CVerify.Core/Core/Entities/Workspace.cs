using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Core.Entities;

public class Workspace
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
    public string DisplayName { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string Slug { get; set; } = null!;

    public string? Branding { get; set; }

    [Required]
    [MaxLength(50)]
    public string Status { get; set; } = "active"; // "active", "recovery_pending", "frozen", "disputed", "disputed_archived", "archived", "superseded", "fraudulent"

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? DeletedAt { get; set; }
}
