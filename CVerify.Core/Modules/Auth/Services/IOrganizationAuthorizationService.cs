using System;
using System.Threading;
using System.Threading.Tasks;

namespace CVerify.API.Modules.Auth.Services;

public interface IOrganizationAuthorizationService
{
    Task<bool> AuthorizeAsync(Guid userId, Guid organizationId, string requiredPermission, CancellationToken cancellationToken = default);
    Task<bool> IsMemberAsync(Guid userId, Guid organizationId, CancellationToken cancellationToken = default);
}
