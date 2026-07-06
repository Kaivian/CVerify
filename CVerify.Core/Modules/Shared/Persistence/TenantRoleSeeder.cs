using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Shared.Persistence;

public class TenantRoleSeeder : IValidatableSeeder
{
    public string ModuleId => "TenantRoleSeeder";
    public string Version => "1.0.0";
    public IReadOnlyCollection<string> Dependencies => new[] { "PermissionSeeder" };

    public async Task<SeederResult> SeedAsync(ApplicationDbContext context, SeedingConfig config)
    {
        if (context == null) throw new ArgumentNullException(nameof(context));

        // Find organizations that don't have any roles defined
        var orgsWithoutRoles = await context.Organizations
            .Where(org => !context.Roles.Any(r => r.TenantId == org.Id && r.Domain == "TENANT"))
            .ToListAsync();

        if (!orgsWithoutRoles.Any())
        {
            return new SeederResult(ModuleId, SeedingStatus.Success, "All organizations already have tenant roles initialized. Skipped loop.", 0);
        }

        var defaultRoles = GetDefaultRolesDefinition();
        int affected = 0;

        foreach (var org in orgsWithoutRoles)
        {
            foreach (var dr in defaultRoles)
            {
                var role = new Role
                {
                    Id = Guid.CreateVersion7(),
                    TenantId = org.Id,
                    Name = dr.Name,
                    DisplayName = dr.DisplayName,
                    Description = dr.Description,
                    Domain = "TENANT",
                    IsSystem = true,
                    IsActive = true,
                    CreatedAt = DateTimeOffset.UtcNow,
                    UpdatedAt = DateTimeOffset.UtcNow
                };
                context.Roles.Add(role);
                affected++;

                // Map permissions
                List<Permission> dbPermissions;
                if (dr.Perms.Contains("*"))
                {
                    dbPermissions = await context.Permissions.ToListAsync();
                }
                else
                {
                    dbPermissions = await context.Permissions
                        .Where(p => dr.Perms.Contains(p.Name))
                        .ToListAsync();
                }

                foreach (var p in dbPermissions)
                {
                    role.Permissions.Add(p);
                }
            }
        }

        await context.SaveChangesAsync();
        return new SeederResult(ModuleId, SeedingStatus.Success, $"Tenant roles backfilled for {orgsWithoutRoles.Count} organizations.", affected);
    }

    private List<(string Name, string DisplayName, string Description, List<string> Perms)> GetDefaultRolesDefinition()
    {
        return new List<(string Name, string DisplayName, string Description, List<string> Perms)>
        {
            ("owner", "Owner", "Full administrative control, billing, and member deletion", new List<string> { "*" }),
            ("administrator", "Administrator", "General admin access except billing and legal recovery", new List<string> {
                "organization:profile:edit", "organization:settings:edit", "organization:workspaces:view", "organization:workspaces:create",
                "organization:workspaces:update", "organization:workspaces:delete", "workspace:settings:update", "workspace:members:manage",
                "organization:roles:manage", "organization:roles:view",
                "organization:members:manage", "organization:members:view", "identity:verification:initiate", "identity:verification:approve",
                "identity:verification:reject", "evidence:graph:validate", "evidence:graph:comment", "analysis:repository:sync",
                "analysis:repository:run", "analysis:repository:configure", "trust:metric:view", "trust:flag:manage",
                "ai:interview:configure", "ai:interview:conduct", "ai:interview:evaluate", "candidate:trust:score",
                "candidate:trust:override", "organization:audit:view"
            }),
            ("hr_manager", "HR Manager", "Manage recruiters, create jobs, and screen candidate profiles", new List<string> {
                "organization:workspaces:view", "workspace:members:manage", "organization:roles:view", "organization:members:manage", "organization:members:view", "identity:verification:initiate",
                "identity:verification:approve", "identity:verification:reject", "evidence:graph:comment", "analysis:repository:sync",
                "analysis:repository:run", "analysis:repository:configure", "trust:metric:view", "trust:flag:manage",
                "ai:interview:configure", "ai:interview:conduct", "ai:interview:evaluate", "candidate:trust:score",
                "candidate:trust:override", "organization:audit:view"
            }),
            ("recruiter", "Recruiter", "Create and publish jobs, sync source code repos, and conduct interviews", new List<string> {
                "organization:workspaces:view", "organization:roles:view", "organization:members:view", "identity:verification:initiate", "evidence:graph:comment",
                "analysis:repository:sync", "analysis:repository:run", "analysis:repository:configure", "trust:metric:view",
                "ai:interview:configure", "ai:interview:conduct", "ai:interview:evaluate", "candidate:trust:score"
            }),
            ("hiring_manager", "Hiring Manager", "Evaluate candidates and manage job scorecard approvals", new List<string> {
                "organization:workspaces:view", "organization:roles:view", "organization:members:view", "evidence:graph:validate", "evidence:graph:comment",
                "analysis:repository:run", "trust:metric:view", "trust:flag:manage", "ai:interview:conduct",
                "ai:interview:evaluate", "candidate:trust:score", "candidate:trust:override"
            }),
            ("tech_interviewer", "Technical Interviewer", "Conduct technical assessments and evaluate git repository metrics", new List<string> {
                "organization:workspaces:view", "organization:roles:view", "organization:members:view", "evidence:graph:validate", "evidence:graph:comment",
                "analysis:repository:run", "analysis:repository:configure", "trust:metric:view", "trust:flag:manage",
                "ai:interview:evaluate", "candidate:trust:score"
            }),
            ("viewer", "Viewer", "Read-only access to assigned workspaces and pipelines", new List<string> {
                "organization:workspaces:view", "organization:roles:view", "organization:members:view", "candidate:trust:score"
            })
        };
    }

    public async Task<ValidationResult> ValidateAsync(ApplicationDbContext context)
    {
        var orgs = await context.Organizations.ToListAsync();
        foreach (var org in orgs)
        {
            var hasRole = await context.Roles.AnyAsync(r => r.TenantId == org.Id && r.Domain == "TENANT");
            if (!hasRole)
            {
                return new ValidationResult(false, $"Organization '{org.Name}' ({org.Id}) is missing tenant roles.");
            }
        }
        return new ValidationResult(true);
    }
}
