using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using Amazon.S3;
using Npgsql;
using StackExchange.Redis;
using CVerify.API.Modules.Admin.Hubs;
using CVerify.API.Modules.Admin.Services;
using CVerify.API.Modules.AiChat.Entities;
using CVerify.API.Modules.Auth.BackgroundWorkers;
using CVerify.API.Modules.Auth.Middleware;
using CVerify.API.Modules.Auth.Services;
using CVerify.API.Modules.Auth.Services.OtpPolicies;
using CVerify.API.Modules.Auth.Services.PasswordPolicies;
using CVerify.API.Modules.Profiles.Services;
using CVerify.API.Modules.Profiles.BackgroundWorkers;
using CVerify.API.Modules.Recovery.BackgroundWorkers;
using CVerify.API.Modules.Recovery.Services;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.Diagnostics;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Email.BackgroundWorkers;
using CVerify.API.Modules.Shared.Exceptions;
using CVerify.API.Modules.Shared.Exceptions.Catalogs;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Security;
using CVerify.API.Modules.Shared.Storage.Interfaces;
using CVerify.API.Modules.Shared.Storage.Services;
using CVerify.API.Modules.Shared.System.DTOs;
using CVerify.API.Modules.Shared.System.Services;
using CVerify.API.Modules.Shared.Email;
using CVerify.API.Modules.Shared.Security.Authorization;
using CVerify.API.Modules.Shared.System.BackgroundWorkers;
using CVerify.API.Modules.SourceCode.Services;
using CVerify.API.Modules.SourceCode.BackgroundWorkers;
using CVerify.API.Modules.Shared.Domain.Services;
using CVerify.API.Modules.SourceCode.Clients;
using CVerify.API.Modules.Shared.Domain.Resolvers;
using CVerify.API.Modules.Shared.Hubs;


var builder = WebApplication.CreateBuilder(args);

builder.Host.UseDefaultServiceProvider((context, options) =>
{
    options.ValidateOnBuild = true;
    options.ValidateScopes = true;
});

// 1. Load .env file (Development only or based on preference)
string? envPath = null;
var currentDir = new DirectoryInfo(AppContext.BaseDirectory);
while (currentDir != null)
{
    var path = Path.Combine(currentDir.FullName, ".env");
    if (File.Exists(path))
    {
        envPath = path;
        break;
    }
    currentDir = currentDir.Parent;
}

if (envPath == null)
{
    var fallback = Path.Combine(Directory.GetCurrentDirectory(), ".env");
    if (File.Exists(fallback))
    {
        envPath = fallback;
    }
}

if (envPath != null) {
    foreach (var line in File.ReadAllLines(envPath)) {
        var parts = line.Split('=', 2, StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 2 && !parts[0].StartsWith("#")) {
            var key = parts[0].Trim();
            var val = parts[1].Trim();
            if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable(key))) {
                Environment.SetEnvironmentVariable(key, val);
            }
        }
    }
    // Re-build configuration to populate dynamically injected variables
    builder.Configuration.AddEnvironmentVariables();
}

// 2. Validate & Resolve Configuration (Enterprise Clean Code: Fail Fast)
var envConfig = EnvValidator.Validate(builder.Configuration);
if (builder.Environment.IsProduction() || builder.Environment.EnvironmentName.Equals("Production", StringComparison.OrdinalIgnoreCase))
{
    if (envConfig.Security.DisableRateLimits)
    {
        throw new InvalidOperationException("Fatal: Rate limits cannot be disabled in the Production environment.");
    }
    if (envConfig.Seeding.SeedTestAccounts)
    {
        throw new InvalidOperationException("Fatal: Test account seeding cannot be enabled in the Production environment.");
    }
    if (string.IsNullOrWhiteSpace(envConfig.Security.TokenEncryptionKey) ||
        envConfig.Security.TokenEncryptionKey == "DEVELOPMENT_TOKEN_ENCRYPTION_KEY" ||
        envConfig.Security.TokenEncryptionKey == "your_32_byte_token_encryption_key_here")
    {
        throw new InvalidOperationException("Fatal: TokenEncryptionKey is missing or is a default fallback key in the Production environment.");
    }
}
builder.Services.AddSingleton(envConfig);


// Clear default loggers to prevent duplicate output and console noise
builder.Logging.ClearProviders();

// Configure CORS (Cross-Origin Resource Sharing)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        var allowedOrigins = new List<string> { "http://localhost:3000", "http://127.0.0.1:3000" };
        var configuredFrontend = envConfig.Auth.FrontendUrl?.TrimEnd('/');
        if (!string.IsNullOrEmpty(configuredFrontend) && !allowedOrigins.Contains(configuredFrontend))
        {
            allowedOrigins.Add(configuredFrontend);
        }

        policy.WithOrigins(allowedOrigins.ToArray())
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Add services to the container.
builder.Services.AddOpenApi(options =>
{
    // Add JWT security scheme to the OpenAPI document
    options.AddDocumentTransformer((document, context, cancellationToken) =>
    {
        // 1. Ensure Components and the SecuritySchemes dictionary are initialized
        document.Components ??= new OpenApiComponents();
        document.Components.SecuritySchemes ??= new Dictionary<string, IOpenApiSecurityScheme>();

        document.Components.SecuritySchemes.Add("Bearer", new OpenApiSecurityScheme
        {
            Type = SecuritySchemeType.Http,
            Scheme = "bearer",
            BearerFormat = "JWT",
            Description = "Enter your JWT token in the format: Bearer {token}"
        });
        
        // 2. Ensure the Security requirements list is initialized before adding
        document.Security ??= new List<OpenApiSecurityRequirement>();

        document.Security.Add(new OpenApiSecurityRequirement
        {
            [new OpenApiSecuritySchemeReference("Bearer", document)] = new List<string>()
        });
        
        return Task.CompletedTask;
    });
});
builder.Services.AddControllers()
    .ConfigureApiBehaviorOptions(options =>
    {
        options.InvalidModelStateResponseFactory = context =>
        {
            var errors = new Dictionary<string, string[]>();
            foreach (var (key, value) in context.ModelState)
            {
                if (value.Errors.Count > 0)
                {
                    var messages = new List<string>();
                    foreach (var error in value.Errors)
                    {
                        messages.Add(error.ErrorMessage);
                    }
                    errors.Add(key, messages.ToArray());
                }
            }

            var correlationId = AsyncLocalCorrelationScope.CurrentCorrelationId 
                                ?? context.HttpContext.TraceIdentifier;

            var responsePayload = new ApiErrorResponse
            {
                Status = Microsoft.AspNetCore.Http.StatusCodes.Status400BadRequest,
                Code = SystemErrorCatalog.ValidationError,
                Category = ErrorCategory.VALIDATION.ToString(),
                Severity = "Error",
                MessageKey = "system.toast.error.validation",
                Message = "Please check the form fields for errors.",
                Retryable = false,
                Errors = errors,
                CorrelationId = correlationId,
                UxSemantics = new UxSemantics("Inline", "None", string.Empty, string.Empty)
            };

            return new Microsoft.AspNetCore.Mvc.BadRequestObjectResult(responsePayload)
            {
                ContentTypes = { "application/json" }
            };
        };
    })
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(
            new System.Text.Json.Serialization.JsonStringEnumConverter());
    });
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = true;
});
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();
builder.Services.AddHttpContextAccessor();


// Configure IP-partitioned Rate Limiting
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddPolicy("ForgotPasswordLimit", context =>
    {
        var config = context.RequestServices.GetRequiredService<EnvConfiguration>();
        var limit = config.Security.DisableRateLimits ? 99999 : config.RateLimit.ForgotPasswordPermitLimit;
        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? context.Request.Headers["X-Forwarded-For"].ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = limit,
                Window = TimeSpan.FromMinutes(config.RateLimit.ForgotPasswordWindowMinutes),
                QueueLimit = 0
            });
    });

    options.AddPolicy("ResetPasswordLimit", context =>
    {
        var config = context.RequestServices.GetRequiredService<EnvConfiguration>();
        var limit = config.Security.DisableRateLimits ? 99999 : config.RateLimit.ResetPasswordPermitLimit;
        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? context.Request.Headers["X-Forwarded-For"].ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = limit,
                Window = TimeSpan.FromMinutes(config.RateLimit.ResetPasswordWindowMinutes),
                QueueLimit = 0
            });
    });

    options.AddPolicy("ResendVerificationLimit", context =>
    {
        var config = context.RequestServices.GetRequiredService<EnvConfiguration>();
        var limit = config.Security.DisableRateLimits ? 99999 : config.RateLimit.ResendVerificationPermitLimit;
        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? context.Request.Headers["X-Forwarded-For"].ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = limit,
                Window = TimeSpan.FromMinutes(config.RateLimit.ResendVerificationWindowMinutes),
                QueueLimit = 0
            });
    });

    options.AddPolicy("VerifyEmailLimit", context =>
    {
        var config = context.RequestServices.GetRequiredService<EnvConfiguration>();
        var limit = config.Security.DisableRateLimits ? 99999 : config.RateLimit.VerifyEmailPermitLimit;
        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? context.Request.Headers["X-Forwarded-For"].ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = limit,
                Window = TimeSpan.FromMinutes(config.RateLimit.VerifyEmailWindowMinutes),
                QueueLimit = 0
            });
    });

    options.AddPolicy("RegisterLimit", context =>
    {
        var config = context.RequestServices.GetRequiredService<EnvConfiguration>();
        var limit = config.Security.DisableRateLimits ? 99999 : config.RateLimit.RegisterPermitLimit;
        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? context.Request.Headers["X-Forwarded-For"].ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = limit,
                Window = TimeSpan.FromMinutes(config.RateLimit.RegisterWindowMinutes),
                QueueLimit = 0
            });
    });

    options.AddPolicy("AiChatLimit", context =>
    {
        var config = context.RequestServices.GetRequiredService<EnvConfiguration>();
        var limit = config.Security.DisableRateLimits ? 99999 : 10;
        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value 
                          ?? context.Connection.RemoteIpAddress?.ToString() 
                          ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = limit,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            });
    });
});


// Configure EF Core with PostgreSQL (MapEnum inside UseNpgsql handles both EF Core + ADO.NET layers)
builder.Services.AddDbContext<ApplicationDbContext>((sp, options) =>
{
    options.UseNpgsql(envConfig.Database.ConnectionString, o => o
                .MapEnum<UserStatus>("user_status")
                .UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery))
           .UseSnakeCaseNamingConvention();

    options.AddInterceptors(sp.GetRequiredService<SlowQueryInterceptor>());

    if (envConfig.Database.EnableSqlLogging)
    {
        options.EnableSensitiveDataLogging();
    }
});

// Configure Redis
builder.Services.AddSingleton<IConnectionMultiplexer>(ConnectionMultiplexer.Connect(envConfig.Redis.ConnectionString));

// Register Diagnostics & Telemetry
builder.Services.AddSingleton<AuthMetrics>();
builder.Services.AddSingleton<PipelineTelemetry>();
builder.Services.AddSingleton<AppLoggerPipeline>();
builder.Services.AddSingleton<IAppLogger, AppLogger>();
builder.Services.AddSingleton<SlowQueryInterceptor>();
builder.Services.AddSingleton<ILoggerProvider, AppLoggingProvider>();
builder.Services.AddHostedService<AppLoggingBackgroundWorker>();

// Register Infrastructure & Data Services
builder.Services.AddSingleton<IRateLimitPolicyService, RateLimitPolicyService>();
builder.Services.AddScoped<IIdentityRepository, IdentityRepository>();
builder.Services.AddScoped<ISystemService, SystemService>();
builder.Services.AddScoped<ICacheService, CacheService>();
builder.Services.AddScoped<ITokenService, TokenService>();
builder.Services.AddScoped<IUsernameService, UsernameService>();
builder.Services.AddScoped<IEncryptedFileStorageService, EncryptedFileStorageService>();
builder.Services.AddScoped<IGoogleTokenValidator, GoogleTokenValidator>();


// Register Cloudflare R2 Object Storage Stack (IAmazonS3 + IStorageService)
builder.Services.AddSingleton<IAmazonS3>(sp =>
{
    Amazon.AWSConfigsS3.UseSignatureVersion4 = true;
    var config = sp.GetRequiredService<EnvConfiguration>();
    var s3Config = new AmazonS3Config
    {
        ServiceURL = config.R2.Endpoint,
        ForcePathStyle = true, // Standard S3-compatible path resolution for Cloudflare R2
        AuthenticationRegion = "us-east-1" // Force AWS Signature Version 4 for Cloudflare R2 compatibility
    };
    return new AmazonS3Client(config.R2.AccessKeyId, config.R2.SecretAccessKey, s3Config);
});
builder.Services.AddScoped<IStorageService, R2StorageService>();

// Register Application Services
builder.Services.AddScoped<IAccountService, AccountService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IWorkspaceProvisioningService, WorkspaceProvisioningService>();
builder.Services.AddScoped<IWorkspaceMembershipService, WorkspaceMembershipService>();
builder.Services.AddScoped<IOrganizationAuthorizationService, OrganizationAuthorizationService>();
builder.Services.AddScoped<IOrganizationBootstrapService, OrganizationBootstrapService>();
builder.Services.AddScoped<IBusinessRoleService, BusinessRoleService>();
builder.Services.AddScoped<IOrganizationInvitationService, OrganizationInvitationService>();
builder.Services.AddScoped<IPasswordRecoveryService, PasswordRecoveryService>();
builder.Services.AddScoped<IPermissionService, PermissionService>();
builder.Services.AddScoped<IAdminAuthorizationService, AdminAuthorizationService>();
builder.Services.AddScoped<IAdminMemberService, AdminMemberService>();
builder.Services.AddScoped<IIdentityStateResolver, IdentityStateResolver>();
builder.Services.AddScoped<IRecoveryExecutionEngine, RecoveryExecutionEngine>();
builder.Services.AddScoped<IRecoveryTokenService, RecoveryTokenService>();
builder.Services.AddScoped<ICandidateRecoveryService, CandidateRecoveryService>();
builder.Services.AddScoped<IOrganizationRecoveryService, OrganizationRecoveryService>();
builder.Services.AddScoped<IOrganizationReclaimService, OrganizationReclaimService>();
builder.Services.AddScoped<ILevel2RecoveryService, Level2RecoveryService>();
builder.Services.AddScoped<IPasswordPolicyService, PasswordPolicyService>();
builder.Services.AddScoped<IOtpPolicyService, OtpPolicyService>();

// Register Notification Platform Services
builder.Services.AddScoped<IActivityEventPublisher, ActivityEventPublisher>();
builder.Services.AddScoped<INotificationRecipientResolver, NotificationRecipientResolver>();
builder.Services.AddScoped<INotificationDeliveryService, NotificationDeliveryService>();
builder.Services.AddScoped<INotificationChannel, InAppNotificationChannel>();
builder.Services.AddSingleton<INotificationDispatcher, RedisNotificationDispatcher>();

// Register Profile Settings Services
builder.Services.AddScoped<IProfileService, ProfileService>();
builder.Services.AddScoped<IEducationService, EducationService>();
builder.Services.AddScoped<IAchievementService, AchievementService>();
builder.Services.AddScoped<ICareerReadinessEngine, CareerReadinessEngine>();
builder.Services.AddScoped<ICareerService, CareerService>();
builder.Services.AddScoped<IAttachmentService, AttachmentService>();
builder.Services.AddScoped<IWorkExperienceService, WorkExperienceService>();
builder.Services.AddScoped<IProjectService, ProjectService>();
builder.Services.AddScoped<ICandidateAssessmentService, CandidateAssessmentService>();
builder.Services.AddSingleton<ICandidateAssessmentQueue, BackgroundCandidateAssessmentQueue>();

// Register Public Workspace Seeder Plugins
builder.Services.AddScoped<IPublicWorkspaceModuleSeeder, JobVacancyModuleSeeder>();
builder.Services.AddScoped<IPublicWorkspaceModuleSeeder, WorkspacePostModuleSeeder>();

// Register Source Code Provider Services
builder.Services.AddScoped<ISourceCodeClient, GitHubSourceCodeClient>();
builder.Services.AddScoped<ISourceCodeClient, GitLabSourceCodeClient>();
builder.Services.AddScoped<ISourceCodeProviderService, SourceCodeProviderService>();
builder.Services.AddSingleton<IRepositorySyncQueue, BackgroundRepositorySyncQueue>();
builder.Services.AddScoped<IRepositoryAnalysisService, RepositoryAnalysisService>();
builder.Services.AddSingleton<IRepositoryAnalysisQueue, BackgroundRepositoryAnalysisQueue>();
builder.Services.AddScoped<ICandidateRepositoryProvider, CandidateRepositoryProvider>();
builder.Services.AddScoped<CVerify.API.Pipelines.Shared.Storage.IArtifactStorageProvider, CVerify.API.Pipelines.Shared.Storage.ArtifactStorageProvider>();
builder.Services.AddScoped<CVerify.API.Pipelines.Shared.Artifacts.IArtifactRegistry, CVerify.API.Pipelines.Shared.Artifacts.ArtifactRegistry>();
builder.Services.AddScoped<CVerify.API.Pipelines.RepositoryIntelligence.Readers.IRepositoryArtifactReader, CVerify.API.Pipelines.RepositoryIntelligence.Readers.RepositoryArtifactReader>();
builder.Services.AddScoped<CVerify.API.Pipelines.Shared.AI.IPromptRegistry, CVerify.API.Pipelines.Shared.AI.PromptRegistry>();
builder.Services.AddScoped<CVerify.API.Pipelines.Shared.Queue.IPipelineQueue, CVerify.API.Pipelines.Shared.Queue.PipelineQueue>();
builder.Services.AddScoped<CVerify.API.Pipelines.Shared.Orchestration.IDagScheduler, CVerify.API.Pipelines.Shared.Orchestration.DagScheduler>();

// Register VietQR Business Registry Client
builder.Services.AddHttpClient("VietQR", client =>
{
    client.BaseAddress = new Uri("https://api.vietqr.io/");
    client.Timeout = TimeSpan.FromSeconds(10);
});

// Register AI Service
builder.Services.AddScoped<IHmacSignatureService, HmacSignatureService>();
builder.Services.AddHttpClient("AiServiceClient", client =>
{
    client.BaseAddress = new Uri(envConfig.Ai.FastApiBaseUrl);
    client.Timeout = TimeSpan.FromMinutes(5); // Long timeout for Claude planning
});

// Register Email Infrastructure & Transport Services
builder.Services.AddEmailInfrastructure(builder.Configuration);

// Register Background Outbox Processor and Token Sweeper Job
builder.Services.AddHostedService<EmailOutboxBackgroundProcessor>();
builder.Services.AddHostedService<TokenCleanupBackgroundJob>();
builder.Services.AddHostedService<RecoveryClaimBackgroundWorker>();
builder.Services.AddHostedService<OtpCleanupBackgroundWorker>();
builder.Services.AddHostedService<BackgroundRepositorySyncProcessor>();
builder.Services.AddHostedService<AnalysisQueueRecoverySweeper>();
builder.Services.AddHostedService<BackgroundRepositoryAnalysisProcessor>();
builder.Services.AddHostedService<BackgroundCandidateAssessmentProcessor>();

builder.Services.AddHostedService<RedisNotificationSubscriberWorker>();
builder.Services.AddHostedService<ActivityEventProjectionWorker>();


// Configure JWT Authentication
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = envConfig.Jwt.Issuer,
        ValidAudience = envConfig.Jwt.Audience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(envConfig.Jwt.Key))
    };

    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            // Extract JWT from HttpOnly Cookie for seamless browser support
            context.Token = context.Request.Cookies["access_token"];
            return Task.CompletedTask;
        }
    };
});

builder.Services.AddCustomAuthorization();

var app = builder.Build();

// Startup Diagnostics for Rate Limiting / Environment
{
    var startupLogger = app.Services.GetRequiredService<ILogger<Program>>();
    var rateLimitPolicy = app.Services.GetRequiredService<IRateLimitPolicyService>();
    startupLogger.LogInformation(
        "[Startup Diagnostics] Current Environment: {EnvironmentName}, DisableRateLimits Config Value: {DisableRateLimits}, Cooldown Enforcement Active: {CooldownEnforcementActive}",
        app.Environment.EnvironmentName,
        rateLimitPolicy.DisableRateLimits,
        rateLimitPolicy.ShouldEnforceCooldowns()
    );
}

// 3. Automatically initialize/sync the database schema at application startup
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<ApplicationDbContext>();
        var usernameService = services.GetRequiredService<IUsernameService>();
        var logger = services.GetRequiredService<ILogger<Program>>();

        if (args.Contains("--greenfield-init"))
        {
            if (app.Environment.IsProduction() || app.Environment.EnvironmentName.Equals("Production", StringComparison.OrdinalIgnoreCase))
            {
                logger.LogCritical("FATAL: Greenfield Schema Initialization is not allowed in Production environment!");
                throw new InvalidOperationException("Greenfield Schema Initialization is not allowed in Production.");
            }

            logger.LogWarning("Greenfield Schema Initialization started: dropping and recreating tables...");
            var sqlPath = Path.Combine(AppContext.BaseDirectory, "schema_init.sql");
            if (!File.Exists(sqlPath)) sqlPath = "schema_init.sql";
            if (File.Exists(sqlPath))
            {
                var sql = await File.ReadAllTextAsync(sqlPath);
                await context.Database.ExecuteSqlRawAsync(sql);
                logger.LogInformation("Greenfield Schema Initialization SQL executed successfully.");
            }
            else
            {
                logger.LogError("Greenfield SQL script schema_init.sql not found!");
            }
        }

        logger.LogInformation("Initializing database schema and checking synchronization...");
        await DbInitializer.InitializeAsync(context, services, usernameService, envConfig, app.Environment);
        logger.LogInformation("Database schema initialized and synchronized successfully.");
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "An error occurred while initializing the database schema.");
        if (ex.Message.Contains("Fatal") || ex is InvalidOperationException)
        {
            throw;
        }
    }
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi(); // /openapi/v1.json
    app.UseSwaggerUI(options => 
    {
        options.SwaggerEndpoint("/openapi/v1.json", "CVerify API v1");
        options.RoutePrefix = "swagger";
    });
}

app.UseMiddleware<RequestLoggingMiddleware>();
app.UseExceptionHandler();
app.UseCors("AllowFrontend");
app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseRateLimiter();
app.UseAuthentication();
app.UseMiddleware<CVerify.API.Modules.Auth.Middleware.SessionValidationMiddleware>();
app.UseAuthorization();


app.MapHealthChecks("/health");
app.MapControllers();
app.MapHub<CVerify.API.Modules.Admin.Hubs.AdminHub>("/hubs/admin");
app.MapHub<NotificationHub>("/hubs/notifications");

app.Run();
