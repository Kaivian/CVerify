using System.Text.Json;
using StackExchange.Redis;

namespace CVerify.API.Modules.Shared.System.Services;

public class CacheService : ICacheService
{
    private readonly IConnectionMultiplexer _redis;
    private readonly IDatabase _db;

    public CacheService(IConnectionMultiplexer redis)
    {
        _redis = redis;
        _db = _redis.GetDatabase();
    }

    public async Task<T?> GetAsync<T>(string key)
    {
        var value = await _db.StringGetAsync(key);
        if (value.IsNullOrEmpty) return default;
        return JsonSerializer.Deserialize<T>(value.ToString());
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan? expiration = null)
    {
        var json = JsonSerializer.Serialize(value);

        // Handling expiration explicitly to avoid overload resolution issues in some Redis client versions
        if (expiration.HasValue)
        {
            await _db.StringSetAsync(key, json, expiration.Value);
        }
        else
        {
            await _db.StringSetAsync(key, json);
        }
    }

    public async Task RemoveAsync(string key)
    {
        await _db.KeyDeleteAsync(key);
    }

    public async Task<bool> ExistsAsync(string key)
    {
        return await _db.KeyExistsAsync(key);
    }

    public async Task AddToSetAsync(string key, string value)
    {
        await _db.SetAddAsync(key, value);
    }

    public async Task<IEnumerable<string>> GetSetAsync(string key)
    {
        var values = await _db.SetMembersAsync(key);
        return values.Select(x => x.ToString());
    }

    public async Task RemoveFromSetAsync(string key, string value)
    {
        await _db.SetRemoveAsync(key, value);
    }

    public async Task<bool> AcquireLockAsync(string key, string value, TimeSpan expiry)
    {
        return await _db.LockTakeAsync(key, value, expiry);
    }

    public async Task<bool> ReleaseLockAsync(string key, string value)
    {
        return await _db.LockReleaseAsync(key, value);
    }

    public async Task<bool> SetExpireAsync(string key, TimeSpan expiration)
    {
        return await _db.KeyExpireAsync(key, expiration);
    }

    public async Task DeleteAsync(string key)
    {
        await _db.KeyDeleteAsync(key);
    }
}

