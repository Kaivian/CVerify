using System;
using System.Threading;
using System.Threading.Tasks;

namespace CVerify.API.Modules.Admin.Services;

public interface IAdminAuthorizationService
{
    Task<bool> AuthorizeAsync(Guid userId, string requiredPermission, CancellationToken cancellationToken = default);
    Task<int> GetSessionVersionAsync(Guid userId, CancellationToken cancellationToken = default);
    Task InvalidateCacheAsync(Guid userId);
}
