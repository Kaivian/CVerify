using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Shared.Persistence;

public class DemoAiPipelineSeeder : ISeederModule
{
    public string ModuleId => "DemoAiPipelineSeeder";
    public string Version => "1.0.0";
    public IReadOnlyCollection<string> Dependencies => new[] { "DemoRepositorySeeder", "DemoCvSeeder" };

    public async Task<SeederResult> SeedAsync(ApplicationDbContext context, SeedingConfig config)
    {
        if (context == null) throw new ArgumentNullException(nameof(context));
        if (!config.GenerateDemoData)
        {
            return new SeederResult(ModuleId, SeedingStatus.Skipped, "Demo AI Pipeline seeding skipped because GenerateDemoData is false.");
        }

        // Clear existing seeded data to ensure clean refresh for all pipeline types
        context.PipelineEventsDurable.RemoveRange(context.PipelineEventsDurable);
        context.PipelineTasksDurable.RemoveRange(context.PipelineTasksDurable);
        context.PipelineStages.RemoveRange(context.PipelineStages);
        context.PipelineExecutions.RemoveRange(context.PipelineExecutions);
        await context.SaveChangesAsync();

        var repos = await context.SourceCodeRepositories.ToListAsync();
        if (!repos.Any())
        {
            return new SeederResult(ModuleId, SeedingStatus.Failed, "No source code repositories found. Skipping pipeline seeding.");
        }

        var user = await context.Users.FirstOrDefaultAsync(u => u.Email == "owner1@testbusiness.com")
                   ?? await context.Users.FirstOrDefaultAsync();
        var userId = user?.Id;

        var workspace = await context.Workspaces.FirstOrDefaultAsync();
        var workspaceId = workspace?.Id;

        // Generate data using DataGenerator
        var executions = DataGenerator.GeneratePipelineExecutions(userId, workspaceId, repos);
        await context.PipelineExecutions.AddRangeAsync(executions);
        await context.SaveChangesAsync();

        var stages = DataGenerator.GeneratePipelineStages(executions);
        await context.PipelineStages.AddRangeAsync(stages);

        var tasks = DataGenerator.GeneratePipelineTasks(executions);
        await context.PipelineTasksDurable.AddRangeAsync(tasks);

        var events = DataGenerator.GeneratePipelineEvents(executions);
        await context.PipelineEventsDurable.AddRangeAsync(events);

        await context.SaveChangesAsync();

        int affected = executions.Count + stages.Count + tasks.Count + events.Count;
        return new SeederResult(ModuleId, SeedingStatus.Success, "Demo AI Pipeline executions and details seeded successfully.", affected);
    }
}
