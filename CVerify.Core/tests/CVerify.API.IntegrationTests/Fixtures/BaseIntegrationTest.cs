using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Respawn;
using StackExchange.Redis;
using Xunit;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.Email.Services;


namespace CVerify.API.IntegrationTests.Fixtures;

/// <summary>
/// Custom WebApplicationFactory that overrides Database, Redis, and Email settings to map Testcontainers and Fakes.
/// </summary>
public class IntegrationTestApplicationFactory : WebApplicationFactory<Program>
{
    private readonly SharedTestcontainerFixture _containerFixture;
    
    private readonly System.Collections.Generic.Dictionary<string, string?> _originalEnvVars = new();

    /// <summary>
    /// Holds the Mock/Fake Email Sender to assert sent emails.
    /// </summary>
    public InMemoryEmailSender InMemoryEmailSender { get; } = new();

    /// <summary>
    /// Initializes a new instance of the <see cref="IntegrationTestApplicationFactory"/> class.
    /// </summary>
    public IntegrationTestApplicationFactory(SharedTestcontainerFixture containerFixture, Dictionary<string, string>? envOverrides = null)
    {
        _containerFixture = containerFixture;

        var varsToBackup = new[] { "DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD", "REDIS_HOST", "REDIS_PORT", "REDIS_PASSWORD",
                                   "GOOGLE_CLIENT_ID", "JWT_KEY", "JWT_ISSUER", "JWT_AUDIENCE", "AI_SERVICE_URL", "AI_SERVICE_SHARED_SECRET",
                                   "AI_SERVICE_CLIENT_ID", "CLAUDE_MODEL", "EMAIL_SENDER_EMAIL", "SMTP_HOST", "SMTP_PORT", "SMTP_USERNAME",
                                   "SMTP_PASSWORD", "SENDGRID_API_KEY", "Auth__DisableCsrf", "DISABLE_RATE_LIMITS", "SUPER_ADMIN_PASSWORD",
                                   "SUPER_ADMIN_USERNAME", "SUPER_ADMIN_FULL_NAME", "SEED_TEST_ACCOUNTS", "ASPNETCORE_ENVIRONMENT" };

        foreach (var v in varsToBackup)
        {
            _originalEnvVars[v] = Environment.GetEnvironmentVariable(v);
        }

        // Parse dynamic Testcontainer Postgres connection parameters
        var dbBuilder = new Npgsql.NpgsqlConnectionStringBuilder(_containerFixture.DbConnectionString);
        Environment.SetEnvironmentVariable("DB_HOST", dbBuilder.Host);
        Environment.SetEnvironmentVariable("DB_PORT", dbBuilder.Port.ToString());
        Environment.SetEnvironmentVariable("DB_NAME", dbBuilder.Database);
        Environment.SetEnvironmentVariable("DB_USER", dbBuilder.Username);
        Environment.SetEnvironmentVariable("DB_PASSWORD", dbBuilder.Password);

        // Parse dynamic Testcontainer Redis connection parameters and append allowAdmin=true
        var redisConnStr = _containerFixture.RedisConnectionString;
        if (redisConnStr.StartsWith("redis://", StringComparison.OrdinalIgnoreCase))
        {
            redisConnStr = redisConnStr.Substring("redis://".Length);
        }
        var redisParts = redisConnStr.Split(':');
        Environment.SetEnvironmentVariable("REDIS_HOST", redisParts[0]);
        Environment.SetEnvironmentVariable("REDIS_PORT", redisParts[1] + ",allowAdmin=true");
        Environment.SetEnvironmentVariable("REDIS_PASSWORD", "");

        // Set mock environment variables to satisfy EnvValidator during Program startup
        Environment.SetEnvironmentVariable("GOOGLE_CLIENT_ID", "mock-google-client-id");
        Environment.SetEnvironmentVariable("JWT_KEY", "super_secret_key_super_secret_key_super_secret_key_32_characters");
        Environment.SetEnvironmentVariable("JWT_ISSUER", "CVerify.API");
        Environment.SetEnvironmentVariable("JWT_AUDIENCE", "CVerify.Client");
        Environment.SetEnvironmentVariable("AI_SERVICE_URL", "http://localhost:8000");
        Environment.SetEnvironmentVariable("AI_SERVICE_SHARED_SECRET", "test_shared_secret_test_shared_secret_32_chars");
        Environment.SetEnvironmentVariable("AI_SERVICE_CLIENT_ID", "cverify-core");
        Environment.SetEnvironmentVariable("CLAUDE_MODEL", "claude-3-5-sonnet-20241022");
        Environment.SetEnvironmentVariable("EMAIL_SENDER_EMAIL", "test@cverify.ai");
        Environment.SetEnvironmentVariable("SMTP_HOST", "127.0.0.1");
        Environment.SetEnvironmentVariable("SMTP_PORT", "25");
        Environment.SetEnvironmentVariable("SMTP_USERNAME", "test_user");
        Environment.SetEnvironmentVariable("SMTP_PASSWORD", "test_pass");
        Environment.SetEnvironmentVariable("SENDGRID_API_KEY", "mock-sendgrid-api-key");
        Environment.SetEnvironmentVariable("Auth__DisableCsrf", "true");
        Environment.SetEnvironmentVariable("DISABLE_RATE_LIMITS", "false");
        Environment.SetEnvironmentVariable("SUPER_ADMIN_PASSWORD", "mock-super-admin-password");
        Environment.SetEnvironmentVariable("SUPER_ADMIN_USERNAME", "mockadmin");
        Environment.SetEnvironmentVariable("SUPER_ADMIN_FULL_NAME", "Mock Administrator");
        Environment.SetEnvironmentVariable("SEED_TEST_ACCOUNTS", "false");

        // Apply custom environment overrides if provided (e.g., stress test rate limit overrides)
        if (envOverrides != null)
        {
            foreach (var kvp in envOverrides)
            {
                Environment.SetEnvironmentVariable(kvp.Key, kvp.Value);
            }
        }
    }

    /// <inheritdoc />
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureAppConfiguration((context, config) =>
        {
            // Override database connection strings and Redis endpoints dynamically
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                { "ConnectionStrings:DefaultConnection", _containerFixture.DbConnectionString },
                { "ConnectionStrings:Redis", (_containerFixture.RedisConnectionString.StartsWith("redis://", StringComparison.OrdinalIgnoreCase) ? _containerFixture.RedisConnectionString.Substring("redis://".Length) : _containerFixture.RedisConnectionString) + ",allowAdmin=true" },
                { "EmailSettings:Provider", "Smtp" },
                { "EmailSettings:SenderEmail", "test@cverify.ai" },
                { "EmailSettings:SenderName", "CVerify Test Suite" },
                { "EmailSettings:Smtp:Host", "127.0.0.1" },
                { "EmailSettings:Smtp:Port", "25" },
                { "EmailSettings:Smtp:Username", "test_user" },
                { "EmailSettings:Smtp:Password", "test_pass" },
                { "EmailSettings:Smtp:EnableSsl", "false" },
                { "EmailSettings:EnableBackgroundQueue", "false" },
                { "EmailSettings:TimeoutSeconds", "10" },
                { "Auth:GoogleClientId", "mock-google-client-id" },
                { "Auth:DisableCsrf", "true" },
                { "Jwt:Key", "super_secret_key_super_secret_key_super_secret_key_32_characters" },
                { "Security:DisableRateLimits", Environment.GetEnvironmentVariable("DISABLE_RATE_LIMITS") ?? "false" },
                { "RateLimit:ForgotPasswordPermitLimit", "1000" },
                { "RateLimit:ResetPasswordPermitLimit", "1000" },
                { "RateLimit:ResendVerificationPermitLimit", "1000" },
                { "RateLimit:VerifyEmailPermitLimit", "1000" },
                { "RateLimit:RegisterPermitLimit", "1000" }
            });
        });
        builder.ConfigureServices(services =>
        {
            // Remove real transport, decorator, and storage client bindings completely
            for (int i = services.Count - 1; i >= 0; i--)
            {
                var descriptor = services[i];
                if (descriptor.ServiceType == typeof(IEmailSender))
                {
                    services.RemoveAt(i);
                }
                else if (descriptor.ServiceType == typeof(Amazon.S3.IAmazonS3))
                {
                    services.RemoveAt(i);
                }
                else if (descriptor.ServiceType == typeof(IHostedService) && 
                         descriptor.ImplementationType != null &&
                         descriptor.ImplementationType != typeof(CVerify.API.Modules.Shared.Diagnostics.AppLoggingBackgroundWorker))
                {
                    services.RemoveAt(i);
                }
            }

            // Register our Single in-memory fake sender in DI
            services.AddSingleton<IEmailSender>(InMemoryEmailSender);
            services.AddKeyedSingleton<IEmailSender>("raw", InMemoryEmailSender);

            // Register in-memory fake IAmazonS3 client in DI to prevent external R2 API timeouts
            var inMemoryS3Files = new System.Collections.Concurrent.ConcurrentDictionary<string, (byte[] Data, Amazon.S3.Model.MetadataCollection Metadata)>();
            var mockS3 = new Moq.Mock<Amazon.S3.IAmazonS3>();
            
            mockS3.Setup(x => x.PutObjectAsync(Moq.It.IsAny<Amazon.S3.Model.PutObjectRequest>(), Moq.It.IsAny<CancellationToken>()))
                .Returns<Amazon.S3.Model.PutObjectRequest, CancellationToken>(async (req, ct) =>
                {
                    byte[] data;
                    if (req.InputStream != null)
                    {
                        using var ms = new MemoryStream();
                        req.InputStream.CopyTo(ms);
                        data = ms.ToArray();
                    }
                    else if (!string.IsNullOrEmpty(req.FilePath))
                    {
                        data = File.ReadAllBytes(req.FilePath);
                    }
                    else
                    {
                        data = Array.Empty<byte>();
                    }

                    inMemoryS3Files[req.Key] = (data, req.Metadata);
                    return new Amazon.S3.Model.PutObjectResponse { HttpStatusCode = System.Net.HttpStatusCode.OK };
                });

            mockS3.Setup(x => x.GetObjectAsync(Moq.It.IsAny<Amazon.S3.Model.GetObjectRequest>(), Moq.It.IsAny<CancellationToken>()))
                .Returns<Amazon.S3.Model.GetObjectRequest, CancellationToken>(async (req, ct) =>
                {
                    if (inMemoryS3Files.TryGetValue(req.Key, out var file))
                    {
                        var response = new Amazon.S3.Model.GetObjectResponse
                        {
                            HttpStatusCode = System.Net.HttpStatusCode.OK,
                            ResponseStream = new MemoryStream(file.Data),
                            Key = req.Key
                        };
                        foreach (var key in file.Metadata.Keys)
                        {
                            response.Metadata[key] = file.Metadata[key];
                        }
                        return response;
                    }
                    throw new Amazon.S3.AmazonS3Exception("NoSuchKey", Amazon.Runtime.ErrorType.Sender, "NoSuchKey", "", System.Net.HttpStatusCode.NotFound);
                });

            mockS3.Setup(x => x.DeleteObjectAsync(Moq.It.IsAny<Amazon.S3.Model.DeleteObjectRequest>(), Moq.It.IsAny<CancellationToken>()))
                .Returns<Amazon.S3.Model.DeleteObjectRequest, CancellationToken>(async (req, ct) =>
                {
                    inMemoryS3Files.TryRemove(req.Key, out _);
                    return new Amazon.S3.Model.DeleteObjectResponse { HttpStatusCode = System.Net.HttpStatusCode.OK };
                });

            mockS3.Setup(x => x.GetPreSignedURL(Moq.It.IsAny<Amazon.S3.Model.GetPreSignedUrlRequest>()))
                .Returns((Amazon.S3.Model.GetPreSignedUrlRequest req) => $"https://mock-s3.local/{req.BucketName}/{req.Key}");

            services.AddSingleton<Amazon.S3.IAmazonS3>(mockS3.Object);

            // Mock IHttpClientFactory to return a stubbed response for VietQR v2 business tax registry lookups
            var mockFactory = new Moq.Mock<IHttpClientFactory>();
            var mockHandler = new MockHttpMessageHandler();
            var mockClient = new HttpClient(mockHandler)
            {
                BaseAddress = new Uri("https://api.vietqr.io")
            };
            mockFactory.Setup(_ => _.CreateClient(Moq.It.IsAny<string>())).Returns(mockClient);
            services.Replace(ServiceDescriptor.Singleton<IHttpClientFactory>(mockFactory.Object));
        });
    }

    /// <inheritdoc />
    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing)
        {
            foreach (var kvp in _originalEnvVars)
            {
                Environment.SetEnvironmentVariable(kvp.Key, kvp.Value);
            }
        }
    }
}

/// <summary>
/// Master base class for executing integration tests.
/// Ensures Postgres and Redis databases are wiped clean in milliseconds between individual test cases.
/// </summary>
[Collection("Shared Containers Collection")]
public abstract class BaseIntegrationTest : IAsyncLifetime
{
    private readonly SharedTestcontainerFixture _containerFixture;
    private Respawner? _respawner;

    /// <summary>
    /// The customized test application factory.
    /// </summary>
    protected IntegrationTestApplicationFactory Factory { get; }

    /// <summary>
    /// Pre-configured HTTP client to call API endpoints.
    /// </summary>
    protected HttpClient Client { get; }

    /// <summary>
    /// Direct access to intercepted email dispatches.
    /// </summary>
    protected InMemoryEmailSender EmailSender => Factory.InMemoryEmailSender;

    /// <summary>
    /// Initializes a new instance of the <see cref="BaseIntegrationTest"/> class.
    /// </summary>
    protected BaseIntegrationTest(SharedTestcontainerFixture containerFixture, Dictionary<string, string>? envOverrides = null)
    {
        _containerFixture = containerFixture;
        Factory = new IntegrationTestApplicationFactory(_containerFixture, envOverrides);
        Client = Factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });
    }

    /// <inheritdoc />
    public async Task InitializeAsync()
    {
        // Clear all previously sent emails
        EmailSender.Clear();

        // Perform fast-wipe DB and Cache resets
        await ResetDatabaseSchemaAsync().ConfigureAwait(false);
        await ResetRedisCacheAsync().ConfigureAwait(false);
    }

    /// <inheritdoc />
    public Task DisposeAsync()
    {
        Client.Dispose();
        Factory.Dispose();
        return Task.CompletedTask;
    }

    private async Task ResetDatabaseSchemaAsync()
    {
        if (_respawner == null)
        {
            using var connection = new Npgsql.NpgsqlConnection(_containerFixture.DbConnectionString);
            await connection.OpenAsync().ConfigureAwait(false);

            _respawner = await Respawner.CreateAsync(connection, new RespawnerOptions
            {
                DbAdapter = DbAdapter.Postgres,
                SchemasToInclude = new[] { "public" },
                TablesToIgnore = new Respawn.Graph.Table[] { "__EFMigrationsHistory" }
            }).ConfigureAwait(false);
        }

        using var conn = new Npgsql.NpgsqlConnection(_containerFixture.DbConnectionString);
        await conn.OpenAsync().ConfigureAwait(false);
        await _respawner.ResetAsync(conn).ConfigureAwait(false);
    }

    private async Task ResetRedisCacheAsync()
    {
        var multiplexer = Factory.Services.GetRequiredService<IConnectionMultiplexer>();
        var endpoints = multiplexer.GetEndPoints();
        foreach (var ep in endpoints)
        {
            var server = multiplexer.GetServer(ep);
            await server.FlushDatabaseAsync().ConfigureAwait(false);
        }
    }
}

public class MockHttpMessageHandler : HttpMessageHandler
{
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, System.Threading.CancellationToken cancellationToken)
    {
        var response = new HttpResponseMessage(System.Net.HttpStatusCode.OK)
        {
            Content = new StringContent(
                "{\"code\":\"00\",\"desc\":\"success\",\"data\":{\"name\":\"CÔNG TY TNHH PHẦN MỀM FPT\",\"status\":\"đang hoạt động\"}}",
                System.Text.Encoding.UTF8,
                "application/json")
        };
        return Task.FromResult(response);
    }
}
