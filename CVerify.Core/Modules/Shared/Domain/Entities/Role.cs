using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

public class Role
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    [MaxLength(50)]
    public string Name { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string DisplayName { get; set; } = null!;

    public string? Description { get; set; }

    [Required]
    [MaxLength(30)]
    public string Domain { get; set; } = "SYSTEM"; // "SYSTEM" or "TENANT"

    public Guid? TenantId { get; set; } // OrganizationId for tenant roles

    public Guid? ParentRoleId { get; set; }

    [ForeignKey(nameof(ParentRoleId))]
    public virtual Role? ParentRole { get; set; }

    public virtual ICollection<Role> ChildRoles { get; set; } = new List<Role>();

    public bool IsSystem { get; set; }
    public bool IsActive { get; set; } = true;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? DeletedAt { get; set; }

    public virtual ICollection<User> Users { get; set; } = new List<User>();
    public virtual ICollection<Permission> Permissions { get; set; } = new List<Permission>();

    [ConcurrencyCheck]
    public uint Version { get; set; } // Map PostgreSQL xmin system column
}
