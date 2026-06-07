using System.Collections.Generic;
using CVerify.API.Modules.Shared.Domain.Enums;

namespace CVerify.API.Modules.Auth.Services;

public static class OrganizationPermissions
{
    public const string ViewWorkspace = "organization:workspace:view";
    public const string ViewMembers = "organization:members:view";
    public const string ManageMembers = "organization:members:manage";
    public const string EditSettings = "organization:settings:edit";

    private static readonly Dictionary<OrganizationRole, HashSet<string>> RolePermissions = new()
    {
        [OrganizationRole.OWNER] = new() { ViewWorkspace, ViewMembers, ManageMembers, EditSettings },
        [OrganizationRole.REPRESENTATIVE] = new() { ViewWorkspace, ViewMembers, ManageMembers },
        [OrganizationRole.HR] = new() { ViewWorkspace, ViewMembers, ManageMembers },
        [OrganizationRole.MEMBER] = new() { ViewWorkspace, ViewMembers }
    };

    public static bool HasPermission(OrganizationRole role, string permission)
    {
        return RolePermissions.TryGetValue(role, out var permissions) && permissions.Contains(permission);
    }
}
