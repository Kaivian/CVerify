using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("organization_business_roles")]
public class OrganizationBusinessRole
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid OrganizationId { get; set; }

    [ForeignKey(nameof(OrganizationId))]
    public virtual Organization Organization { get; set; } = null!;

    public Guid? ParentRoleId { get; set; }

    [ForeignKey(nameof(ParentRoleId))]
    public virtual OrganizationBusinessRole? ParentRole { get; set; }

    [Required]
    [MaxLength(50)]
    public string Name { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string DisplayName { get; set; } = null!;

    [MaxLength(250)]
    public string? Description { get; set; }

    public bool IsSystem { get; set; }
    public bool IsActive { get; set; } = true;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public virtual ICollection<OrganizationRolePermission> RolePermissions { get; set; } = new List<OrganizationRolePermission>();
    public virtual ICollection<OrganizationBusinessRole> ChildRoles { get; set; } = new List<OrganizationBusinessRole>();
}
