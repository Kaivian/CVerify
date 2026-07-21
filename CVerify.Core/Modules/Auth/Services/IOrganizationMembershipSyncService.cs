using System;
using System.Threading;
using System.Threading.Tasks;

namespace CVerify.API.Modules.Auth.Services;

public interface IOrganizationMembershipSyncService
{
    /// <summary>
    /// Synchronizes the cached display role on the OrganizationMembership record based on the user's active RoleAssignments.
    /// </summary>
    Task SynchronizeMembershipRoleAsync(Guid orgId, Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Traverses the role inheritance tree to dynamically resolve the display category (OWNER, REPRESENTATIVE, HR, MEMBER).
    /// </summary>
    Task<string> ResolveDisplayRoleFromHierarchyAsync(Guid orgId, Guid roleId, CancellationToken cancellationToken = default);
}
