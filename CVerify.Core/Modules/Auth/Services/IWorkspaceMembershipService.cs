using System;
using System.Threading;
using System.Threading.Tasks;

namespace CVerify.API.Modules.Auth.Services;

public interface IWorkspaceMembershipService
{
    Task ClaimPendingRelationshipsAsync(Guid userId);
    Task BootstrapInitialAdminAsync(string email, CancellationToken cancellationToken = default);
}
