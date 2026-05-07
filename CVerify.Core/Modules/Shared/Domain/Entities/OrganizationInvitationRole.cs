using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("organization_invitation_roles")]
public class OrganizationInvitationRole
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid InvitationId { get; set; }

    [ForeignKey(nameof(InvitationId))]
    public virtual OrganizationInvitation Invitation { get; set; } = null!;

    [Required]
    public Guid RoleId { get; set; }

    [ForeignKey(nameof(RoleId))]
    public virtual Role Role { get; set; } = null!;

    [Required]
    [MaxLength(30)]
    public string ScopeType { get; set; } = "ORGANIZATION";

    [Required]
    public Guid ScopeId { get; set; }
}
