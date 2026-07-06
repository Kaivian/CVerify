using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Shared.Persistence;

public class CircularSeedingDependencyException : Exception
{
    public CircularSeedingDependencyException(string message) : base(message) { }
}

public class SeedingValidationException : Exception
{
    public SeedingValidationException(string message) : base(message) { }
}

public class SeedRunner
{
    private readonly IEnumerable<ISeederModule> _modules;
    private readonly ILogger<SeedRunner> _logger;

    public SeedRunner(IEnumerable<ISeederModule> modules, ILogger<SeedRunner> logger)
    {
        _modules = modules;
        _logger = logger;
    }

    public List<ISeederModule> GetOrderedModules()
    {
        var seederMap = _modules.ToDictionary(m => m.ModuleId, StringComparer.OrdinalIgnoreCase);
        var sorted = new List<ISeederModule>();
        var visited = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase); // false = visiting, true = visited

        void Visit(ISeederModule seeder)
        {
            var id = seeder.ModuleId;
            if (visited.TryGetValue(id, out var isVisited))
            {
                if (!isVisited)
                {
                    throw new CircularSeedingDependencyException($"Circular dependency detected for seeder module '{id}'.");
                }
                return;
            }

            visited[id] = false; // Visiting

            foreach (var depId in seeder.Dependencies)
            {
                if (seederMap.TryGetValue(depId, out var depSeeder))
                {
                    Visit(depSeeder);
                }
                else
                {
                    _logger.LogWarning("Seeder module '{ModuleId}' depends on '{DependencyId}' which is not registered.", id, depId);
                }
            }

            visited[id] = true; // Visited
            sorted.Add(seeder);
        }

        foreach (var seeder in _modules)
        {
            Visit(seeder);
        }

        return sorted;
    }

    public async Task RunAsync(ApplicationDbContext context, SeedingConfig config)
    {
        if (!config.Enabled)
        {
            _logger.LogInformation("Database seeding is disabled in configuration.");
            return;
        }

        var orderedModules = GetOrderedModules();
        _logger.LogInformation("Resolved seeder execution DAG. Modules: {Modules}", 
            string.Join(" -> ", orderedModules.Select(m => m.ModuleId)));

        if (config.DryRun)
        {
            _logger.LogInformation("Executing database seeding in DRY RUN mode.");
            await ExecuteDryRunAsync(context, config, orderedModules);
            return;
        }

        foreach (var module in orderedModules)
        {
            // Check if we should execute based on config.EnabledModules
            if (config.EnabledModules != null && config.EnabledModules.Any() &&
                !config.EnabledModules.Contains(module.ModuleId, StringComparer.OrdinalIgnoreCase))
            {
                _logger.LogInformation("Skipping module '{ModuleId}' as it is not in the explicit list of enabled modules.", module.ModuleId);
                continue;
            }

            // Check seeding history / versioning
            var existingHistory = await context.SeedingHistories
                .FirstOrDefaultAsync(h => h.ModuleId == module.ModuleId);

            if (existingHistory != null && CompareVersions(existingHistory.Version, module.Version) >= 0)
            {
                if (config.VerboseLogging)
                {
                    _logger.LogInformation("Skipping module '{ModuleId}' because installed version '{InstalledVersion}' is up to date with seeder version '{SeederVersion}'.",
                        module.ModuleId, existingHistory.Version, module.Version);
                }
                continue;
            }

            _logger.LogInformation("Executing seeder module '{ModuleId}' (Version: {Version})...", module.ModuleId, module.Version);
            
            using var transaction = await context.Database.BeginTransactionAsync();
            var stopwatch = Stopwatch.StartNew();
            try
            {
                var result = await module.SeedAsync(context, config);
                stopwatch.Stop();

                if (result.Status == SeedingStatus.Success)
                {
                    // Post-seed validation
                    if (module is IValidatableSeeder validatable)
                    {
                        var validation = await validatable.ValidateAsync(context);
                        if (!validation.IsValid)
                        {
                            throw new SeedingValidationException($"Post-seed validation failed for module '{module.ModuleId}': {validation.Message}");
                        }
                    }

                    // Save history
                    if (existingHistory == null)
                    {
                        existingHistory = new SeedingHistory
                        {
                            ModuleId = module.ModuleId,
                            Version = module.Version,
                            EnvironmentName = config.Environment,
                            AppliedAtUtc = DateTimeOffset.UtcNow,
                            DurationMs = (int)stopwatch.ElapsedMilliseconds,
                            RecordsAffected = result.RecordsAffected
                        };
                        context.SeedingHistories.Add(existingHistory);
                    }
                    else
                    {
                        existingHistory.Version = module.Version;
                        existingHistory.EnvironmentName = config.Environment;
                        existingHistory.AppliedAtUtc = DateTimeOffset.UtcNow;
                        existingHistory.DurationMs = (int)stopwatch.ElapsedMilliseconds;
                        existingHistory.RecordsAffected = result.RecordsAffected;
                        context.SeedingHistories.Update(existingHistory);
                    }

                    await context.SaveChangesAsync();
                    await transaction.CommitAsync();

                    _logger.LogInformation("Successfully completed seeder module '{ModuleId}' in {Duration}ms. Records affected: {Count}.",
                        module.ModuleId, stopwatch.ElapsedMilliseconds, result.RecordsAffected);
                }
                else if (result.Status == SeedingStatus.Skipped)
                {
                    await transaction.RollbackAsync();
                    _logger.LogInformation("Seeder module '{ModuleId}' was skipped: {Message}.", module.ModuleId, result.Message);
                }
                else
                {
                    throw new Exception(result.Message ?? "Seeder module reported failure status.");
                }
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Fatal error executing seeder module '{ModuleId}'. Seeding aborted.", module.ModuleId);
                throw;
            }
        }
    }

    private async Task ExecuteDryRunAsync(ApplicationDbContext context, SeedingConfig config, List<ISeederModule> orderedModules)
    {
        _logger.LogInformation("=== Seeding Dry-Run Report ===");
        var report = new List<string>();

        using var transaction = await context.Database.BeginTransactionAsync();
        try
        {
            foreach (var module in orderedModules)
            {
                var existingHistory = await context.SeedingHistories
                    .FirstOrDefaultAsync(h => h.ModuleId == module.ModuleId);

                var isUpToDate = existingHistory != null && CompareVersions(existingHistory.Version, module.Version) >= 0;
                var action = isUpToDate ? "SKIP (Up to date)" : "RUN";

                if (config.EnabledModules != null && config.EnabledModules.Any() &&
                    !config.EnabledModules.Contains(module.ModuleId, StringComparer.OrdinalIgnoreCase))
                {
                    action = "SKIP (Not in explicit enabled list)";
                }

                _logger.LogInformation("- Module: {ModuleId} | Version: {Version} | Action: {Action}", module.ModuleId, module.Version, action);
                report.Add($"Module: {module.ModuleId} (v{module.Version}) - {action}");

                if (action == "RUN")
                {
                    // Run the seed script in transaction
                    var result = await module.SeedAsync(context, config);
                    if (result.Status == SeedingStatus.Success && module is IValidatableSeeder validatable)
                    {
                        var validation = await validatable.ValidateAsync(context);
                        _logger.LogInformation("  [Validation] {Status} {Msg}", validation.IsValid ? "Passed" : "Failed", validation.Message);
                    }
                    _logger.LogInformation("  [Simulation] Status: {Status} | Affected Records: {Count} | Msg: {Msg}", result.Status, result.RecordsAffected, result.Message);
                }
            }
        }
        finally
        {
            await transaction.RollbackAsync();
            _logger.LogInformation("Dry-run complete. All database modifications rolled back successfully.");
            _logger.LogInformation("==============================");
        }
    }

    private static int CompareVersions(string v1, string v2)
    {
        if (Version.TryParse(v1, out var ver1) && Version.TryParse(v2, out var ver2))
        {
            return ver1.CompareTo(ver2);
        }
        return string.Compare(v1, v2, StringComparison.OrdinalIgnoreCase);
    }
}
