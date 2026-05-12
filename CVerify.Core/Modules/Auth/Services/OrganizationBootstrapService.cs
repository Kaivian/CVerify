using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Persistence;

namespace CVerify.API.Modules.Auth.Services;

public class OrganizationBootstrapService : IOrganizationBootstrapService
{
    private readonly ApplicationDbContext _context;
    private readonly TimeProvider _timeProvider;

    public OrganizationBootstrapService(ApplicationDbContext context, TimeProvider timeProvider)
    {
        _context = context;
        _timeProvider = timeProvider;
    }

    public async Task BootstrapOrganizationAsync(Guid orgId, Guid creatorUserId, CancellationToken cancellationToken = default)
    {
        // 1. Seed the default roles and mapping for this organization
        await SeedDefaultRolesForTenantAsync(orgId, cancellationToken);

        // 2. Fetch the owner role
        var ownerRole = await _context.Roles
            .FirstOrDefaultAsync(r => r.TenantId == orgId && r.Name == "owner" && r.Domain == "TENANT", cancellationToken);

        if (ownerRole != null)
        {
            // 3. Assign the creator user to the owner role
            var assignmentExists = await _context.RoleAssignments
                .AnyAsync(ra => ra.UserId == creatorUserId && ra.RoleId == ownerRole.Id && ra.ScopeType == "ORGANIZATION" && ra.ScopeId == orgId, cancellationToken);

            if (!assignmentExists)
            {
                _context.RoleAssignments.Add(new RoleAssignment
                {
                    Id = Guid.CreateVersion7(),
                    UserId = creatorUserId,
                    RoleId = ownerRole.Id,
                    ScopeType = "ORGANIZATION",
                    ScopeId = orgId,
                    AssignedAt = _timeProvider.GetUtcNow()
                });
                await _context.SaveChangesAsync(cancellationToken);
            }
        }
    }

    public async Task SeedDefaultRolesForTenantAsync(Guid orgId, CancellationToken cancellationToken = default)
    {
        var defaultRoles = GetDefaultRolesDefinition();

        foreach (var dr in defaultRoles)
        {
            var role = await _context.Roles
                .Include(r => r.Permissions)
                .FirstOrDefaultAsync(r => r.TenantId == orgId && r.Name == dr.Name && r.Domain == "TENANT", cancellationToken);

            if (role == null)
            {
                role = new Role
                {
                    Id = Guid.CreateVersion7(),
                    TenantId = orgId,
                    Name = dr.Name,
                    DisplayName = dr.DisplayName,
                    Description = dr.Description,
                    Domain = "TENANT",
                    IsSystem = true,
                    IsActive = true,
                    CreatedAt = _timeProvider.GetUtcNow(),
                    UpdatedAt = _timeProvider.GetUtcNow()
                };
                _context.Roles.Add(role);
                await _context.SaveChangesAsync(cancellationToken);
            }
            else
            {
                role.DisplayName = dr.DisplayName;
                role.Description = dr.Description;
                role.UpdatedAt = _timeProvider.GetUtcNow();
            }

            // Sync permissions
            role.Permissions.Clear();
            await _context.SaveChangesAsync(cancellationToken);

            List<Permission> dbPermissions;
            if (dr.Perms.Contains("*"))
            {
                dbPermissions = await _context.Permissions.ToListAsync(cancellationToken);
            }
            else
            {
                dbPermissions = await _context.Permissions
                    .Where(p => dr.Perms.Contains(p.Name))
                    .ToListAsync(cancellationToken);
            }

            foreach (var p in dbPermissions)
            {
                role.Permissions.Add(p);
            }
            await _context.SaveChangesAsync(cancellationToken);
        }
    }

    private List<(string Name, string DisplayName, string Description, List<string> Perms)> GetDefaultRolesDefinition()
    {
        return new List<(string Name, string DisplayName, string Description, List<string> Perms)>
        {
            ("owner", "Owner", "Full administrative control, billing, and member deletion", new List<string> { "*" }),
            ("administrator", "Administrator", "General admin access except billing and legal recovery", new List<string> {
                "organization:profile:edit", "organization:settings:edit", "organization:workspace:view", "organization:roles:manage", "organization:roles:view",
                "organization:members:manage", "organization:members:view", "identity:verification:initiate", "identity:verification:approve",
                "identity:verification:reject", "evidence:graph:validate", "evidence:graph:comment", "analysis:repository:sync",
                "analysis:repository:run", "analysis:repository:configure", "trust:metric:view", "trust:flag:manage",
                "ai:interview:configure", "ai:interview:conduct", "ai:interview:evaluate", "candidate:trust:score",
                "candidate:trust:override", "organization:audit:view"
            }),
            ("hr_manager", "HR Manager", "Manage recruiters, create jobs, and screen candidate profiles", new List<string> {
                "organization:workspace:view", "organization:roles:view", "organization:members:manage", "organization:members:view", "identity:verification:initiate",
                "identity:verification:approve", "identity:verification:reject", "evidence:graph:comment", "analysis:repository:sync",
                "analysis:repository:run", "analysis:repository:configure", "trust:metric:view", "trust:flag:manage",
                "ai:interview:configure", "ai:interview:conduct", "ai:interview:evaluate", "candidate:trust:score",
                "candidate:trust:override", "organization:audit:view"
            }),
            ("recruiter", "Recruiter", "Create and publish jobs, sync source code repos, and conduct interviews", new List<string> {
                "organization:workspace:view", "organization:roles:view", "organization:members:view", "identity:verification:initiate", "evidence:graph:comment",
                "analysis:repository:sync", "analysis:repository:run", "analysis:repository:configure", "trust:metric:view",
                "ai:interview:configure", "ai:interview:conduct", "ai:interview:evaluate", "candidate:trust:score"
            }),
            ("hiring_manager", "Hiring Manager", "Evaluate candidates and manage job scorecard approvals", new List<string> {
                "organization:workspace:view", "organization:roles:view", "organization:members:view", "evidence:graph:validate", "evidence:graph:comment",
                "analysis:repository:run", "trust:metric:view", "trust:flag:manage", "ai:interview:conduct",
                "ai:interview:evaluate", "candidate:trust:score", "candidate:trust:override"
            }),
            ("tech_interviewer", "Technical Interviewer", "Conduct technical assessments and evaluate git repository metrics", new List<string> {
                "organization:workspace:view", "organization:roles:view", "organization:members:view", "evidence:graph:validate", "evidence:graph:comment",
                "analysis:repository:run", "analysis:repository:configure", "trust:metric:view", "trust:flag:manage",
                "ai:interview:evaluate", "candidate:trust:score"
            }),
            ("viewer", "Viewer", "Read-only access to assigned workspaces and pipelines", new List<string> {
                "organization:workspace:view", "organization:roles:view", "organization:members:view", "candidate:trust:score"
            })
        };
    }
}
