using System;
using System.Threading;
using System.Threading.Tasks;

namespace CVerify.API.Modules.Auth.Services;

public interface IOrganizationBootstrapService
{
    Task BootstrapOrganizationAsync(Guid orgId, Guid creatorUserId, CancellationToken cancellationToken = default);
    Task SeedDefaultRolesForTenantAsync(Guid orgId, CancellationToken cancellationToken = default);
}
