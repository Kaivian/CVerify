namespace CVerify.API.Application.Interfaces;

public interface IPermissionService
{
    Task<List<string>> GetPermissionsByRoleIdAsync(Guid roleId);
}
