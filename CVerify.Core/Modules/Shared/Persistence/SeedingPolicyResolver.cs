using System;
using Microsoft.Extensions.Hosting;

namespace CVerify.API.Modules.Shared.Persistence;

public static class SeedingPolicyResolver
{
    public static SeedingPolicy Resolve(IHostEnvironment? hostEnvironment)
    {
        string? envName = hostEnvironment?.EnvironmentName ?? Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");

        // 1. If environment name is missing/empty, safe-fail (disable everything)
        if (string.IsNullOrEmpty(envName))
        {
            return new SeedingPolicy(SeedInfrastructure: false, SeedDemoContent: false, RunDataMigrations: false);
        }

        // 2. Production never receives demo data
        if (string.Equals(envName, "Production", StringComparison.OrdinalIgnoreCase))
        {
            return new SeedingPolicy(SeedInfrastructure: true, SeedDemoContent: false, RunDataMigrations: true);
        }

        // 3. Check for explicit override to disable test account seeding (primarily for integration tests)
        var seedTestAccountsEnv = Environment.GetEnvironmentVariable("SEED_TEST_ACCOUNTS");
        bool hasExplicitDisable = string.Equals(seedTestAccountsEnv, "false", StringComparison.OrdinalIgnoreCase);

        if (hasExplicitDisable)
        {
            return new SeedingPolicy(SeedInfrastructure: true, SeedDemoContent: false, RunDataMigrations: true);
        }

        // 4. Development, UAT, and Staging execute full seeding
        if (string.Equals(envName, "Development", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(envName, "UAT", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(envName, "Staging", StringComparison.OrdinalIgnoreCase))
        {
            return new SeedingPolicy(SeedInfrastructure: true, SeedDemoContent: true, RunDataMigrations: true);
        }

        // 5. Fallback for custom/unknown environments: seed system infrastructure, but skip demo content
        return new SeedingPolicy(SeedInfrastructure: true, SeedDemoContent: false, RunDataMigrations: true);
    }
}
