using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("admin_role_assignments")]
public class AdminRoleAssignment
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid AdminMemberId { get; set; }

    [ForeignKey(nameof(AdminMemberId))]
    public virtual AdminMember AdminMember { get; set; } = null!;

    [Required]
    public Guid RoleId { get; set; }

    [ForeignKey(nameof(RoleId))]
    public virtual AdminRole Role { get; set; } = null!;

    [Required]
    [MaxLength(30)]
    public string ScopeType { get; set; } = "SYSTEM";

    [Required]
    public Guid ScopeId { get; set; }

    [Required]
    public DateTimeOffset AssignedAt { get; set; } = DateTimeOffset.UtcNow;
}
