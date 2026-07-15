using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace CVerify.API.Modules.Shared.Persistence;

public enum SeedingStatus
{
    Success,
    Skipped,
    Failed
}

public record SeederResult(
    string ModuleId,
    SeedingStatus Status,
    string? Message = null,
    int RecordsAffected = 0
);

public interface ISeederModule
{
    string ModuleId { get; }
    string Version { get; }
    IReadOnlyCollection<string> Dependencies { get; }
    Task<SeederResult> SeedAsync(ApplicationDbContext context, SeedingConfig config);
}

public interface IValidatableSeeder : ISeederModule
{
    Task<ValidationResult> ValidateAsync(ApplicationDbContext context);
}

public record ValidationResult(
    bool IsValid,
    string? Message = null
);
