using CVerify.API.Application.Interfaces;
using CVerify.API.Infrastructure.Persistence;
using CVerify.API.Application.DTOs;
using StackExchange.Redis;
using Microsoft.Extensions.Hosting;

namespace CVerify.API.Infrastructure.Services;

public class SystemService : ISystemService
{
    private readonly ApplicationDbContext _context;
    private readonly IConnectionMultiplexer _redis;
    private readonly IHostEnvironment _env;

    public SystemService(ApplicationDbContext context, IConnectionMultiplexer redis, IHostEnvironment env)
    {
        _context = context;
        _redis = redis;
        _env = env;
    }

    public async Task<DatabaseStatusResponse> CheckDatabaseStatusAsync()
    {
        try
        {
            // check whether the database connection is available
            bool isConnected = await _context.Database.CanConnectAsync();

            return new DatabaseStatusResponse
            {
                Success = isConnected,
                Database = isConnected ? "Connected" : "Disconnected",
                Timestamp = DateTime.UtcNow
            };
        }
        catch (Exception)
        {
            return new DatabaseStatusResponse
            {
                Success = false,
                Database = "Error",
                Timestamp = DateTime.UtcNow
            };
        }
    }

    public async Task<SystemHealthResponse> CheckSystemHealthAsync()
    {
        bool databaseHealthy = false;
        try
        {
            databaseHealthy = await _context.Database.CanConnectAsync();
        }
        catch (Exception)
        {
            databaseHealthy = false;
        }

        bool redisHealthy = false;
        try
        {
            redisHealthy = _redis.IsConnected;
        }
        catch (Exception)
        {
            redisHealthy = false;
        }

        // Auth service depends on PostgreSQL (database) and Redis (permission/token cache) being online
        bool authHealthy = databaseHealthy && redisHealthy;

        bool success = databaseHealthy && redisHealthy && authHealthy;

        return new SystemHealthResponse
        {
            Success = success,
            Message = success ? "System operational" : "System degraded or experiencing issues",
            Timestamp = DateTime.UtcNow,
            Environment = _env.EnvironmentName,
            Services = new HealthServices
            {
                Database = databaseHealthy ? "healthy" : "unhealthy",
                Redis = redisHealthy ? "healthy" : "unhealthy",
                Auth = authHealthy ? "healthy" : "unhealthy"
            }
        };
    }
}
