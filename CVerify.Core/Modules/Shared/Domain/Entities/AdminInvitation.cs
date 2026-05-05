using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("admin_invitations")]
public class AdminInvitation
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    [EmailAddress]
    [MaxLength(255)]
    [Column(TypeName = "citext")]
    public string InviteeEmail { get; set; } = null!;

    [Required]
    [MaxLength(64)]
    public string TokenHash { get; set; } = null!;

    public Guid? InvitedByUserId { get; set; }

    [ForeignKey(nameof(InvitedByUserId))]
    public virtual User? InvitedByUser { get; set; }

    [Required]
    [MaxLength(30)]
    public string Status { get; set; } = "Pending"; // Pending, Accepted, Cancelled, Expired

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? AcceptedAt { get; set; }
    public Guid? ConsumedByUserId { get; set; }

    [ForeignKey(nameof(ConsumedByUserId))]
    public virtual User? ConsumedByUser { get; set; }

    public virtual ICollection<AdminInvitationRole> PreAssignedRoles { get; set; } = new List<AdminInvitationRole>();
}
