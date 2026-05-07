using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("role_assignments")]
public class RoleAssignment
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; } = Guid.CreateVersion7();

    [Required]
    public Guid UserId { get; set; }

    [ForeignKey(nameof(UserId))]
    public virtual User User { get; set; } = null!;

    [Required]
    public Guid RoleId { get; set; }

    [ForeignKey(nameof(RoleId))]
    public virtual Role Role { get; set; } = null!;

    [Required]
    [MaxLength(30)]
    public string ScopeType { get; set; } = null!; // "SYSTEM", "ORGANIZATION", "WORKSPACE", "REPOSITORY"

    [Required]
    public Guid ScopeId { get; set; }

    [Required]
    public DateTimeOffset AssignedAt { get; set; } = DateTimeOffset.UtcNow;
}
