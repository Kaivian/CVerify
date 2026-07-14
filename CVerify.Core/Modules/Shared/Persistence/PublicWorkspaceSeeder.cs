using System;
using System.IO;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Shared.Persistence;

public static class PublicWorkspaceSeeder
{
    public static async Task SeedAsync(
        ApplicationDbContext context,
        SeedingSettings seeding,
        IEnumerable<IPublicWorkspaceModuleSeeder> moduleSeeders,
        ILogger logger,
        SeedingPolicy policy)
    {
        if (context == null) throw new ArgumentNullException(nameof(context));
        if (seeding == null) throw new ArgumentNullException(nameof(seeding));
        if (moduleSeeders == null) throw new ArgumentNullException(nameof(moduleSeeders));
        if (logger == null) throw new ArgumentNullException(nameof(logger));
        if (policy == null) throw new ArgumentNullException(nameof(policy));

        if (!policy.SeedDemoContent)
        {
            logger.LogInformation("[Seeder] Public workspace seeding skipped because SeedDemoContent is false.");
            return;
        }

        // 1. Perform environment checks and safeguards
        try
        {
            AssertSafeEnvironment(context, policy);
        }
        catch (Exception ex)
        {
            logger.LogWarning("[Seeder Safeguard Alert] Public workspace seeding skipped: {Message}", ex.Message);
            return;
        }

        // 2. Load JSON aggregate data
        var seedPath = seeding.PublicDemoDataPath;
        if (!Path.IsPathRooted(seedPath))
        {
            seedPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, seeding.PublicDemoDataPath);
            if (!File.Exists(seedPath))
            {
                seedPath = Path.Combine(Directory.GetCurrentDirectory(), seeding.PublicDemoDataPath);
            }
        }

        if (!File.Exists(seedPath))
        {
            logger.LogWarning($"[Seeder Warning] Public workspace seed data file not found at '{seedPath}'. Skipping public content seeding.");
            return;
        }

        var jsonString = await File.ReadAllTextAsync(seedPath);
        var options = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        };

        SeedAggregateRoot? root;
        try
        {
            root = JsonSerializer.Deserialize<SeedAggregateRoot>(jsonString, options);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[Seeder Error] Failed to deserialize public workspace seed data JSON.");
            throw;
        }

        if (root == null)
        {
            throw new InvalidOperationException("Failed to deserialize public workspace seed data: root is null.");
        }

        // 3. Audit Manifest Verification
        if (root.SchemaVersion != "1.0.0")
        {
            throw new InvalidOperationException($"Unsupported seed data schema version '{root.SchemaVersion}'. Supported version is '1.0.0'.");
        }

        if (root.SeedType != "Demo")
        {
            throw new InvalidOperationException($"Invalid seed type '{root.SeedType}' in public workspace seed data. Expected 'Demo'.");
        }

        if (root.SourceEnvironment != "Development")
        {
            throw new InvalidOperationException($"Invalid source environment '{root.SourceEnvironment}' in public workspace seed data. Expected 'Development'.");
        }

        // 4. Strongly typed recursive validation
        try
        {
            ValidateObjectRecursive(root);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[Seeder Error] Validation failed for public workspace seed data model.");
            throw;
        }

        // 5. Seed organizations aggregate
        foreach (var orgDto in root.Organizations)
        {
            // Lookup organization slug in DB (if not provisioned, log warning and skip)
            var org = await context.Organizations
                .FirstOrDefaultAsync(o => o.Username.ToLower() == orgDto.OrganizationSlug.ToLower());

            if (org == null)
            {
                logger.LogWarning($"[Seeder Warning] Organization slug '{orgDto.OrganizationSlug}' is not provisioned in database. Skipping public content seeding for this organization.");
                continue;
            }

            // Wrap seeding of this organization aggregate in a transaction
            using var transaction = await context.Database.BeginTransactionAsync();
            try
            {
                logger.LogInformation($"[Seeder] Seeding public profile details for organization: '{org.Name}' ({orgDto.OrganizationSlug})");

                // Update core organization public profile fields (Mission, Vision, CoreValues, Founded, and others)
                org.Mission = orgDto.Mission;
                org.Vision = orgDto.Vision;
                org.CoreValues = orgDto.CoreValues;
                org.Founded = orgDto.Founded;
                org.CompanyType = orgDto.CompanyType ?? org.CompanyType;
                org.CompanySize = orgDto.CompanySize ?? org.CompanySize;
                org.BranchCount = orgDto.BranchCount > 0 ? orgDto.BranchCount : org.BranchCount;
                org.IndustryTags = orgDto.IndustryTags.Any() ? orgDto.IndustryTags : org.IndustryTags;
                org.BenefitTags = orgDto.BenefitTags.Any() ? orgDto.BenefitTags : org.BenefitTags;
                org.GalleryUrls = orgDto.GalleryUrls.Any() ? orgDto.GalleryUrls : org.GalleryUrls;
                org.ContactName = orgDto.ContactName ?? org.ContactName;
                org.ContactPhone = orgDto.ContactPhone ?? org.ContactPhone;
                org.ContactEmail = orgDto.ContactEmail ?? org.ContactEmail;
                org.City = orgDto.City ?? org.City;
                org.DetailAddress = orgDto.DetailAddress ?? org.DetailAddress;
                org.GoogleMapsEmbedUrl = orgDto.GoogleMapsEmbedUrl ?? org.GoogleMapsEmbedUrl;
                org.LinkedinUrl = orgDto.LinkedinUrl ?? org.LinkedinUrl;
                org.FacebookUrl = orgDto.FacebookUrl ?? org.FacebookUrl;
                org.TwitterUrl = orgDto.TwitterUrl ?? org.TwitterUrl;
                org.Website = orgDto.Website ?? org.Website;
                org.UpdatedAt = DateTimeOffset.UtcNow;

                await context.SaveChangesAsync();

                // Run registered module seeders for this organization
                foreach (var moduleSeeder in moduleSeeders)
                {
                    logger.LogInformation($"[Seeder] Running seeder plugin '{moduleSeeder.ModuleName}' for organization '{org.Name}'");
                    await moduleSeeder.SeedModuleAsync(org.Id, orgDto, context);
                }

                await transaction.CommitAsync();
                logger.LogInformation($"[Seeder] Successfully completed seeding public profile aggregate for '{org.Name}'");
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                logger.LogError(ex, $"[Seeder Error] Seeding aggregate failed for organization '{org.Name}'. Rolled back changes.");
                throw;
            }
        }
    }

    private static void AssertSafeEnvironment(ApplicationDbContext context, SeedingPolicy policy)
    {
        if (!policy.SeedDemoContent)
        {
            throw new InvalidOperationException("Fatal: Seeding cannot run when SeedDemoContent is false.");
        }

        var env = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Development";
        if (string.Equals(env, "Production", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Fatal: Seeding cannot run in the Production environment.");
        }

        var connString = context.Database.GetDbConnection().ConnectionString;
        if (string.IsNullOrEmpty(connString))
        {
            throw new InvalidOperationException("Fatal: Database Connection String is empty.");
        }

        var lowerConn = connString.ToLowerInvariant();
        if (lowerConn.Contains(".database.windows.net") ||
            lowerConn.Contains(".rds.amazonaws.com") ||
            lowerConn.Contains("rds.amazonaws.com") ||
            lowerConn.Contains(".googleapis.com") ||
            lowerConn.Contains("cockroachlabs.cloud"))
        {
            throw new InvalidOperationException("Fatal: Production cloud database host detected in Connection String. Seeding aborted for safety.");
        }

        var hasNonTestUsers = context.Users.Any(u =>
            !u.Email.EndsWith("@testbusiness.com") &&
            !u.Email.EndsWith("@cverify.dev") &&
            !u.Email.EndsWith("@system.com") &&
            !u.Email.EndsWith("@test.com")
        );
        if (hasNonTestUsers)
        {
            throw new InvalidOperationException("Fatal: Production indicator detected (users with non-test domains exist in the database). Seeding aborted for safety.");
        }
    }

    private static void ValidateObjectRecursive(object obj)
    {
        var context = new ValidationContext(obj);
        var results = new List<global::System.ComponentModel.DataAnnotations.ValidationResult>();
        if (!Validator.TryValidateObject(obj, context, results, true))
        {
            throw new InvalidOperationException($"Validation failed: {string.Join(", ", results.Select(r => r.ErrorMessage))}");
        }

        var properties = obj.GetType().GetProperties();
        foreach (var prop in properties)
        {
            if (typeof(global::System.Collections.IEnumerable).IsAssignableFrom(prop.PropertyType) && prop.PropertyType != typeof(string))
            {
                var value = prop.GetValue(obj) as global::System.Collections.IEnumerable;
                if (value != null)
                {
                    foreach (var item in value)
                    {
                        if (item != null && item.GetType().IsClass && item.GetType() != typeof(string))
                        {
                            ValidateObjectRecursive(item);
                        }
                    }
                }
            }
            else if (prop.PropertyType.IsClass && prop.PropertyType != typeof(string))
            {
                var value = prop.GetValue(obj);
                if (value != null)
                {
                    ValidateObjectRecursive(value);
                }
            }
        }
    }

    // Deserialization Target DTO definitions
    public class SeedAggregateRoot
    {
        [Required]
        public string SchemaVersion { get; set; } = null!;
        [Required]
        public string SeedType { get; set; } = null!;
        [Required]
        public string SourceEnvironment { get; set; } = null!;
        public List<SeedOrganizationAggregate> Organizations { get; set; } = new();
    }

    public class SeedOrganizationAggregate
    {
        [Required]
        public string OrganizationSlug { get; set; } = null!;
        public string? Mission { get; set; }
        public string? Vision { get; set; }
        public string? CoreValues { get; set; }
        public string? Founded { get; set; }
        public string? CompanyType { get; set; }
        public string? CompanySize { get; set; }
        public int BranchCount { get; set; }
        public List<string> IndustryTags { get; set; } = new();
        public List<string> BenefitTags { get; set; } = new();
        public List<string> GalleryUrls { get; set; } = new();
        public string? ContactName { get; set; }
        public string? ContactPhone { get; set; }
        public string? ContactEmail { get; set; }
        public string? City { get; set; }
        public string? DetailAddress { get; set; }
        public string? GoogleMapsEmbedUrl { get; set; }
        public string? LinkedinUrl { get; set; }
        public string? FacebookUrl { get; set; }
        public string? TwitterUrl { get; set; }
        public string? Website { get; set; }
        public List<SeedJobDto> Jobs { get; set; } = new();
        public List<SeedPostDto> Posts { get; set; } = new();
    }

    public class SeedJobDto
    {
        [Required]
        public string Title { get; set; } = null!;
        [Required]
        public string Department { get; set; } = null!;
        [Required]
        public string WorkplaceType { get; set; } = null!;
        [Required]
        public string City { get; set; } = null!;
        [Required]
        public string Type { get; set; } = null!;
        [Required]
        public string Salary { get; set; } = null!;
        [Required]
        public string SalaryMinMax { get; set; } = null!;
        public int Headcount { get; set; } = 1;
        public string Gender { get; set; } = "No requirement";
        public string Experience { get; set; } = null!;
        public string Degree { get; set; } = null!;
        public string Category { get; set; } = null!;
        public List<string> Description { get; set; } = new();
        public List<string> Requirements { get; set; } = new();
        public List<string> Benefits { get; set; } = new();
        public List<string> Tags { get; set; } = new();
        public List<string> Skills { get; set; } = new();
        [Required]
        public string CoverUrl { get; set; } = null!;
        public List<string> Images { get; set; } = new();
        public bool IsActive { get; set; } = true;
    }

    public class SeedPostDto
    {
        [Required]
        public string Category { get; set; } = null!;
        [Required]
        public string Content { get; set; } = null!;
        public List<string> Images { get; set; } = new();
        public int Likes { get; set; }
        public int SharesCount { get; set; }
    }
}
