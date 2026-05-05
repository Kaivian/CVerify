using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("admin_roles")]
public class AdminRole
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    public Guid? ParentRoleId { get; set; }

    [ForeignKey(nameof(ParentRoleId))]
    public virtual AdminRole? ParentRole { get; set; }

    public virtual ICollection<AdminRole> ChildRoles { get; set; } = new List<AdminRole>();

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

    [Required]
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    [Required]
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    [ConcurrencyCheck]
    public uint Version { get; set; } // Map PostgreSQL xmin system column

    public virtual ICollection<AdminRolePermission> RolePermissions { get; set; } = new List<AdminRolePermission>();
}
