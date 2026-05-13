using System;
using System.Threading.Tasks;

namespace CVerify.API.Modules.Shared.Persistence;

/// <summary>
/// Defines a seeder plugin for provisioning elements of the organization aggregate public workspace.
/// </summary>
public interface IPublicWorkspaceModuleSeeder
{
    /// <summary>
    /// Friendly name of the module being seeded.
    /// </summary>
    string ModuleName { get; }

    /// <summary>
    /// Seeds public workspace content for a specific organization from the deserialized aggregate DTO.
    /// </summary>
    Task SeedModuleAsync(Guid organizationId, object orgDto, ApplicationDbContext context);
}
