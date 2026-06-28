using System.Collections.Generic;
using System.Linq;
using CVerify.API.Modules.Shared.Domain.Enums;

namespace CVerify.API.Modules.Auth.Services;

public static class OrganizationPermissions
{
    public const string ViewWorkspaces = "organization:workspaces:view";
    public const string CreateWorkspace = "organization:workspaces:create";
    public const string UpdateWorkspace = "organization:workspaces:update";
    public const string DeleteWorkspace = "organization:workspaces:delete";
    public const string UpdateWorkspaceSettings = "workspace:settings:update";
    public const string ManageWorkspaceMembers = "workspace:members:manage";
    public const string ViewMembers = "organization:members:view";
    public const string ManageMembers = "organization:members:manage";
    public const string EditSettings = "organization:settings:edit";
    public const string EditProfile = "organization:profile:edit";

    private static readonly Dictionary<OrganizationRole, HashSet<string>> RolePermissions = new()
    {
        [OrganizationRole.OWNER] = new() { ViewWorkspaces, CreateWorkspace, UpdateWorkspace, DeleteWorkspace, UpdateWorkspaceSettings, ManageWorkspaceMembers, ViewMembers, ManageMembers, EditSettings, EditProfile },
        [OrganizationRole.REPRESENTATIVE] = new() { ViewWorkspaces, ViewMembers, ManageMembers, EditProfile },
        [OrganizationRole.HR] = new() { ViewWorkspaces, ViewMembers, ManageMembers },
        [OrganizationRole.MEMBER] = new() { ViewWorkspaces, ViewMembers }
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
