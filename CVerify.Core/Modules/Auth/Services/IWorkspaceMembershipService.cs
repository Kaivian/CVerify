using System;
using System.Threading;
using System.Threading.Tasks;

namespace CVerify.API.Modules.Auth.Services;

public interface IWorkspaceMembershipService
{
    Task DiscoverPendingInvitationsAsync(Guid userId);
    Task BootstrapInitialAdminAsync(string email, bool isRegistrationActivation = false, CancellationToken cancellationToken = default);
}
