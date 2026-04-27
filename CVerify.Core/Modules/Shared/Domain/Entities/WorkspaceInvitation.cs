using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

public class WorkspaceInvitation
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid WorkspaceId { get; set; }

    [ForeignKey(nameof(WorkspaceId))]
    public virtual Workspace Workspace { get; set; } = null!;

    [Required]
    [MaxLength(255)]
    public string InviteeEmail { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string Role { get; set; } = null!;

    public Guid? InvitedByUserId { get; set; }

    [ForeignKey(nameof(InvitedByUserId))]
    public virtual User? InvitedByUser { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset ExpiresAt { get; set; }

    public DateTimeOffset? ConsumedAt { get; set; }

    public Guid? ConsumedByUserId { get; set; }

    [ForeignKey(nameof(ConsumedByUserId))]
    public virtual User? ConsumedByUser { get; set; }
}
