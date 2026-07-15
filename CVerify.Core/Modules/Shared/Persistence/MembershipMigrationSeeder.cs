using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Shared.Persistence;

public class MembershipMigrationSeeder : ISeederModule
{
    public string ModuleId => "MembershipMigrationSeeder";
    public string Version => "1.0.0";
    public IReadOnlyCollection<string> Dependencies => new[] { "TenantRoleSeeder" };

    public async Task<SeederResult> SeedAsync(ApplicationDbContext context, SeedingConfig config)
    {
        if (context == null) throw new ArgumentNullException(nameof(context));

        var memberships = await context.OrganizationMemberships.ToListAsync();
        int affected = 0;
        foreach (var mem in memberships)
        {
            var roleName = mem.Role.ToLower() switch
            {
                "owner" => "owner",
                "representative" => "administrator",
                "hr" => "hr_manager",
                _ => "viewer"
            };

            var roleId = await context.Roles
                .Where(r => r.TenantId == mem.OrganizationId && r.Name == roleName && r.Domain == "TENANT")
                .Select(r => r.Id)
                .FirstOrDefaultAsync();

            if (roleId != Guid.Empty)
            {
                var exists = await context.RoleAssignments
                    .AnyAsync(ra => ra.UserId == mem.UserId && ra.RoleId == roleId && ra.ScopeType == "ORGANIZATION" && ra.ScopeId == mem.OrganizationId);

                if (!exists)
                {
                    var assignment = new RoleAssignment
                    {
                        Id = Guid.CreateVersion7(),
                        UserId = mem.UserId,
                        RoleId = roleId,
                        ScopeType = "ORGANIZATION",
                        ScopeId = mem.OrganizationId,
                        AssignedAt = DateTimeOffset.UtcNow
                    };
                    context.RoleAssignments.Add(assignment);
                    affected++;
                }
            }
        }

        // Migrate workspace members
        var wsMembers = await context.WorkspaceMembers.Include(wm => wm.Workspace).ToListAsync();
        foreach (var wsm in wsMembers)
        {
            if (wsm.Workspace == null) continue;

            var roleName = wsm.Role.ToLower() switch
            {
                "workspace_admin" => "administrator",
                "manager" => "hiring_manager",
                "editor" => "recruiter",
                _ => "viewer"
            };

            var roleId = await context.Roles
                .Where(r => r.TenantId == wsm.Workspace.OrganizationId && r.Name == roleName && r.Domain == "TENANT")
                .Select(r => r.Id)
                .FirstOrDefaultAsync();

            if (roleId != Guid.Empty)
            {
                var exists = await context.RoleAssignments
                    .AnyAsync(ra => ra.UserId == wsm.UserId && ra.RoleId == roleId && ra.ScopeType == "WORKSPACE" && ra.ScopeId == wsm.WorkspaceId);

                if (!exists)
                {
                    var assignment = new RoleAssignment
                    {
                        Id = Guid.CreateVersion7(),
                        UserId = wsm.UserId,
                        RoleId = roleId,
                        ScopeType = "WORKSPACE",
                        ScopeId = wsm.WorkspaceId,
                        AssignedAt = DateTimeOffset.UtcNow
                    };
                    context.RoleAssignments.Add(assignment);
                    affected++;
                }
            }
        }

        await context.SaveChangesAsync();
        return new SeederResult(ModuleId, SeedingStatus.Success, "Membership compatibility migration completed.", affected);
    }
}
