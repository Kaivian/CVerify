using System;
using System.IO;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Shared.Persistence;

public class SystemRoleSeeder : IValidatableSeeder
{
    public string ModuleId => "SystemRoleSeeder";
    public string Version => "1.0.2";
    public IReadOnlyCollection<string> Dependencies => new[] { "PermissionSeeder" };

    public async Task<SeederResult> SeedAsync(ApplicationDbContext context, SeedingConfig config)
    {
        if (context == null) throw new ArgumentNullException(nameof(context));

        // 1. Seed standard system roles and wildcard
        const string sql = @"
            -- Seed standard system roles
            INSERT INTO roles (id, name, display_name, description, is_system)
            VALUES 
                ('018fc35b-1c5c-7b8a-9a2d-3e4f5a6b7c8d'::uuid, 'SUPER_ADMIN', 'System Administrator', 'Root access to all modules', TRUE),
                ('018fc35b-1c5d-7b8a-9a2d-3e4f5a6b7c8d'::uuid, 'USER', 'General User', 'Basic application access', TRUE)
            ON CONFLICT (name) WHERE tenant_id IS NULL DO UPDATE 
            SET display_name = EXCLUDED.display_name, description = EXCLUDED.description;

            -- Seed global wildcard permission
            INSERT INTO permissions (id, name, display_name, description, module, is_system)
            VALUES 
                ('018fc35b-1c5e-7b8a-9a2d-3e4f5a6b7c8d'::uuid, '*:*:*', 'Global Wildcard', 'Full access to every module and feature', 'system', TRUE)
            ON CONFLICT (name) DO UPDATE 
            SET display_name = EXCLUDED.display_name, description = EXCLUDED.description, module = EXCLUDED.module;

            -- Map global permission to SUPER_ADMIN role
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT r.id, p.id FROM roles r, permissions p 
            WHERE r.name = 'SUPER_ADMIN' AND p.name = '*:*:*'
            ON CONFLICT DO NOTHING;
        ";
        await context.Database.ExecuteSqlRawAsync(sql);

        // 2. Dynamic seed from permissions-registry.json
        await SeedRegistryPermissionsAsync(context);

        // 3. Seed Admin Roles, Permissions and migrate existing platform administrators
        await SeedAdminRolesAndPermissionsAsync(context);

        // 4. Provision system administrator
        int affected = 2; // Basic roles
        if (!string.IsNullOrWhiteSpace(config.SuperAdminPassword))
        {
            var email = config.SuperAdminEmail ?? "admin@system.com";
            var username = config.SuperAdminUsername ?? "admin";
            var fullName = config.SuperAdminFullName ?? "System Administrator";
            var password = config.SuperAdminPassword;

            const string userSql = @"
                INSERT INTO users (
                    id,
                    email, 
                    username,
                    password_hash, 
                    full_name, 
                    status, 
                    email_verified_at
                )
                SELECT 
                    '018fc35b-1c5f-7b8a-9a2d-3e4f5a6b7c8d'::uuid,
                    @adminEmail,
                    @adminUsername,
                    crypt(@adminPassword, gen_salt('bf', 10)),
                    @adminFullName,
                    'ACTIVE',
                    NOW()
                WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = @adminEmail);

                -- Seed the master administrator role mapping if not present
                INSERT INTO user_roles (user_id, role_id)
                SELECT 
                    (SELECT id FROM users WHERE email = @adminEmail),
                    (SELECT id FROM roles WHERE name = 'SUPER_ADMIN')
                ON CONFLICT DO NOTHING;

                -- Seed active admin portal membership
                INSERT INTO admin_members (id, user_id, status, session_version, joined_at, updated_at)
                SELECT 
                    '018fc35b-1c60-7b8a-9a2d-3e4f5a6b7c8d'::uuid,
                    (SELECT id FROM users WHERE email = @adminEmail),
                    'Active',
                    1,
                    NOW(),
                    NOW()
                WHERE EXISTS (SELECT 1 FROM users WHERE email = @adminEmail)
                  AND NOT EXISTS (SELECT 1 FROM admin_members WHERE user_id = (SELECT id FROM users WHERE email = @adminEmail));

                -- Seed modern global scoped role assignment
                INSERT INTO role_assignments (id, user_id, role_id, scope_type, scope_id, assigned_at)
                SELECT 
                    '018fc35b-1c61-7b8a-9a2d-3e4f5a6b7c8d'::uuid,
                    (SELECT id FROM users WHERE email = @adminEmail),
                    (SELECT id FROM roles WHERE name = 'SUPER_ADMIN'),
                    'SYSTEM',
                    '00000000-0000-0000-0000-000000000000'::uuid,
                    NOW()
                WHERE EXISTS (SELECT 1 FROM users WHERE email = @adminEmail)
                  AND NOT EXISTS (
                      SELECT 1 FROM role_assignments 
                      WHERE user_id = (SELECT id FROM users WHERE email = @adminEmail)
                        AND role_id = (SELECT id FROM roles WHERE name = 'SUPER_ADMIN')
                        AND scope_type = 'SYSTEM'
                  );
            ";
            await context.Database.ExecuteSqlRawAsync(userSql,
                new NpgsqlParameter("@adminEmail", email.Trim().ToLowerInvariant()),
                new NpgsqlParameter("@adminUsername", username.Trim()),
                new NpgsqlParameter("@adminPassword", password.Trim()),
                new NpgsqlParameter("@adminFullName", fullName.Trim())
            );
            affected += 1;
        }

        return new SeederResult(ModuleId, SeedingStatus.Success, "System roles and core mappings seeded successfully.", affected);
    }

    private async Task SeedRegistryPermissionsAsync(ApplicationDbContext context)
    {
        var registryPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "resources", "permissions-registry.json");
        if (!File.Exists(registryPath))
        {
            registryPath = Path.Combine(Directory.GetCurrentDirectory(), "resources", "permissions-registry.json");
        }

        if (!File.Exists(registryPath))
        {
            return;
        }

        try
        {
            var jsonString = await File.ReadAllTextAsync(registryPath);
            using var doc = global::System.Text.Json.JsonDocument.Parse(jsonString);

            // Seed all permissions from the modules section
            if (doc.RootElement.TryGetProperty("modules", out var modulesElement))
            {
                foreach (var moduleProperty in modulesElement.EnumerateObject())
                {
                    var moduleName = moduleProperty.Name;
                    foreach (var permElement in moduleProperty.Value.EnumerateArray())
                    {
                        var name = permElement.GetProperty("name").GetString();
                        var displayName = permElement.GetProperty("displayName").GetString();
                        var description = permElement.GetProperty("description").GetString();

                        var sqlSeedPermission = @"
                            INSERT INTO permissions (id, name, display_name, description, module, is_system)
                            VALUES (@id, @name, @displayName, @description, @module, TRUE)
                            ON CONFLICT (name) DO UPDATE 
                            SET display_name = EXCLUDED.display_name, description = EXCLUDED.description, module = EXCLUDED.module;";

                        await context.Database.ExecuteSqlRawAsync(sqlSeedPermission,
                            new NpgsqlParameter("@id", Guid.CreateVersion7()),
                            new NpgsqlParameter("@name", name),
                            new NpgsqlParameter("@displayName", displayName),
                            new NpgsqlParameter("@description", description ?? (object)DBNull.Value),
                            new NpgsqlParameter("@module", moduleName));
                    }
                }
            }

            // Seed all roles and map their permissions
            if (doc.RootElement.TryGetProperty("roles", out var rolesElement))
            {
                foreach (var roleProperty in rolesElement.EnumerateObject())
                {
                    var roleName = roleProperty.Name;
                    var roleDisplayName = roleProperty.Value.GetProperty("displayName").GetString();
                    var roleDescription = roleProperty.Value.GetProperty("description").GetString();

                    var sqlSeedRole = @"
                        INSERT INTO roles (id, name, display_name, description, is_system, is_active)
                        VALUES (@id, @name, @displayName, @description, TRUE, TRUE)
                        ON CONFLICT (name) WHERE tenant_id IS NULL DO UPDATE 
                        SET display_name = EXCLUDED.display_name, description = EXCLUDED.description;";

                    await context.Database.ExecuteSqlRawAsync(sqlSeedRole,
                        new NpgsqlParameter("@id", Guid.CreateVersion7()),
                        new NpgsqlParameter("@name", roleName),
                        new NpgsqlParameter("@displayName", roleDisplayName),
                        new NpgsqlParameter("@description", roleDescription ?? (object)DBNull.Value));

                    var roleId = await context.Roles
                        .Where(r => r.Name == roleName)
                        .Select(r => r.Id)
                        .FirstOrDefaultAsync();

                    if (roleId != Guid.Empty)
                    {
                        var permissionsList = new List<string>();
                        if (roleProperty.Value.TryGetProperty("permissions", out var permsElement))
                        {
                            foreach (var permVal in permsElement.EnumerateArray())
                            {
                                permissionsList.Add(permVal.GetString()!);
                            }
                        }

                        var dbPermissionIds = await context.Permissions
                            .Where(p => permissionsList.Contains(p.Name))
                            .Select(p => p.Id)
                            .ToListAsync();

                        if (dbPermissionIds.Any())
                        {
                            var sqlSync = @"
                                -- 1. Delete mapping associations that are no longer active
                                DELETE FROM role_permissions 
                                WHERE role_id = @roleId 
                                  AND permission_id NOT IN (SELECT unnest(@permIds::uuid[]));

                                -- 2. Insert any missing mappings
                                INSERT INTO role_permissions (role_id, permission_id)
                                SELECT @roleId, pId 
                                FROM unnest(@permIds::uuid[]) pId
                                ON CONFLICT DO NOTHING;
                            ";
                            await context.Database.ExecuteSqlRawAsync(sqlSync,
                                new NpgsqlParameter("@roleId", roleId),
                                new NpgsqlParameter("@permIds", dbPermissionIds.ToArray()));
                        }
                        else
                        {
                            var sqlClear = "DELETE FROM role_permissions WHERE role_id = @roleId;";
                            await context.Database.ExecuteSqlRawAsync(sqlClear, new Npgsql.NpgsqlParameter("@roleId", roleId));
                        }
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[PermissionSeeding] Error dynamically seeding registry: {ex.Message}");
        }
    }

    private async Task SeedAdminRolesAndPermissionsAsync(ApplicationDbContext context)
    {
        try
        {
            var legacyAdmins = await context.Database.SqlQueryRaw<LegacyUserRoleDto>(
                @"SELECT ur.user_id as ""user_id"", r.name as ""role_name"" 
                  FROM user_roles ur 
                  JOIN roles r ON ur.role_id = r.id 
                  WHERE r.name IN ('SUPER_ADMIN', 'ADMIN')"
            ).ToListAsync();

            foreach (var la in legacyAdmins)
            {
                var adminMember = await context.AdminMembers.FirstOrDefaultAsync(am => am.UserId == la.UserId);
                if (adminMember == null)
                {
                    adminMember = new AdminMember
                    {
                        Id = Guid.CreateVersion7(),
                        UserId = la.UserId,
                        Status = "Active",
                        SessionVersion = 1,
                        JoinedAt = DateTimeOffset.UtcNow,
                        UpdatedAt = DateTimeOffset.UtcNow
                    };
                    context.AdminMembers.Add(adminMember);
                    await context.SaveChangesAsync();
                }

                var targetRole = await context.Roles.FirstOrDefaultAsync(r => r.Name == la.RoleName && r.Domain == "SYSTEM");
                if (targetRole != null)
                {
                    var exists = await context.RoleAssignments
                        .AnyAsync(ra => ra.UserId == la.UserId && ra.RoleId == targetRole.Id && ra.ScopeType == "SYSTEM");

                    if (!exists)
                    {
                        var assignment = new RoleAssignment
                        {
                            Id = Guid.CreateVersion7(),
                            UserId = la.UserId,
                            RoleId = targetRole.Id,
                            ScopeType = "SYSTEM",
                            ScopeId = Guid.Empty,
                            AssignedAt = DateTimeOffset.UtcNow
                        };
                        context.RoleAssignments.Add(assignment);
                        await context.SaveChangesAsync();
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SeedAdminRolesAndPermissions] Error executing migration/seeding: {ex.Message}");
            throw;
        }
    }

    public async Task<ValidationResult> ValidateAsync(ApplicationDbContext context)
    {
        var hasSuperAdmin = await context.Roles.AnyAsync(r => r.Name == "SUPER_ADMIN");
        if (!hasSuperAdmin)
        {
            return new ValidationResult(false, "SUPER_ADMIN system role is missing.");
        }
        return new ValidationResult(true);
    }

    private class LegacyUserRoleDto
    {
        public Guid UserId { get; set; }
        public string RoleName { get; set; } = null!;
    }
}
