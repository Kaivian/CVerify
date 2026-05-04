using System.Collections.Generic;
using System.Linq;
using CVerify.API.Modules.Shared.Domain.Enums;

namespace CVerify.API.Modules.Auth.Services;

public static class OrganizationPermissions
{
    public const string ViewWorkspace = "organization:workspace:view";
    public const string ViewMembers = "organization:members:view";
    public const string ManageMembers = "organization:members:manage";
    public const string EditSettings = "organization:settings:edit";
    public const string EditProfile = "organization:profile:edit";

    private static readonly Dictionary<OrganizationRole, HashSet<string>> RolePermissions = new()
    {
        [OrganizationRole.OWNER] = new() { ViewWorkspace, ViewMembers, ManageMembers, EditSettings, EditProfile },
        [OrganizationRole.REPRESENTATIVE] = new() { ViewWorkspace, ViewMembers, ManageMembers, EditProfile },
        [OrganizationRole.HR] = new() { ViewWorkspace, ViewMembers, ManageMembers },
        [OrganizationRole.MEMBER] = new() { ViewWorkspace, ViewMembers }
    };

    public static bool HasPermission(OrganizationRole role, string permission)
    {
        return RolePermissions.TryGetValue(role, out var permissions) && permissions.Contains(permission);
    }

    public static List<string> GetPermissionsForRole(OrganizationRole role)
    {
        if (RolePermissions.TryGetValue(role, out var permissions))
        {
            return permissions.ToList();
        }
        return new List<string>();
    }
}
