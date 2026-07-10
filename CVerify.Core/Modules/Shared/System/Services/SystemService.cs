using System;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;
using Amazon.S3;
using Amazon.S3.Model;
using StackExchange.Redis;
using CVerify.API.Modules.AiChat.Entities;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.System.DTOs;

namespace CVerify.API.Modules.Shared.System.Services;

public class SystemService : ISystemService
{
    private readonly ApplicationDbContext _context;
    private readonly IConnectionMultiplexer _redis;
    private readonly IHostEnvironment _env;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IAmazonS3 _s3Client;
    private readonly EnvConfiguration _envConfig;

    public SystemService(
        ApplicationDbContext context,
        IConnectionMultiplexer redis,
        IHostEnvironment env,
        IHttpClientFactory httpClientFactory,
        IAmazonS3 s3Client,
        EnvConfiguration envConfig)
    {
        _context = context;
        _redis = redis;
        _env = env;
        _httpClientFactory = httpClientFactory;
        _s3Client = s3Client;
        _envConfig = envConfig;
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

        // 3. AI microservice connectivity readiness probe check
        bool aiHealthy = false;
        try
        {
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(3));
            var client = _httpClientFactory.CreateClient("AiServiceClient");
            var response = await client.GetAsync("/health/ready", cts.Token);
            if (response.IsSuccessStatusCode)
            {
                var content = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(content);
                if (doc.RootElement.TryGetProperty("status", out var statusProp) && statusProp.GetString() == "ready")
                {
                    aiHealthy = true;
                }
            }
        }
        catch (Exception)
        {
            aiHealthy = false;
        }

        // 4. Cloudflare R2 connectivity list objects check
        bool cloudflareHealthy = false;
        try
        {
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(3));
            var request = new ListObjectsV2Request
            {
                BucketName = _envConfig.R2.BucketName,
                MaxKeys = 1
            };
            var result = await _s3Client.ListObjectsV2Async(request, cts.Token);
            if (result.HttpStatusCode == HttpStatusCode.OK)
            {
                cloudflareHealthy = true;
            }
        }
        catch (Exception)
        {
            cloudflareHealthy = false;
        }

        // Auth service depends on PostgreSQL (database) and Redis (permission/token cache) being online
        bool authHealthy = databaseHealthy && redisHealthy;

        bool success = databaseHealthy && redisHealthy && authHealthy && aiHealthy && cloudflareHealthy;

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
                Auth = authHealthy ? "healthy" : "unhealthy",
                Ai = aiHealthy ? "healthy" : "unhealthy",
                Cloudflare = cloudflareHealthy ? "healthy" : "unhealthy"
            }
        };
    }
}
