using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("admin_invitation_roles")]
public class AdminInvitationRole
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid InvitationId { get; set; }

    [ForeignKey(nameof(InvitationId))]
    public virtual AdminInvitation Invitation { get; set; } = null!;

    [Required]
    public Guid RoleId { get; set; }

    [ForeignKey(nameof(RoleId))]
    public virtual AdminRole Role { get; set; } = null!;
}
