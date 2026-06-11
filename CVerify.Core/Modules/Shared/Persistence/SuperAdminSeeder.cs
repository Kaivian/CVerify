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
/// Seeds the system administrator user, roles, permissions, and administrative mapping.
/// </summary>
public static class SuperAdminSeeder
{
    public static async Task SeedAsync(ApplicationDbContext context, SuperAdminSettings settings)
    {
        if (context == null)
        {
            throw new ArgumentNullException(nameof(context));
        }

        if (settings == null)
        {
            throw new ArgumentNullException(nameof(settings));
        }

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

            -- Provision the master administrator account if it doesn't exist
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
        ";

        await context.Database.ExecuteSqlRawAsync(sql,
            new NpgsqlParameter("@adminEmail", settings.Email.Trim().ToLowerInvariant()),
            new NpgsqlParameter("@adminUsername", settings.Username.Trim()),
            new NpgsqlParameter("@adminFullName", settings.FullName.Trim()),
            new NpgsqlParameter("@adminPassword", settings.Password.Trim())
        );

        // Dynamic seed from permissions-registry.json
        await SeedRegistryPermissionsAsync(context);

        // Seed Admin Roles, Permissions and migrate existing platform administrators
        await SeedAdminRolesAndPermissionsAsync(context);
    }

    private static async Task SeedRegistryPermissionsAsync(ApplicationDbContext context)
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
                        // Parse permissions assigned to this role in registry
                        var permissionsList = new List<string>();
                        if (roleProperty.Value.TryGetProperty("permissions", out var permsElement))
                        {
                            foreach (var permVal in permsElement.EnumerateArray())
                            {
                                permissionsList.Add(permVal.GetString()!);
                            }
                        }
                        
                        // Get all permission IDs for this role
                        var dbPermissionIds = await context.Permissions
                            .Where(p => permissionsList.Contains(p.Name))
                            .Select(p => p.Id)
                            .ToListAsync();
                            
                        // Clear existing role-permissions mapping for this role, then rebuild it
                        var sqlClear = "DELETE FROM role_permissions WHERE role_id = @roleId;";
                        await context.Database.ExecuteSqlRawAsync(sqlClear, new Npgsql.NpgsqlParameter("@roleId", roleId));
                        
                        foreach (var permId in dbPermissionIds)
                        {
                            var sqlLink = "INSERT INTO role_permissions (role_id, permission_id) VALUES (@roleId, @permId) ON CONFLICT DO NOTHING;";
                            await context.Database.ExecuteSqlRawAsync(sqlLink, 
                                new Npgsql.NpgsqlParameter("@roleId", roleId),
                                new Npgsql.NpgsqlParameter("@permId", permId));
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

    private static async Task SeedAdminRolesAndPermissionsAsync(ApplicationDbContext context)
    {
        try
        {
            // Migrate existing platform administrators from legacy user_roles
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

    private class LegacyUserRoleDto
    {
        public Guid UserId { get; set; }
        public string RoleName { get; set; } = null!;
    }
}
