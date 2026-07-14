using System.Collections.Generic;

namespace CVerify.API.Modules.Shared.Persistence;

public class SeedingConfig
{
    public bool Enabled { get; set; } = true;
    public string Environment { get; set; } = "Development";
    public bool GenerateDemoData { get; set; } = false;
    public bool ResetDatabase { get; set; } = false;
    public bool VerboseLogging { get; set; } = false;
    public bool DryRun { get; set; } = false;
    public List<string>? EnabledModules { get; set; }
    public string? SuperAdminEmail { get; set; }
    public string? SuperAdminUsername { get; set; }
    public string? SuperAdminFullName { get; set; }
    public string? SuperAdminPassword { get; set; }
    public string? BusinessPassword { get; set; }
    public string SeedDataPath { get; set; } = "resources/seed-business-data.json";
    public string PublicDemoDataPath { get; set; } = "resources/public-workspace-demo-content.json";
}
