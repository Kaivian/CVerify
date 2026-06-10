using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.Modules.Shared.System.Services;

public interface ICacheService
{
    Task<T?> GetAsync<T>(string key);
    Task SetAsync<T>(string key, T value, TimeSpan? expiration = null);
    Task RemoveAsync(string key);
    Task<bool> ExistsAsync(string key);
    
    // Specific for Permissions/Roles
    Task AddToSetAsync(string key, string value);
    Task<IEnumerable<string>> GetSetAsync(string key);
    Task RemoveFromSetAsync(string key, string value);
    Task<bool> AcquireLockAsync(string key, string value, TimeSpan expiry);
    Task<bool> ReleaseLockAsync(string key, string value);
    Task<bool> SetExpireAsync(string key, TimeSpan expiration);
    Task DeleteAsync(string key);
}

