using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Auth.Services;

public interface IAccountService
{
    Task HandleFailedLoginAsync(User user);
    Task ResetFailedAttemptsAsync(User user);
    bool IsAccountLocked(User user);
    bool IsAccountDisabled(User user);
}
