namespace CVerify.API.Modules.Shared.Persistence;

public sealed record SeedingPolicy(
    bool SeedInfrastructure,
    bool SeedDemoContent,
    bool RunDataMigrations
);
