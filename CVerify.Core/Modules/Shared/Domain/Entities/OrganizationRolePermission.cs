using System;
using System.ComponentModel.DataAnnotations.Schema;

namespace CVerify.API.Modules.Shared.Domain.Entities;

[Table("organization_role_permissions")]
public class OrganizationRolePermission
{
    public Guid RoleId { get; set; }

    [ForeignKey(nameof(RoleId))]
    public virtual OrganizationBusinessRole Role { get; set; } = null!;

    public Guid PermissionId { get; set; }

    [ForeignKey(nameof(PermissionId))]
    public virtual BusinessPermission Permission { get; set; } = null!;

    public DateTimeOffset AssignedAt { get; set; } = DateTimeOffset.UtcNow;
}
