using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Configuration;

namespace CVerify.API.Modules.Shared.Persistence;

public class DemoForumPostSeeder : ISeederModule
{
    private readonly IEnumerable<IPublicWorkspaceModuleSeeder> _moduleSeeders;
    private readonly ILogger<DemoForumPostSeeder> _logger;

    public string ModuleId => "DemoForumPostSeeder";
    public string Version => "1.0.0";
    public IReadOnlyCollection<string> Dependencies => new[] { "DemoUserSeeder", "ForumMetadataSeeder" };

    public DemoForumPostSeeder(IEnumerable<IPublicWorkspaceModuleSeeder> moduleSeeders, ILogger<DemoForumPostSeeder> logger)
    {
        _moduleSeeders = moduleSeeders;
        _logger = logger;
    }

    public async Task<SeederResult> SeedAsync(ApplicationDbContext context, SeedingConfig config)
    {
        if (context == null) throw new ArgumentNullException(nameof(context));
        if (!config.GenerateDemoData)
        {
            return new SeederResult(ModuleId, SeedingStatus.Skipped, "Demo forum and post seeding skipped because GenerateDemoData is false.");
        }

        var settings = new SeedingSettings
        {
            PublicDemoDataPath = config.PublicDemoDataPath
        };

        var policy = new SeedingPolicy(SeedInfrastructure: true, SeedDemoContent: config.GenerateDemoData, RunDataMigrations: true);

        await PublicWorkspaceSeeder.SeedAsync(
            context,
            settings,
            _moduleSeeders,
            _logger,
            policy
        );

        return new SeederResult(ModuleId, SeedingStatus.Success, "Demo forum categories, jobs, and workspace posts seeded successfully.", 1);
    }
}
