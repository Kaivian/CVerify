using System;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("admin_role_permissions")]
public class AdminRolePermission
{
    public Guid RoleId { get; set; }

    [ForeignKey(nameof(RoleId))]
    public virtual AdminRole Role { get; set; } = null!;

    public Guid PermissionId { get; set; }

    [ForeignKey(nameof(PermissionId))]
    public virtual Permission Permission { get; set; } = null!;

    public DateTimeOffset AssignedAt { get; set; } = DateTimeOffset.UtcNow;
}
