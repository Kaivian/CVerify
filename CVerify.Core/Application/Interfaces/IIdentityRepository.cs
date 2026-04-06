namespace CVerify.API.Application.Interfaces;

public interface IIdentityRepository
{
    Task<IEnumerable<string>> GetUserRolesAsync(Guid userId);
    Task<IEnumerable<string>> GetUserPermissionsAsync(Guid userId);
}
