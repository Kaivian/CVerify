using System;

namespace CVerify.API.Modules.Shared.Domain.Entities;

public class SeedingHistory
{
    public string ModuleId { get; set; } = null!;
    public string Version { get; set; } = null!;
    public string EnvironmentName { get; set; } = null!;
    public DateTimeOffset AppliedAtUtc { get; set; }
    public int DurationMs { get; set; }
    public int RecordsAffected { get; set; }
}
