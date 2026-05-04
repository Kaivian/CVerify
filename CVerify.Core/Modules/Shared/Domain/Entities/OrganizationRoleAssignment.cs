using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("organization_role_assignments")]
public class OrganizationRoleAssignment
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid OrganizationId { get; set; }

    [ForeignKey(nameof(OrganizationId))]
    public virtual Organization Organization { get; set; } = null!;

    [Required]
    public Guid UserId { get; set; }

    [ForeignKey(nameof(UserId))]
    public virtual User User { get; set; } = null!;

    [Required]
    public Guid RoleId { get; set; }

    [ForeignKey(nameof(RoleId))]
    public virtual OrganizationBusinessRole Role { get; set; } = null!;

    [Required]
    [MaxLength(30)]
    public string ScopeType { get; set; } = "ORGANIZATION"; // e.g. "ORGANIZATION", "WORKSPACE", "TEAM"

    [Required]
    public Guid ScopeId { get; set; } // Points to OrganizationId, WorkspaceId, etc. depending on ScopeType

    public DateTimeOffset AssignedAt { get; set; } = DateTimeOffset.UtcNow;
}
