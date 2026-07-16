using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Shared.Domain.Entities;
using System.Text.RegularExpressions;

namespace CVerify.API.Modules.Shared.Persistence;

public class TechnologyTaxonomySeeder : IValidatableSeeder
{
    public string ModuleId => "TechnologyTaxonomySeeder";
    public string Version => "1.0.0";
    public IReadOnlyCollection<string> Dependencies => Array.Empty<string>();

    public async Task<SeederResult> SeedAsync(ApplicationDbContext context, SeedingConfig config)
    {
        if (context == null) throw new ArgumentNullException(nameof(context));

        string filePath = FindSeedFilePath();
        if (string.IsNullOrEmpty(filePath) || !File.Exists(filePath))
        {
            return new SeederResult(ModuleId, SeedingStatus.Skipped, $"skills_seed.json not found. Looked in AppContext.BaseDirectory and Directory.GetCurrentDirectory().");
        }

        string jsonContent = await File.ReadAllTextAsync(filePath);
        using var doc = JsonDocument.Parse(jsonContent);
        var skillsProp = doc.RootElement.GetProperty("skills");

        int skillsAffected = 0;
        int aliasesAffected = 0;

        foreach (var skillElement in skillsProp.EnumerateArray())
        {
            var skillId = skillElement.GetProperty("skillId").GetString()!;
            var displayName = skillElement.GetProperty("displayName").GetString()!;
            var sfiaCategory = skillElement.GetProperty("sfiaCategory").GetString()!;
            var onetCode = skillElement.GetProperty("onetCode").GetString()!;
            var taxonomyVersion = "2026.07";

            var existingSkill = await context.CanonicalSkills
                .FirstOrDefaultAsync(s => s.SkillId == skillId && s.TaxonomyVersion == taxonomyVersion);

            if (existingSkill == null)
            {
                var skill = new CanonicalSkill
                {
                    SkillId = skillId,
                    TaxonomyVersion = taxonomyVersion,
                    DisplayName = displayName,
                    SfiaCategory = sfiaCategory,
                    OnetCode = onetCode,
                    Status = "Active",
                    CreatedAt = DateTimeOffset.UtcNow
                };
                context.CanonicalSkills.Add(skill);
                skillsAffected++;
            }
            else
            {
                existingSkill.DisplayName = displayName;
                existingSkill.SfiaCategory = sfiaCategory;
                existingSkill.OnetCode = onetCode;
                context.CanonicalSkills.Update(existingSkill);
                skillsAffected++;
            }

            if (skillElement.TryGetProperty("aliases", out var aliasesProp))
            {
                foreach (var aliasVal in aliasesProp.EnumerateArray())
                {
                    var aliasName = aliasVal.GetString()!.Trim().ToLowerInvariant();
                    if (string.IsNullOrEmpty(aliasName)) continue;

                    var existingAlias = await context.CanonicalSkillAliases
                        .FirstOrDefaultAsync(a => a.AliasName == aliasName);

                    if (existingAlias == null)
                    {
                        var alias = new CanonicalSkillAlias
                        {
                            AliasName = aliasName,
                            SkillId = skillId,
                            TaxonomyVersion = taxonomyVersion
                        };
                        context.CanonicalSkillAliases.Add(alias);
                        aliasesAffected++;
                    }
                    else if (existingAlias.SkillId != skillId)
                    {
                        existingAlias.SkillId = skillId;
                        existingAlias.TaxonomyVersion = taxonomyVersion;
                        context.CanonicalSkillAliases.Update(existingAlias);
                        aliasesAffected++;
                    }
                }
            }
        }

        // Backfill existing user_skills using raw SQL if relational database is used,
        // avoiding compile-time dependency on Profiles feature module.
        if (context.Database.IsRelational())
        {
            await context.Database.ExecuteSqlRawAsync(@"
                UPDATE user_skills us
                SET skill_id = cs.skill_id,
                    normalized_name = cs.display_name
                FROM canonical_skill_aliases csa
                JOIN canonical_skills cs ON cs.skill_id = csa.skill_id
                WHERE (us.skill_id IS NULL OR us.normalized_name IS NULL)
                  AND (LOWER(TRIM(us.skill)) = LOWER(csa.alias_name));
            ");

            await context.Database.ExecuteSqlRawAsync(@"
                UPDATE user_skills us
                SET skill_id = cs.skill_id,
                    normalized_name = cs.display_name
                FROM canonical_skills cs
                WHERE (us.skill_id IS NULL OR us.normalized_name IS NULL)
                  AND (
                    LOWER(REGEXP_REPLACE(TRIM(us.skill), '[^a-z0-9]', '', 'i')) = LOWER(REGEXP_REPLACE(TRIM(cs.display_name), '[^a-z0-9]', '', 'i'))
                    OR
                    LOWER(REGEXP_REPLACE(TRIM(us.skill), '[^a-z0-9]', '', 'i')) = LOWER(REGEXP_REPLACE(REPLACE(cs.skill_id, 'skill:', ''), '[^a-z0-9]', '', 'i'))
                  );
            ");

            await context.Database.ExecuteSqlRawAsync(@"
                UPDATE user_skills us
                SET skill_id = 'skill:emerging-' || LOWER(REGEXP_REPLACE(TRIM(us.skill), '[^a-z0-9]', '', 'i')),
                    normalized_name = TRIM(us.skill)
                WHERE (us.skill_id IS NULL OR us.normalized_name IS NULL);
            ");
        }

        await context.SaveChangesAsync();
        return new SeederResult(ModuleId, SeedingStatus.Success, $"Seeded {skillsAffected} canonical skills and {aliasesAffected} aliases.", skillsAffected + aliasesAffected);
    }

    private static string GetCleanSlug(string name)
    {
        if (string.IsNullOrWhiteSpace(name)) return "";
        var cleaned = name.Trim().ToLowerInvariant()
            .Replace("#", "sharp")
            .Replace("+", "plus");
        return Regex.Replace(cleaned, @"[^a-z0-9]", "");
    }

    public async Task<ValidationResult> ValidateAsync(ApplicationDbContext context)
    {
        var skillCount = await context.CanonicalSkills.CountAsync();
        var aliasCount = await context.CanonicalSkillAliases.CountAsync();
        if (skillCount == 0 || aliasCount == 0)
        {
            return new ValidationResult(false, $"Verification failed. Seeded {skillCount} skills and {aliasCount} aliases.");
        }
        return new ValidationResult(true);
    }

    private static string FindSeedFilePath()
    {
        var pathsToTry = new[]
        {
            Path.Combine(AppContext.BaseDirectory, "Modules", "Shared", "Persistence", "SeedData", "skills_seed.json"),
            Path.Combine(Directory.GetCurrentDirectory(), "Modules", "Shared", "Persistence", "SeedData", "skills_seed.json"),
            Path.Combine(Directory.GetCurrentDirectory(), "CVerify.Core", "Modules", "Shared", "Persistence", "SeedData", "skills_seed.json")
        };

        foreach (var p in pathsToTry)
        {
            if (File.Exists(p)) return p;
        }

        var dir = new DirectoryInfo(Directory.GetCurrentDirectory());
        while (dir != null)
        {
            var seedPath = Path.Combine(dir.FullName, "CVerify.Core", "Modules", "Shared", "Persistence", "SeedData", "skills_seed.json");
            if (File.Exists(seedPath)) return seedPath;
            dir = dir.Parent;
        }

        return "";
    }
}
