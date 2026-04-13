using CVerify.API.Modules.Admin.Services;

namespace CVerify.API.Modules.Admin.Services;

public interface IPermissionService
{
    Task<List<string>> GetPermissionsByRoleIdAsync(Guid roleId);
}
