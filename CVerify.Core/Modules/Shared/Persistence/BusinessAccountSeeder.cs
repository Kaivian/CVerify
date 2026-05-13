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

public static class BusinessAccountSeeder
{
    public static async Task SeedAsync(ApplicationDbContext context, SeedingSettings seeding, SeedingPolicy policy)
    {
        if (context == null) throw new ArgumentNullException(nameof(context));
        if (seeding == null) throw new ArgumentNullException(nameof(seeding));
        if (policy == null) throw new ArgumentNullException(nameof(policy));

        if (!policy.SeedDemoContent)
        {
            return;
        }

        await SeedJSONTestAccountsAsync(context, seeding);
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

        // 1. Audit Manifest Verification
        if (seedData.SchemaVersion != "1.0.0")
        {
            throw new InvalidOperationException($"Unsupported business seed data schema version '{seedData.SchemaVersion}'. Supported version is '1.0.0'.");
        }

        if (seedData.SeedType != "Demo")
        {
            throw new InvalidOperationException($"Invalid seed type '{seedData.SeedType}' in business seed data. Expected 'Demo'.");
        }

        if (seedData.SourceEnvironment != "Development")
        {
            throw new InvalidOperationException($"Invalid source environment '{seedData.SourceEnvironment}' in business seed data. Expected 'Development'.");
        }

        // 2. Resolve Password
        var businessPassword = seeding.BusinessPassword;
        if (string.IsNullOrWhiteSpace(businessPassword))
        {
            businessPassword = Guid.CreateVersion7().ToString("N");
        }

        // 3. Seed Organizations and associated data
        foreach (var org in seedData.Organizations)
        {
            // Seed Organization (idempotent, skips if taxCode already exists)
            var sqlOrg = @"
                INSERT INTO organizations (id, name, tax_code, email, username, is_verified, verification_level, status, initial_admin_assigned_at)
                VALUES (@id, @name, @taxCode, @email, @username, TRUE, @verificationLevel, @status, NOW())
                ON CONFLICT (tax_code) WHERE deleted_at IS NULL DO NOTHING;
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
                new NpgsqlParameter("@password", businessPassword)
            );

            // Seed Org Users
            foreach (var user in org.Users)
            {
                var sqlUser = @"
                    INSERT INTO users (id, email, password_hash, full_name, status, email_verified_at)
                    VALUES (@id, @email, crypt(@password, gen_salt('bf', 10)), @fullName, 'ACTIVE', NOW())
                    ON CONFLICT (email) WHERE (deleted_at IS NULL OR status = 'DELETION_PENDING') DO NOTHING;
                ";
                await context.Database.ExecuteSqlRawAsync(sqlUser,
                    new NpgsqlParameter("@id", user.Id),
                    new NpgsqlParameter("@email", user.Email),
                    new NpgsqlParameter("@password", businessPassword),
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
                    ON CONFLICT (slug) WHERE deleted_at IS NULL DO NOTHING;
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
        public string SchemaVersion { get; set; } = null!;
        public string SeedType { get; set; } = null!;
        public string SourceEnvironment { get; set; } = null!;
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
