using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("pending_organization_ownerships")]
public class PendingOrganizationOwnership
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid OrganizationId { get; set; }

    [ForeignKey(nameof(OrganizationId))]
    public virtual Organization Organization { get; set; } = null!;

    [Required]
    [EmailAddress]
    [MaxLength(255)]
    public string OwnerEmail { get; set; } = null!;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset ExpiresAt { get; set; }

    public DateTimeOffset? ConsumedAt { get; set; }

    public Guid? ConsumedByUserId { get; set; }

    [ForeignKey(nameof(ConsumedByUserId))]
    public virtual User? ConsumedByUser { get; set; }

    public DateTimeOffset? DiscoveryNotifiedAt { get; set; }
}
