using System;
using System.IO;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Shared.Persistence;

public class DemoOrganizationSeeder : ISeederModule
{
    public string ModuleId => "DemoOrganizationSeeder";
    public string Version => "1.0.0";
    public IReadOnlyCollection<string> Dependencies => new[] { "SystemRoleSeeder" };

    public async Task<SeederResult> SeedAsync(ApplicationDbContext context, SeedingConfig config)
    {
        if (context == null) throw new ArgumentNullException(nameof(context));
        if (!config.GenerateDemoData)
        {
            return new SeederResult(ModuleId, SeedingStatus.Skipped, "Demo organization seeding skipped because GenerateDemoData is false.");
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
            return new SeederResult(ModuleId, SeedingStatus.Failed, "Failed to deserialize seed organization data.");
        }

        int affected = 0;
        foreach (var org in seedData.Organizations)
        {
            var sqlOrg = @"
                INSERT INTO organizations (id, name, tax_code, email, username, is_verified, verification_level, status, initial_admin_assigned_at)
                VALUES (@id, @name, @taxCode, @email, @username, TRUE, @verificationLevel, @status, NOW())
                ON CONFLICT (tax_code) WHERE deleted_at IS NULL DO NOTHING;
            ";
            var result = await context.Database.ExecuteSqlRawAsync(sqlOrg,
                new NpgsqlParameter("@id", org.Id),
                new NpgsqlParameter("@name", org.Name),
                new NpgsqlParameter("@taxCode", org.TaxCode),
                new NpgsqlParameter("@email", org.Email),
                new NpgsqlParameter("@username", org.Username),
                new NpgsqlParameter("@verificationLevel", org.VerificationLevel),
                new NpgsqlParameter("@status", org.Status)
            );
            if (result > 0) affected++;

            // Seed Organization Credential
            var businessPassword = config.BusinessPassword;
            if (string.IsNullOrWhiteSpace(businessPassword))
            {
                businessPassword = "password123";
            }

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

            // Seed Workspaces
            foreach (var ws in org.Workspaces)
            {
                var ownerUser = org.Users.FirstOrDefault(u => u.OrgRole == "OWNER") ?? org.Users.FirstOrDefault();
                var ownerId = ownerUser?.Id ?? Guid.Empty;

                var sqlWs = @"
                    INSERT INTO workspaces (id, organization_id, display_name, slug, status, owner_id)
                    VALUES (@id, @orgId, @displayName, @slug, @status, @ownerId)
                    ON CONFLICT (slug) WHERE deleted_at IS NULL DO NOTHING;
                ";
                var wsResult = await context.Database.ExecuteSqlRawAsync(sqlWs,
                    new NpgsqlParameter("@id", ws.Id),
                    new NpgsqlParameter("@orgId", org.Id),
                    new NpgsqlParameter("@displayName", ws.DisplayName),
                    new NpgsqlParameter("@slug", ws.Slug),
                    new NpgsqlParameter("@status", ws.Status),
                    new NpgsqlParameter("@ownerId", ownerId)
                );
                if (wsResult > 0) affected++;
            }
        }

        return new SeederResult(ModuleId, SeedingStatus.Success, "Organizations and workspaces seeded successfully.", affected);
    }

    private class SeedDataDto
    {
        public string SchemaVersion { get; set; } = null!;
        public string SeedType { get; set; } = null!;
        public string SourceEnvironment { get; set; } = null!;
        public List<SeedOrganizationDto> Organizations { get; set; } = new();
    }

    private class SeedOrganizationDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = null!;
        public string TaxCode { get; set; } = null!;
        public string Email { get; set; } = null!;
        public string Username { get; set; } = null!;
        public int VerificationLevel { get; set; }
        public string Status { get; set; } = null!;
        public List<SeedWorkspaceDto> Workspaces { get; set; } = new();
        public List<SeedUserDto> Users { get; set; } = new();
    }

    private class SeedWorkspaceDto
    {
        public Guid Id { get; set; }
        public string DisplayName { get; set; } = null!;
        public string Slug { get; set; } = null!;
        public string Status { get; set; } = null!;
    }

    private class SeedUserDto
    {
        public Guid Id { get; set; }
        public string OrgRole { get; set; } = null!;
    }
}
