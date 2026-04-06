using System;
using System.IO;
using System.Threading.Tasks;
using DotNet.Testcontainers.Builders;
using Npgsql;
using Testcontainers.PostgreSql;
using Testcontainers.Redis;
using Xunit;

namespace CVerify.API.IntegrationTests.Fixtures;

/// <summary>
/// A shared database and cache container fixture that handles PostgreSQL and Redis container life cycles.
/// Uses xUnit ICollectionFixture to ensure containers are initialized once for all tests in the collection.
/// </summary>
public class SharedTestcontainerFixture : IAsyncLifetime
{
    static SharedTestcontainerFixture()
    {
        // Define all environment variables utilized as placeholders in appsettings.json
        Environment.SetEnvironmentVariable("DB_HOST", "127.0.0.1");
        Environment.SetEnvironmentVariable("DB_PORT", "5432");
        Environment.SetEnvironmentVariable("DB_NAME", "cverify_db");
        Environment.SetEnvironmentVariable("DB_USER", "postgres");
        Environment.SetEnvironmentVariable("DB_PASSWORD", "postgres");
        Environment.SetEnvironmentVariable("REDIS_HOST", "127.0.0.1");
        Environment.SetEnvironmentVariable("REDIS_PORT", "6379");
        Environment.SetEnvironmentVariable("REDIS_PASSWORD", "redis_pass");
        Environment.SetEnvironmentVariable("JWT_KEY", "HighlySecureSuperLongDevSecretKeyWithAtLeast32Bytes!");
        Environment.SetEnvironmentVariable("EMAIL_SENDER_EMAIL", "test@cverify.ai");
        Environment.SetEnvironmentVariable("SMTP_HOST", "127.0.0.1");
        Environment.SetEnvironmentVariable("SMTP_PORT", "25");
        Environment.SetEnvironmentVariable("SMTP_USERNAME", "test_user");
        Environment.SetEnvironmentVariable("SMTP_PASSWORD", "test_password");
        Environment.SetEnvironmentVariable("SENDGRID_API_KEY", "SG.test_key");
    }

    private readonly PostgreSqlContainer _dbContainer = new PostgreSqlBuilder()
        .WithDatabase("cverify_integration_db")
        .WithUsername("test_user")
        .WithPassword("secure_password")
        .Build();

    private readonly RedisContainer _redisContainer = new RedisBuilder()
        .Build();

    /// <summary>
    /// Database connection string.
    /// </summary>
    public string DbConnectionString => _dbContainer.GetConnectionString();

    /// <summary>
    /// Redis connection string.
    /// </summary>
    public string RedisConnectionString => _redisContainer.GetConnectionString();

    /// <inheritdoc />
    public async Task InitializeAsync()
    {
        // Start Postgres and Redis containers in parallel
        await Task.WhenAll(_dbContainer.StartAsync(), _redisContainer.StartAsync()).ConfigureAwait(false);

        // Execute the actual repository SQL schema seed from resources
        await InitializeDbSchemaAsync().ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task DisposeAsync()
    {
        await Task.WhenAll(
            _dbContainer.DisposeAsync().AsTask(),
            _redisContainer.DisposeAsync().AsTask()
        ).ConfigureAwait(false);
    }

    private async Task InitializeDbSchemaAsync()
    {
        // Search absolute pathway first, fallback to relative lookup if run in nested directories
        var scriptPath = @"d:\Coding Space\FPT\swp391-su26-ai-audit-project-swp391_se20a02_group-05\CVerify\resources\Initialize SQL.sql";
        if (!File.Exists(scriptPath))
        {
            var currentDir = AppContext.BaseDirectory;
            while (currentDir != null && !File.Exists(Path.Combine(currentDir, "resources", "Initialize SQL.sql")))
            {
                currentDir = Directory.GetParent(currentDir)?.FullName;
            }
            if (currentDir != null)
            {
                scriptPath = Path.Combine(currentDir, "resources", "Initialize SQL.sql");
            }
        }

        if (!File.Exists(scriptPath))
        {
            throw new FileNotFoundException("Crucial database seed schema file 'Initialize SQL.sql' could not be resolved.");
        }

        var sql = await File.ReadAllTextAsync(scriptPath).ConfigureAwait(false);

        // Execute raw schema migration directly on the PostgreSQL container using ADO.NET
        using var connection = new NpgsqlConnection(DbConnectionString);
        await connection.OpenAsync().ConfigureAwait(false);
        using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync().ConfigureAwait(false);
    }
}

/// <summary>
/// Definition class for collection-fixture mapping across multiple integration test suites.
/// </summary>
[CollectionDefinition("Shared Containers Collection")]
public class SharedContainersCollection : ICollectionFixture<SharedTestcontainerFixture>
{
    // Class has no code; it is purely a target definition for the CollectionFixture assembly mapping
}
