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
using CVerify.API.Modules.Forum.Services;
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
using CVerify.API.Modules.Shared.System.Pipelines;
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
using CVerify.API.Modules.Intelligence.Services;
using CVerify.API.Modules.Intelligence.BackgroundWorkers;


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

if (envPath != null)
{
    foreach (var line in File.ReadAllLines(envPath))
    {
        var parts = line.Split('=', 2, StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 2 && !parts[0].StartsWith("#"))
        {
            var key = parts[0].Trim();
            var val = parts[1].Trim();
            if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable(key)))
            {
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
builder.Services.AddMemoryCache();
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

            var firstErrorMsg = errors.SelectMany(e => e.Value).FirstOrDefault(m => !string.IsNullOrWhiteSpace(m));
            var summaryMessage = !string.IsNullOrWhiteSpace(firstErrorMsg)
                ? $"Validation failed: {firstErrorMsg}"
                : "Please check the form fields for errors.";

            var responsePayload = new ApiErrorResponse
            {
                Status = Microsoft.AspNetCore.Http.StatusCodes.Status400BadRequest,
                Code = SystemErrorCatalog.ValidationError,
                Category = ErrorCategory.VALIDATION.ToString(),
                Severity = "Error",
                MessageKey = "system.toast.error.validation",
                Message = summaryMessage,
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
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
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
    options.OnRejected = async (context, token) =>
    {
        var ip = context.HttpContext.Connection.RemoteIpAddress?.ToString();
        var path = context.HttpContext.Request.Path;
        var publisher = context.HttpContext.RequestServices.GetService<CVerify.API.Modules.Shared.Domain.Services.ISecurityEventPublisher>();
        if (publisher != null)
        {
            await publisher.PublishAsync(
                CVerify.API.Modules.Shared.Domain.Constants.SecurityEventTypes.ApiRateLimitExceeded,
                CVerify.API.Modules.Shared.Domain.Enums.SecurityEventCategory.Api,
                $"IP {ip ?? "unknown"} exceeded rate limits on endpoint {path}.",
                overrideSeverity: CVerify.API.Modules.Shared.Domain.Enums.SecuritySeverity.Medium
            );
        }
    };


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
           .UseSnakeCaseNamingConvention()
           .ConfigureWarnings(w => w
               .Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning)
               .Ignore(Microsoft.EntityFrameworkCore.Diagnostics.CoreEventId.PossibleIncorrectRequiredNavigationWithQueryFilterInteractionWarning));

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
builder.Services.AddScoped<ICapabilityCatalogService, CapabilityCatalogService>();
builder.Services.AddScoped<IHiringRequirementService, HiringRequirementService>();
builder.Services.AddScoped<ICapabilityProjectionBuilder, CapabilityProjectionBuilder>();
builder.Services.AddScoped<IRequirementGraphBuilder, RequirementGraphBuilder>();
builder.Services.AddScoped<ITalentGraphBuilder, TalentGraphBuilder>();

// Talent Intelligence Service Registrations
builder.Services.AddScoped<IOutboxPublisher, OutboxPublisher>();
builder.Services.AddScoped<ICapabilityGraphService, CapabilityGraphService>();
builder.Services.AddScoped<ITrustEngineService, TrustEngineService>();
builder.Services.AddScoped<IExplainableMatchService, ExplainableMatchService>();
builder.Services.AddScoped<ICandidateEvaluationService, CandidateEvaluationService>();
builder.Services.AddScoped<IUnifiedMatchingEngine, UnifiedMatchingEngine>();
builder.Services.AddScoped<IRepositoryIntelligencePipeline, RepositoryIntelligencePipeline>();
builder.Services.AddScoped<IJobRankingStrategy, WeightedJobRankingStrategy>();
builder.Services.AddScoped<IRecommendationProvider, DefaultRecommendationProvider>();
builder.Services.AddScoped<IJobEligibilityService, JobEligibilityService>();
builder.Services.AddScoped<ICandidateRankingCalculator, CandidateRankingCalculator>();
builder.Services.AddScoped<ICandidateRankingProjectionService, CandidateRankingProjectionService>();


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
builder.Services.AddScoped<IOrganizationRoleService, OrganizationRoleService>();
#pragma warning disable CS0618
builder.Services.AddScoped<IBusinessRoleService, BusinessRoleService>();
#pragma warning restore CS0618
builder.Services.AddScoped<IOrganizationInvitationService, OrganizationInvitationService>();
builder.Services.AddScoped<IOrganizationMembershipSyncService, OrganizationMembershipSyncService>();
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

// Register Security Events Core Services
builder.Services.AddSingleton<CVerify.API.Modules.Shared.Domain.Services.SecurityEventChannel>();
builder.Services.AddScoped<CVerify.API.Modules.Shared.Domain.Services.ISecurityDetectionEngine, CVerify.API.Modules.Shared.Domain.Services.SecurityDetectionEngine>();
builder.Services.AddScoped<CVerify.API.Modules.Shared.Domain.Services.ISecurityEventPublisher, CVerify.API.Modules.Shared.Domain.Services.SecurityEventPublisher>();
builder.Services.AddHostedService<CVerify.API.Modules.Shared.System.BackgroundWorkers.SecurityEventProcessorJob>();


// Register Profile Settings Services
builder.Services.AddScoped<IProfileService, ProfileService>();
builder.Services.AddScoped<IEducationService, EducationService>();
builder.Services.AddScoped<IAchievementService, AchievementService>();
builder.Services.AddScoped<ICareerReadinessEngine, CareerReadinessEngine>();
builder.Services.AddScoped<ICareerService, CareerService>();
builder.Services.AddScoped<IAttachmentService, AttachmentService>();
builder.Services.AddScoped<IWorkExperienceService, WorkExperienceService>();
builder.Services.AddScoped<IProjectService, ProjectService>();
builder.Services.AddScoped<ICvRepositoryIndexer, CvRepositoryIndexer>();

// Register Forum Services
builder.Services.AddScoped<IForumService, ForumService>();
builder.Services.AddScoped<ICandidateMatchService, CandidateMatchService>();
builder.Services.AddScoped<ICandidateAssessmentService, CandidateAssessmentService>();
builder.Services.AddSingleton<CVerify.API.Modules.Shared.System.Services.IAiCancellationManager, CVerify.API.Modules.Shared.System.Services.AiCancellationManager>();
builder.Services.AddScoped<IAiStreamingSessionService, AiStreamingSessionService>();
builder.Services.AddScoped<ISkillTreeValidationService, SkillTreeValidationService>();
builder.Services.AddSingleton<ICandidateAssessmentQueue, BackgroundCandidateAssessmentQueue>();
builder.Services.AddScoped<ITechnologyNormalizationService, TechnologyNormalizationService>();

// Register Public Workspace Seeder Plugins
builder.Services.AddScoped<IPublicWorkspaceModuleSeeder, JobVacancyModuleSeeder>();
builder.Services.AddScoped<IPublicWorkspaceModuleSeeder, WorkspacePostModuleSeeder>();

// Register Modular Seeders
builder.Services.AddScoped<ISeederModule, PermissionSeeder>();
builder.Services.AddScoped<ISeederModule, SystemRoleSeeder>();
builder.Services.AddScoped<ISeederModule, CapabilityCatalogSeeder>();
builder.Services.AddScoped<ISeederModule, TechnologyTaxonomySeeder>();
builder.Services.AddScoped<ISeederModule, ForumMetadataSeeder>();
builder.Services.AddScoped<ISeederModule, TenantRoleSeeder>();
builder.Services.AddScoped<ISeederModule, DemoOrganizationSeeder>();
builder.Services.AddScoped<ISeederModule, DemoUserSeeder>();
builder.Services.AddScoped<ISeederModule, DemoRepositorySeeder>();
builder.Services.AddScoped<ISeederModule, DemoCvSeeder>();
builder.Services.AddScoped<ISeederModule, DemoAiPipelineSeeder>();
builder.Services.AddScoped<ISeederModule, DemoForumPostSeeder>();

// Register Source Code Provider Services
builder.Services.AddScoped<ISourceCodeClient, GitHubSourceCodeClient>();
builder.Services.AddScoped<ISourceCodeClient, GitLabSourceCodeClient>();
builder.Services.AddScoped<ISourceCodeProviderService, SourceCodeProviderService>();
builder.Services.AddSingleton<IRepositorySyncQueue, BackgroundRepositorySyncQueue>();
builder.Services.AddScoped<IRepositoryAnalysisService, RepositoryAnalysisService>();
builder.Services.AddSingleton<IRepositoryAnalysisQueue, BackgroundRepositoryAnalysisQueue>();
builder.Services.AddScoped<ICandidateRepositoryProvider, CandidateRepositoryProvider>();

// Register AI Pipeline Orchestrators & Dispatcher
builder.Services.AddScoped<IPipelineOrchestrator, RepositoryAnalysisPipelineOrchestrator>();
builder.Services.AddScoped<IPipelineOrchestrator, CandidateAssessmentPipelineOrchestrator>();
builder.Services.AddScoped<IPipelineOrchestrator, HiringRequirementPipelineOrchestrator>();
builder.Services.AddScoped<IPipelineDispatcher, PipelineDispatcher>();
builder.Services.AddScoped<IQueueDiscoveryService, QueueDiscoveryService>();
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
builder.Services.AddHostedService<BackgroundCandidateAssessmentBackfillProcessor>();
builder.Services.AddHostedService<TalentOutboxBackgroundProcessor>();


builder.Services.AddHostedService<RedisNotificationSubscriberWorker>();
builder.Services.AddHostedService<ActivityEventProjectionWorker>();
builder.Services.AddHostedService<CandidateRankingProjectionWorker>();

// Register Real-Time Observability Services
builder.Services.AddSingleton<ObservabilityLogSink>();
builder.Services.AddSingleton<IObservabilityLogSink>(sp => sp.GetRequiredService<ObservabilityLogSink>());
builder.Services.AddSingleton<ILoggerProvider>(sp => sp.GetRequiredService<ObservabilityLogSink>());
builder.Services.AddSingleton<IObservabilityMetricsCollector, ObservabilityMetricsCollector>();
builder.Services.AddHostedService<ObservabilityMetricsBroadcasterWorker>();

// Register Admin Dashboard Control Center Services
builder.Services.AddScoped<IAdminDashboardFacade, AdminDashboardFacade>();


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

        string? GetArgValue(string[] arguments, string prefix)
        {
            var arg = arguments.FirstOrDefault(a => a.StartsWith(prefix + "=", StringComparison.OrdinalIgnoreCase));
            return arg?.Split('=', 2).LastOrDefault();
        }

        async Task BootstrapAdminUserAsync(ApplicationDbContext dbContext, string adminEmail, string adminUsername, string adminPassword, string adminFullName)
        {
            const string sqlRoles = @"
                INSERT INTO roles (id, name, display_name, description, is_system)
                VALUES 
                    ('018fc35b-1c5c-7b8a-9a2d-3e4f5a6b7c8d'::uuid, 'SUPER_ADMIN', 'System Administrator', 'Root access to all modules', TRUE),
                    ('018fc35b-1c5d-7b8a-9a2d-3e4f5a6b7c8d'::uuid, 'USER', 'General User', 'Basic application access', TRUE)
                ON CONFLICT (name) WHERE tenant_id IS NULL DO UPDATE 
                SET display_name = EXCLUDED.display_name, description = EXCLUDED.description;

                INSERT INTO permissions (id, name, display_name, description, module, is_system)
                VALUES 
                    ('018fc35b-1c5e-7b8a-9a2d-3e4f5a6b7c8d'::uuid, '*:*:*', 'Global Wildcard', 'Full access to every module and feature', 'system', TRUE)
                ON CONFLICT (name) DO UPDATE 
                SET display_name = EXCLUDED.display_name, description = EXCLUDED.description, module = EXCLUDED.module;

                INSERT INTO role_permissions (role_id, permission_id)
                SELECT r.id, p.id FROM roles r, permissions p 
                WHERE r.name = 'SUPER_ADMIN' AND p.name = '*:*:*'
                ON CONFLICT DO NOTHING;
            ";
            await dbContext.Database.ExecuteSqlRawAsync(sqlRoles);

            var newUserId = Guid.CreateVersion7();
            const string userSql = @"
                INSERT INTO users (
                    id,
                    email, 
                    username,
                    password_hash, 
                    full_name, 
                    status, 
                    email_verified_at
                )
                SELECT 
                    @id,
                    @email,
                    @username,
                    crypt(@password, gen_salt('bf', 10)),
                    @fullName,
                    'ACTIVE',
                    NOW()
                WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = @email);
            ";
            await dbContext.Database.ExecuteSqlRawAsync(userSql,
                new NpgsqlParameter("@id", newUserId),
                new NpgsqlParameter("@email", adminEmail.Trim().ToLowerInvariant()),
                new NpgsqlParameter("@username", adminUsername.Trim()),
                new NpgsqlParameter("@password", adminPassword.Trim()),
                new NpgsqlParameter("@fullName", adminFullName.Trim())
            );

            const string linkSql = @"
                INSERT INTO user_roles (user_id, role_id)
                SELECT 
                    (SELECT id FROM users WHERE email = @email),
                    (SELECT id FROM roles WHERE name = 'SUPER_ADMIN')
                ON CONFLICT DO NOTHING;
            ";
            await dbContext.Database.ExecuteSqlRawAsync(linkSql,
                new NpgsqlParameter("@email", adminEmail.Trim().ToLowerInvariant())
            );
        }

        if (args.Contains("--bootstrap-admin"))
        {
            var email = GetArgValue(args, "--email") ?? "admin@system.com";
            var username = GetArgValue(args, "--username") ?? "admin";
            var password = GetArgValue(args, "--password");
            var name = GetArgValue(args, "--name") ?? "System Administrator";

            if (string.IsNullOrWhiteSpace(password))
            {
                logger.LogCritical("FATAL: --password must be provided when using --bootstrap-admin.");
                throw new ArgumentException("Password is required for administrator bootstrapping.");
            }

            logger.LogWarning("CLI Bootstrapping System Administrator account: {Email}...", email);
            await BootstrapAdminUserAsync(context, email, username, password, name);
            logger.LogInformation("System Administrator bootstrapped successfully.");
            Environment.Exit(0);
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
app.UseForwardedHeaders(new Microsoft.AspNetCore.Builder.ForwardedHeadersOptions
{
    ForwardedHeaders = Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedFor | Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedProto,
    KnownNetworks = { },
    KnownProxies = { }
});

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
app.Use(async (context, next) =>
{
    var ip = context.Connection.RemoteIpAddress?.ToString();
    if (!string.IsNullOrEmpty(ip) && ip != "127.0.0.1" && ip != "::1")
    {
        var redis = context.RequestServices.GetService<IConnectionMultiplexer>();
        if (redis != null)
        {
            var isBanned = await redis.GetDatabase().KeyExistsAsync($"sec:ip_ban:{ip}");
            if (isBanned)
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new { message = "Access Denied: Your IP address has been temporarily blocked for security reasons." });
                return;
            }
        }
    }
    await next();
});

app.UseRateLimiter();
app.UseAuthentication();
app.UseMiddleware<CVerify.API.Modules.Auth.Middleware.SessionValidationMiddleware>();
app.UseAuthorization();


app.MapHealthChecks("/health");
app.MapControllers();
app.MapHub<CVerify.API.Modules.Admin.Hubs.AdminHub>("/hubs/admin");
app.MapHub<NotificationHub>("/hubs/notifications");

app.Run();
