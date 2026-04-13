using CVerify.API.Modules.Shared.Persistence;

namespace CVerify.API.Modules.Shared.Persistence;

public interface IIdentityRepository
{
    Task<IEnumerable<string>> GetUserRolesAsync(Guid userId);
    Task<IEnumerable<string>> GetUserPermissionsAsync(Guid userId);
}
