using System;
using System.IO;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Shared.Persistence;

public class DemoUserSeeder : ISeederModule
{
    public string ModuleId => "DemoUserSeeder";
    public string Version => "1.0.0";
    public IReadOnlyCollection<string> Dependencies => new[] { "DemoOrganizationSeeder" };

    public async Task<SeederResult> SeedAsync(ApplicationDbContext context, SeedingConfig config)
    {
        if (context == null) throw new ArgumentNullException(nameof(context));
        if (!config.GenerateDemoData)
        {
            return new SeederResult(ModuleId, SeedingStatus.Skipped, "Demo user seeding skipped because GenerateDemoData is false.");
        }

        var seedPath = config.SeedDataPath;
        if (!Path.IsPathRooted(seedPath))
        {
            seedPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, config.SeedDataPath);
            if (!File.Exists(seedPath))
            {
                seedPath = Path.Combine(Directory.GetCurrentDirectory(), config.SeedDataPath);
            }
        }

        if (!File.Exists(seedPath))
        {
            return new SeederResult(ModuleId, SeedingStatus.Failed, $"Seed data file not found at '{seedPath}'.");
        }

        var jsonString = await File.ReadAllTextAsync(seedPath);
        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        var seedData = JsonSerializer.Deserialize<SeedDataDto>(jsonString, options);
        if (seedData == null)
        {
            return new SeederResult(ModuleId, SeedingStatus.Failed, "Failed to deserialize seed user data.");
        }

        var businessPassword = config.BusinessPassword;
        if (string.IsNullOrWhiteSpace(businessPassword))
        {
            businessPassword = "password123";
        }

        int affected = 0;
        foreach (var org in seedData.Organizations)
        {
            foreach (var user in org.Users)
            {
                var sqlUser = @"
                    INSERT INTO users (id, email, password_hash, full_name, status, email_verified_at)
                    VALUES (@id, @email, crypt(@password, gen_salt('bf', 10)), @fullName, 'ACTIVE', NOW())
                    ON CONFLICT (email) WHERE (deleted_at IS NULL OR status = 'DELETION_PENDING') DO NOTHING;
                ";
                var userResult = await context.Database.ExecuteSqlRawAsync(sqlUser,
                    new NpgsqlParameter("@id", user.Id),
                    new NpgsqlParameter("@email", user.Email),
                    new NpgsqlParameter("@password", businessPassword),
                    new NpgsqlParameter("@fullName", user.FullName)
                );
                if (userResult > 0) affected++;

                // Seed system USER role assignment
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

                // Seed modern organizational role assignment
                var roleName = user.OrgRole.ToLower() switch
                {
                    "owner" => "owner",
                    "representative" => "administrator",
                    "hr" => "hr_manager",
                    _ => "viewer"
                };

                var sqlOrgRoleAssignment = @"
                    INSERT INTO role_assignments (id, user_id, role_id, scope_type, scope_id, assigned_at)
                    SELECT 
                        gen_random_uuid(),
                        @userId,
                        (SELECT id FROM roles WHERE tenant_id = @orgId AND name = @roleName AND domain = 'TENANT'),
                        'ORGANIZATION',
                        @orgId,
                        NOW()
                    WHERE EXISTS (
                        SELECT 1 FROM roles WHERE tenant_id = @orgId AND name = @roleName AND domain = 'TENANT'
                    )
                    ON CONFLICT (user_id, role_id, scope_type, scope_id) DO NOTHING;
                ";
                await context.Database.ExecuteSqlRawAsync(sqlOrgRoleAssignment,
                    new NpgsqlParameter("@userId", user.Id),
                    new NpgsqlParameter("@orgId", org.Id),
                    new NpgsqlParameter("@roleName", roleName)
                );
            }

            // Seed Workspaces & Memberships
            foreach (var ws in org.Workspaces)
            {
                var ownerUser = org.Users.FirstOrDefault(u => u.OrgRole == "OWNER") ?? org.Users.FirstOrDefault();
                var ownerId = ownerUser?.Id ?? Guid.Empty;

                var sqlWs = @"
                    INSERT INTO workspaces (id, organization_id, display_name, slug, status, owner_id)
                    VALUES (@id, @orgId, @displayName, @slug, @status, @ownerId)
                    ON CONFLICT (slug) WHERE deleted_at IS NULL DO NOTHING;
                ";
                await context.Database.ExecuteSqlRawAsync(sqlWs,
                    new NpgsqlParameter("@id", ws.Id),
                    new NpgsqlParameter("@orgId", org.Id),
                    new NpgsqlParameter("@displayName", ws.DisplayName),
                    new NpgsqlParameter("@slug", ws.Slug),
                    new NpgsqlParameter("@status", ws.Status),
                    new NpgsqlParameter("@ownerId", ownerId)
                );

                foreach (var member in ws.Members)
                {
                    var sqlWsMember = @"
                        INSERT INTO workspace_members (id, workspace_id, user_id, role)
                        VALUES (@id, @wsId, @userId, @role)
                        ON CONFLICT (workspace_id, user_id) DO NOTHING;
                    ";
                    var wmResult = await context.Database.ExecuteSqlRawAsync(sqlWsMember,
                        new NpgsqlParameter("@id", member.Id),
                        new NpgsqlParameter("@wsId", ws.Id),
                        new NpgsqlParameter("@userId", member.UserId),
                        new NpgsqlParameter("@role", member.Role)
                    );
                    if (wmResult > 0) affected++;

                    var wsRoleName = member.Role.ToLower() switch
                    {
                        "workspace_admin" => "administrator",
                        "manager" => "hiring_manager",
                        "editor" => "recruiter",
                        _ => "viewer"
                    };

                    var sqlWsRoleAssignment = @"
                        INSERT INTO role_assignments (id, user_id, role_id, scope_type, scope_id, assigned_at)
                        SELECT 
                            gen_random_uuid(),
                            @userId,
                            (SELECT id FROM roles WHERE tenant_id = @orgId AND name = @roleName AND domain = 'TENANT'),
                            'WORKSPACE',
                            @wsId,
                            NOW()
                        WHERE EXISTS (
                            SELECT 1 FROM roles WHERE tenant_id = @orgId AND name = @roleName AND domain = 'TENANT'
                        )
                        ON CONFLICT (user_id, role_id, scope_type, scope_id) DO NOTHING;
                    ";
                    await context.Database.ExecuteSqlRawAsync(sqlWsRoleAssignment,
                        new NpgsqlParameter("@userId", member.UserId),
                        new NpgsqlParameter("@orgId", org.Id),
                        new NpgsqlParameter("@roleName", wsRoleName),
                        new NpgsqlParameter("@wsId", ws.Id)
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
            var cmResult = await context.Database.ExecuteSqlRawAsync(sqlCm,
                new NpgsqlParameter("@id", cm.Id),
                new NpgsqlParameter("@orgId", cm.OrganizationId),
                new NpgsqlParameter("@userId", cm.UserId),
                new NpgsqlParameter("@role", cm.Role),
                new NpgsqlParameter("@status", cm.Status)
            );
            if (cmResult > 0) affected++;

            var cmRoleName = cm.Role.ToLower() switch
            {
                "owner" => "owner",
                "representative" => "administrator",
                "hr" => "hr_manager",
                _ => "viewer"
            };

            var sqlCmRoleAssignment = @"
                INSERT INTO role_assignments (id, user_id, role_id, scope_type, scope_id, assigned_at)
                SELECT 
                    gen_random_uuid(),
                    @userId,
                    (SELECT id FROM roles WHERE tenant_id = @orgId AND name = @roleName AND domain = 'TENANT'),
                    'ORGANIZATION',
                    @orgId,
                    NOW()
                WHERE EXISTS (
                    SELECT 1 FROM roles WHERE tenant_id = @orgId AND name = @roleName AND domain = 'TENANT'
                )
                ON CONFLICT (user_id, role_id, scope_type, scope_id) DO NOTHING;
            ";
            await context.Database.ExecuteSqlRawAsync(sqlCmRoleAssignment,
                new NpgsqlParameter("@userId", cm.UserId),
                new NpgsqlParameter("@orgId", cm.OrganizationId),
                new NpgsqlParameter("@roleName", cmRoleName)
            );
        }

        return new SeederResult(ModuleId, SeedingStatus.Success, "Users, workspace memberships, and cross-memberships seeded successfully.", affected);
    }

    private class SeedDataDto
    {
        public List<SeedOrganizationDto> Organizations { get; set; } = new();
        public List<SeedCrossMembershipDto> CrossMemberships { get; set; } = new();
    }

    private class SeedOrganizationDto
    {
        public Guid Id { get; set; }
        public List<SeedWorkspaceDto> Workspaces { get; set; } = new();
        public List<SeedUserDto> Users { get; set; } = new();
    }

    private class SeedWorkspaceDto
    {
        public Guid Id { get; set; }
        public string DisplayName { get; set; } = null!;
        public string Slug { get; set; } = null!;
        public string Status { get; set; } = null!;
        public List<SeedWorkspaceMemberDto> Members { get; set; } = new();
    }

    private class SeedWorkspaceMemberDto
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public string Role { get; set; } = null!;
    }

    private class SeedUserDto
    {
        public Guid Id { get; set; }
        public string Email { get; set; } = null!;
        public string FullName { get; set; } = null!;
        public Guid MembershipId { get; set; }
        public string OrgRole { get; set; } = null!;
    }

    private class SeedCrossMembershipDto
    {
        public Guid Id { get; set; }
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public string Role { get; set; } = null!;
        public string Status { get; set; } = null!;
    }
}
