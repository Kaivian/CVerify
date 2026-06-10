using System;
using System.IO;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Shared.Persistence;

/// <summary>
/// Seeds dynamic organization business roles, permissions, and optional test environments.
/// </summary>
public static class BusinessSeeder
{
    public static async Task SeedAsync(ApplicationDbContext context, SeedingSettings seeding)
    {
        if (context == null)
        {
            throw new ArgumentNullException(nameof(context));
        }

        if (seeding == null)
        {
            throw new ArgumentNullException(nameof(seeding));
        }

        // 1. Seed static permissions list into business_permissions
        await SeedStaticPermissionsAsync(context);

        // 2. Fetch all organizations and seed defaults
        await SeedOrganizationDefaultRolesAsync(context);

        // 3. Migrate existing memberships and role assignments
        await MigrateLegacyMembershipsAsync(context);

        // 4. Seeding optional test environments
        if (seeding.SeedTestAccounts)
        {
            await SeedJSONTestAccountsAsync(context, seeding);
        }
    }

    private static async Task SeedStaticPermissionsAsync(ApplicationDbContext context)
    {
        var permissions = new List<(string Name, string DisplayName, string Description, string Module)>
        {
            ("organization:profile:edit", "Edit Profile", "Modify organization public profile, logo, and banner", "Organization"),
            ("organization:settings:edit", "Edit Settings", "Modify organization settings and metadata", "Organization"),
            ("organization:workspace:view", "View Workspace", "Read-only access to assigned workspaces and pipelines", "Workspace"),
            ("organization:roles:manage", "Manage Roles", "Create, edit, and delete custom business roles", "Business Roles"),
            ("organization:roles:view", "View Roles", "Read business roles and permission mapping matrices", "Business Roles"),
            ("organization:members:manage", "Manage Members", "Invite, suspend, and remove organization team members", "People"),
            ("organization:members:view", "View Members", "List and search organization members", "People"),
            ("identity:verification:initiate", "Initiate Verification", "Trigger identity KYC check for a candidate", "Identity"),
            ("identity:verification:approve", "Approve Identity", "Confirm candidate identity verification claims", "Identity"),
            ("identity:verification:reject", "Reject Identity", "Flag candidate identity claims as invalid or fraud", "Identity"),
            ("evidence:graph:validate", "Validate Evidence", "Endorse candidate developer evidence graph contribution blocks", "Evidence Graph"),
            ("evidence:graph:comment", "Comment on Evidence", "Leave peer evaluation comments on candidate contribution nodes", "Evidence Graph"),
            ("analysis:repository:sync", "Sync Repository", "Connect or refresh git source repositories", "Repo Analysis"),
            ("analysis:repository:run", "Run Analysis", "Trigger git code analysis and authorship scans", "Repo Analysis"),
            ("analysis:repository:configure", "Configure Analysis", "Configure analysis rules and repository ignore filters", "Repo Analysis"),
            ("trust:metric:view", "View Trust Metrics", "Read AI authorship ratios, risk scores, and code authenticity reports", "Trust Intel"),
            ("trust:flag:manage", "Manage Trust Flags", "Manually mark anomalies or override warning logs", "Trust Intel"),
            ("ai:interview:configure", "Configure AI Interviews", "Edit automated AI interview templates and parameters", "AI Interviews"),
            ("ai:interview:conduct", "Conduct AI Interviews", "Send AI technical interview session invites to candidates", "AI Interviews"),
            ("ai:interview:evaluate", "Evaluate AI Interviews", "Assess AI generated candidate interview transcripts", "AI Interviews"),
            ("candidate:trust:score", "View Trust Score", "Access aggregate candidate talent trust scorecards", "Trust Scorecard"),
            ("candidate:trust:override", "Override Trust Score", "Manually adjust candidate trust scorecards or clear fraud flags", "Trust Scorecard"),
            ("billing:invoice:view", "View Invoices", "Access invoices, billing summary, and billing cycles", "Billing"),
            ("billing:subscription:manage", "Manage Subscription", "Upgrade or modify organization subscription tiers", "Billing"),
            ("organization:audit:view", "View Audit Logs", "Read organization roles and membership audit log streams", "Audit Logs")
        };

        foreach (var perm in permissions)
        {
            var existing = await context.BusinessPermissions.FirstOrDefaultAsync(p => p.Name == perm.Name);
            if (existing == null)
            {
                context.BusinessPermissions.Add(new BusinessPermission
                {
                    Id = Guid.CreateVersion7(),
                    Name = perm.Name,
                    DisplayName = perm.DisplayName,
                    Description = perm.Description,
                    Module = perm.Module,
                    CreatedAt = DateTimeOffset.UtcNow
                });
            }
            else
            {
                existing.DisplayName = perm.DisplayName;
                existing.Description = perm.Description;
                existing.Module = perm.Module;
            }
        }
        await context.SaveChangesAsync();
    }

    private static async Task SeedOrganizationDefaultRolesAsync(ApplicationDbContext context)
    {
        var orgs = await context.Organizations.ToListAsync();
        foreach (var org in orgs)
        {
            var defaultRoles = new List<(string Name, string DisplayName, string Description, List<string> Perms)>
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

            foreach (var dr in defaultRoles)
            {
                var existingRole = await context.OrganizationBusinessRoles
                    .FirstOrDefaultAsync(r => r.OrganizationId == org.Id && r.Name == dr.Name);

                Guid roleId;
                if (existingRole == null)
                {
                    roleId = Guid.CreateVersion7();
                    var newRole = new OrganizationBusinessRole
                    {
                        Id = roleId,
                        OrganizationId = org.Id,
                        Name = dr.Name,
                        DisplayName = dr.DisplayName,
                        Description = dr.Description,
                        IsSystem = true,
                        IsActive = true,
                        CreatedAt = DateTimeOffset.UtcNow,
                        UpdatedAt = DateTimeOffset.UtcNow
                    };
                    context.OrganizationBusinessRoles.Add(newRole);
                    await context.SaveChangesAsync();
                }
                else
                {
                    roleId = existingRole.Id;
                }

                // Map permissions
                var existingPermissions = await context.OrganizationRolePermissions
                    .Where(rp => rp.RoleId == roleId)
                    .ToListAsync();
                context.OrganizationRolePermissions.RemoveRange(existingPermissions);
                await context.SaveChangesAsync();

                List<Guid> permGuids;
                if (dr.Perms.Contains("*"))
                {
                    permGuids = await context.BusinessPermissions.Select(p => p.Id).ToListAsync();
                }
                else
                {
                    permGuids = await context.BusinessPermissions
                        .Where(p => dr.Perms.Contains(p.Name))
                        .Select(p => p.Id)
                        .ToListAsync();
                }

                foreach (var pId in permGuids)
                {
                    context.OrganizationRolePermissions.Add(new OrganizationRolePermission
                    {
                        RoleId = roleId,
                        PermissionId = pId,
                        AssignedAt = DateTimeOffset.UtcNow
                    });
                }
                await context.SaveChangesAsync();
            }
        }
    }

    private static async Task MigrateLegacyMembershipsAsync(ApplicationDbContext context)
    {
        // Migrate existing memberships from organization_memberships
        var memberships = await context.OrganizationMemberships.ToListAsync();
        foreach (var mem in memberships)
        {
            var roleName = mem.Role.ToLower() switch
            {
                "owner" => "owner",
                "representative" => "administrator",
                "hr" => "hr_manager",
                _ => "viewer"
            };

            var roleId = await context.OrganizationBusinessRoles
                .Where(r => r.OrganizationId == mem.OrganizationId && r.Name == roleName)
                .Select(r => r.Id)
                .FirstOrDefaultAsync();

            if (roleId != Guid.Empty)
            {
                var exists = await context.OrganizationRoleAssignments
                    .AnyAsync(ra => ra.OrganizationId == mem.OrganizationId && ra.UserId == mem.UserId && ra.ScopeType == "ORGANIZATION");

                if (!exists)
                {
                    var assignment = new OrganizationRoleAssignment
                    {
                        Id = Guid.CreateVersion7(),
                        OrganizationId = mem.OrganizationId,
                        UserId = mem.UserId,
                        RoleId = roleId,
                        ScopeType = "ORGANIZATION",
                        ScopeId = mem.OrganizationId,
                        AssignedAt = DateTimeOffset.UtcNow
                    };
                    context.OrganizationRoleAssignments.Add(assignment);
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

            var roleId = await context.OrganizationBusinessRoles
                .Where(r => r.OrganizationId == wsm.Workspace.OrganizationId && r.Name == roleName)
                .Select(r => r.Id)
                .FirstOrDefaultAsync();

            if (roleId != Guid.Empty)
            {
                var exists = await context.OrganizationRoleAssignments
                    .AnyAsync(ra => ra.OrganizationId == wsm.Workspace.OrganizationId && ra.UserId == wsm.UserId && ra.ScopeType == "WORKSPACE" && ra.ScopeId == wsm.WorkspaceId);

                if (!exists)
                {
                    var assignment = new OrganizationRoleAssignment
                    {
                        Id = Guid.CreateVersion7(),
                        OrganizationId = wsm.Workspace.OrganizationId,
                        UserId = wsm.UserId,
                        RoleId = roleId,
                        ScopeType = "WORKSPACE",
                        ScopeId = wsm.WorkspaceId,
                        AssignedAt = DateTimeOffset.UtcNow
                    };
                    context.OrganizationRoleAssignments.Add(assignment);
                }
            }
        }

        await context.SaveChangesAsync();
    }

    private static async Task SeedJSONTestAccountsAsync(ApplicationDbContext context, SeedingSettings seeding)
    {
        var seedPath = seeding.SeedDataPath;
        if (!Path.IsPathRooted(seedPath))
        {
            seedPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, seeding.SeedDataPath);
            if (!File.Exists(seedPath))
            {
                seedPath = Path.Combine(Directory.GetCurrentDirectory(), seeding.SeedDataPath);
            }
        }

        if (!File.Exists(seedPath))
        {
            throw new FileNotFoundException($"Fatal: Seed data file not found at '{seedPath}'.");
        }

        var jsonString = await File.ReadAllTextAsync(seedPath);
        var options = new global::System.Text.Json.JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        };
        var seedData = global::System.Text.Json.JsonSerializer.Deserialize<SeedData>(jsonString, options);
        if (seedData == null)
        {
            throw new InvalidOperationException("Failed to deserialize seed business data.");
        }

        foreach (var org in seedData.Organizations)
        {
            // Seed Organization (idempotent, skips if taxCode already exists)
            var sqlOrg = @"
                INSERT INTO organizations (id, name, tax_code, email, username, is_verified, verification_level, status, initial_admin_assigned_at)
                VALUES (@id, @name, @taxCode, @email, @username, TRUE, @verificationLevel, @status, NOW())
                ON CONFLICT (tax_code) DO NOTHING;
            ";
            await context.Database.ExecuteSqlRawAsync(sqlOrg,
                new NpgsqlParameter("@id", org.Id),
                new NpgsqlParameter("@name", org.Name),
                new NpgsqlParameter("@taxCode", org.TaxCode),
                new NpgsqlParameter("@email", org.Email),
                new NpgsqlParameter("@username", org.Username),
                new NpgsqlParameter("@verificationLevel", org.VerificationLevel),
                new NpgsqlParameter("@status", org.Status)
            );

            // Seed Organization Credential
            var sqlCred = @"
                INSERT INTO organization_credentials (organization_id, username, password_hash)
                VALUES (@orgId, @username, crypt(@password, gen_salt('bf', 10)))
                ON CONFLICT (organization_id) DO NOTHING;
            ";
            await context.Database.ExecuteSqlRawAsync(sqlCred,
                new NpgsqlParameter("@orgId", org.Id),
                new NpgsqlParameter("@username", org.Username),
                new NpgsqlParameter("@password", seeding.BusinessPassword!)
            );

            // Seed Org Users
            foreach (var user in org.Users)
            {
                var sqlUser = @"
                    INSERT INTO users (id, email, password_hash, full_name, status, email_verified_at)
                    VALUES (@id, @email, crypt(@password, gen_salt('bf', 10)), @fullName, 'ACTIVE', NOW())
                    ON CONFLICT (email) DO NOTHING;
                ";
                await context.Database.ExecuteSqlRawAsync(sqlUser,
                    new NpgsqlParameter("@id", user.Id),
                    new NpgsqlParameter("@email", user.Email),
                    new NpgsqlParameter("@password", seeding.BusinessPassword!),
                    new NpgsqlParameter("@fullName", user.FullName)
                );

                // Seed system user roles junction (USER system role)
                var sqlSysRole = @"
                    INSERT INTO user_roles (user_id, role_id)
                    SELECT @userId, id FROM roles WHERE name = 'USER'
                    ON CONFLICT DO NOTHING;
                ";
                await context.Database.ExecuteSqlRawAsync(sqlSysRole,
                    new NpgsqlParameter("@userId", user.Id)
                );

                // Seed organizational membership
                var sqlMembership = @"
                    INSERT INTO organization_memberships (id, organization_id, user_id, role, status)
                    VALUES (@membershipId, @orgId, @userId, @role, 'active')
                    ON CONFLICT (organization_id, user_id) DO NOTHING;
                ";
                await context.Database.ExecuteSqlRawAsync(sqlMembership,
                    new NpgsqlParameter("@membershipId", user.MembershipId),
                    new NpgsqlParameter("@orgId", org.Id),
                    new NpgsqlParameter("@userId", user.Id),
                    new NpgsqlParameter("@role", user.OrgRole)
                );
            }

            // Seed Workspaces
            foreach (var ws in org.Workspaces)
            {
                var sqlWs = @"
                    INSERT INTO workspaces (id, organization_id, display_name, slug, status)
                    VALUES (@id, @orgId, @displayName, @slug, @status)
                    ON CONFLICT (slug) DO NOTHING;
                ";
                await context.Database.ExecuteSqlRawAsync(sqlWs,
                    new NpgsqlParameter("@id", ws.Id),
                    new NpgsqlParameter("@orgId", org.Id),
                    new NpgsqlParameter("@displayName", ws.DisplayName),
                    new NpgsqlParameter("@slug", ws.Slug),
                    new NpgsqlParameter("@status", ws.Status)
                );

                // Seed Workspace Members
                foreach (var member in ws.Members)
                {
                    var sqlWsMember = @"
                        INSERT INTO workspace_members (id, workspace_id, user_id, role)
                        VALUES (@id, @wsId, @userId, @role)
                        ON CONFLICT (workspace_id, user_id) DO NOTHING;
                    ";
                    await context.Database.ExecuteSqlRawAsync(sqlWsMember,
                        new NpgsqlParameter("@id", member.Id),
                        new NpgsqlParameter("@wsId", ws.Id),
                        new NpgsqlParameter("@userId", member.UserId),
                        new NpgsqlParameter("@role", member.Role)
                    );
                }
            }
        }

        // Seed cross organizational memberships
        foreach (var cm in seedData.CrossMemberships)
        {
            var sqlCm = @"
                INSERT INTO organization_memberships (id, organization_id, user_id, role, status)
                VALUES (@id, @orgId, @userId, @role, @status)
                ON CONFLICT (organization_id, user_id) DO NOTHING;
            ";
            await context.Database.ExecuteSqlRawAsync(sqlCm,
                new NpgsqlParameter("@id", cm.Id),
                new NpgsqlParameter("@orgId", cm.OrganizationId),
                new NpgsqlParameter("@userId", cm.UserId),
                new NpgsqlParameter("@role", cm.Role),
                new NpgsqlParameter("@status", cm.Status)
            );
        }
    }

    private class SeedData
    {
        public List<SeedOrganization> Organizations { get; set; } = new();
        public List<SeedCrossMembership> CrossMemberships { get; set; } = new();
    }

    private class SeedOrganization
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = null!;
        public string TaxCode { get; set; } = null!;
        public string Email { get; set; } = null!;
        public string Username { get; set; } = null!;
        public int VerificationLevel { get; set; }
        public string Status { get; set; } = null!;
        public List<SeedWorkspace> Workspaces { get; set; } = new();
        public List<SeedUser> Users { get; set; } = new();
    }

    private class SeedWorkspace
    {
        public Guid Id { get; set; }
        public string DisplayName { get; set; } = null!;
        public string Slug { get; set; } = null!;
        public string Status { get; set; } = null!;
        public List<SeedWorkspaceMember> Members { get; set; } = new();
    }

    private class SeedWorkspaceMember
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public string Role { get; set; } = null!;
    }

    private class SeedUser
    {
        public Guid Id { get; set; }
        public string Email { get; set; } = null!;
        public string FullName { get; set; } = null!;
        public Guid MembershipId { get; set; }
        public string OrgRole { get; set; } = null!;
    }

    private class SeedCrossMembership
    {
        public Guid Id { get; set; }
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public string Role { get; set; } = null!;
        public string Status { get; set; } = null!;
    }
}
