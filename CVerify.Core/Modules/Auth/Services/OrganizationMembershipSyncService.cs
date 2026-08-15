using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Persistence;

namespace CVerify.API.Modules.Auth.Services;

public class OrganizationMembershipSyncService : IOrganizationMembershipSyncService
{
    private readonly ApplicationDbContext _context;

    public OrganizationMembershipSyncService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<string> ResolveDisplayRoleFromHierarchyAsync(Guid orgId, Guid roleId, CancellationToken cancellationToken = default)
    {
        var visited = new HashSet<Guid>();
        var currentRoleId = roleId;

        while (currentRoleId != Guid.Empty && !visited.Contains(currentRoleId))
        {
            visited.Add(currentRoleId);

            var role = await _context.Roles
                .AsNoTracking()
                .FirstOrDefaultAsync(r => r.Id == currentRoleId && r.TenantId == orgId, cancellationToken);

            if (role == null)
            {
                break;
            }

            var name = role.Name.Trim().ToLowerInvariant();
            if (name == "owner")
            {
                return "OWNER";
            }
            if (name == "administrator")
            {
                return "REPRESENTATIVE";
            }
            if (name == "hr_manager")
            {
                return "HR";
            }

            if (role.ParentRoleId.HasValue)
            {
                currentRoleId = role.ParentRoleId.Value;
            }
            else
            {
                break;
            }
        }

        return "MEMBER";
    }

    public async Task SynchronizeMembershipRoleAsync(Guid orgId, Guid userId, CancellationToken cancellationToken = default)
    {
        var membership = await _context.OrganizationMemberships
            .FirstOrDefaultAsync(om => om.OrganizationId == orgId && om.UserId == userId, cancellationToken);

        if (membership == null)
        {
            return;
        }

        // Fetch all organization-scoped role assignments for the user in this organization
        var assignments = await _context.RoleAssignments
            .AsNoTracking()
            .Where(ra => ra.UserId == userId && ra.ScopeType == "ORGANIZATION" && ra.ScopeId == orgId)
            .ToListAsync(cancellationToken);

        string targetRole = "MEMBER";

        if (assignments.Any())
        {
            var resolvedCategories = new List<string>();
            foreach (var ra in assignments)
            {
                var category = await ResolveDisplayRoleFromHierarchyAsync(orgId, ra.RoleId, cancellationToken);
                resolvedCategories.Add(category);
            }

            if (resolvedCategories.Contains("OWNER"))
            {
                targetRole = "OWNER";
            }
            else if (resolvedCategories.Contains("REPRESENTATIVE"))
            {
                targetRole = "REPRESENTATIVE";
            }
            else if (resolvedCategories.Contains("HR"))
            {
                targetRole = "HR";
            }
        }

        if (membership.Role != targetRole)
        {
            membership.Role = targetRole;
            await _context.SaveChangesAsync(cancellationToken);
        }
    }
}
