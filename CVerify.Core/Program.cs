using Microsoft.EntityFrameworkCore;
using CVerify.API.Infrastructure.Persistence;
using CVerify.API.Application.Interfaces;
using CVerify.API.Application.Services;
using CVerify.API.Application.Security.PasswordPolicies;
using CVerify.API.Application.Security.OtpPolicies;
using CVerify.API.Infrastructure.Services;
using CVerify.API.Infrastructure.Configuration;
using CVerify.API.Core.Entities;
using CVerify.API.API.Extensions;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using StackExchange.Redis;
using Microsoft.OpenApi;
using Npgsql;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using CVerify.API.Infrastructure.Diagnostics;
using Amazon.S3;
using CVerify.API.Application.Storage.Interfaces;
using CVerify.API.Infrastructure.Storage.Services;

var builder = WebApplication.CreateBuilder(args);

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

            var correlationId = CVerify.API.Infrastructure.Diagnostics.AsyncLocalCorrelationScope.CurrentCorrelationId 
                                ?? context.HttpContext.TraceIdentifier;

            var responsePayload = new CVerify.API.Application.DTOs.ApiErrorResponse
            {
                Status = Microsoft.AspNetCore.Http.StatusCodes.Status400BadRequest,
                Code = CVerify.API.Application.Exceptions.Catalogs.SystemErrorCatalog.ValidationError,
                Category = CVerify.API.Application.Exceptions.ErrorCategory.VALIDATION.ToString(),
                Severity = "Error",
                MessageKey = "system.toast.error.validation",
                Message = "Please check the form fields for errors.",
                Retryable = false,
                Errors = errors,
                CorrelationId = correlationId,
                UxSemantics = new CVerify.API.Application.DTOs.UxSemantics("Inline", "None", string.Empty, string.Empty)
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
builder.Services.AddSignalR();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();
builder.Services.AddHttpContextAccessor();


// Configure IP-partitioned Rate Limiting
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddPolicy("ForgotPasswordLimit", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? context.Request.Headers["X-Forwarded-For"].ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = envConfig.RateLimit.ForgotPasswordPermitLimit,
                Window = TimeSpan.FromMinutes(envConfig.RateLimit.ForgotPasswordWindowMinutes),
                QueueLimit = 0
            }));

    options.AddPolicy("ResetPasswordLimit", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? context.Request.Headers["X-Forwarded-For"].ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = envConfig.RateLimit.ResetPasswordPermitLimit,
                Window = TimeSpan.FromMinutes(envConfig.RateLimit.ResetPasswordWindowMinutes),
                QueueLimit = 0
            }));

    options.AddPolicy("ResendVerificationLimit", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? context.Request.Headers["X-Forwarded-For"].ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = envConfig.RateLimit.ResendVerificationPermitLimit,
                Window = TimeSpan.FromMinutes(envConfig.RateLimit.ResendVerificationWindowMinutes),
                QueueLimit = 0
            }));

    options.AddPolicy("VerifyEmailLimit", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? context.Request.Headers["X-Forwarded-For"].ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = envConfig.RateLimit.VerifyEmailPermitLimit,
                Window = TimeSpan.FromMinutes(envConfig.RateLimit.VerifyEmailWindowMinutes),
                QueueLimit = 0
            }));

    options.AddPolicy("RegisterLimit", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? context.Request.Headers["X-Forwarded-For"].ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = envConfig.RateLimit.RegisterPermitLimit,
                Window = TimeSpan.FromMinutes(envConfig.RateLimit.RegisterWindowMinutes),
                QueueLimit = 0
            }));

    options.AddPolicy("AiChatLimit", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value 
                          ?? context.Connection.RemoteIpAddress?.ToString() 
                          ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));
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
builder.Services.AddScoped<IIdentityRepository, IdentityRepository>();
builder.Services.AddScoped<ISystemService, SystemService>();
builder.Services.AddScoped<ICacheService, CacheService>();
builder.Services.AddScoped<ITokenService, TokenService>();
builder.Services.AddScoped<IEncryptedFileStorageService, EncryptedFileStorageService>();

// Register Cloudflare R2 Object Storage Stack (IAmazonS3 + IStorageService)
builder.Services.AddSingleton<IAmazonS3>(sp =>
{
    var config = sp.GetRequiredService<EnvConfiguration>();
    var s3Config = new AmazonS3Config
    {
        ServiceURL = config.R2.Endpoint,
        ForcePathStyle = true // Standard S3-compatible path resolution for Cloudflare R2
    };
    return new AmazonS3Client(config.R2.AccessKeyId, config.R2.SecretAccessKey, s3Config);
});
builder.Services.AddScoped<IStorageService, R2StorageService>();

// Register Application Services
builder.Services.AddScoped<IAccountService, AccountService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IPermissionService, PermissionService>();
builder.Services.AddScoped<IIdentityStateResolver, IdentityStateResolver>();
builder.Services.AddScoped<IRecoveryExecutionEngine, RecoveryExecutionEngine>();
builder.Services.AddScoped<IRecoveryTokenService, RecoveryTokenService>();
builder.Services.AddScoped<ICandidateRecoveryService, CandidateRecoveryService>();
builder.Services.AddScoped<IOrganizationRecoveryService, OrganizationRecoveryService>();
builder.Services.AddScoped<IOrganizationReclaimService, OrganizationReclaimService>();
builder.Services.AddScoped<ILevel2RecoveryService, Level2RecoveryService>();
builder.Services.AddScoped<IPasswordPolicyService, PasswordPolicyService>();
builder.Services.AddScoped<IOtpPolicyService, OtpPolicyService>();

// Register Profile Settings Services
builder.Services.AddScoped<IProfileService, ProfileService>();
builder.Services.AddScoped<IEducationService, EducationService>();
builder.Services.AddScoped<IAchievementService, AchievementService>();
builder.Services.AddScoped<ICareerService, CareerService>();
builder.Services.AddScoped<IAttachmentService, AttachmentService>();

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

// 3. Automatically initialize/sync the database schema at application startup
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<ApplicationDbContext>();
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogInformation("Initializing database schema and checking synchronization...");
        await DbInitializer.InitializeAsync(context);
        logger.LogInformation("Database schema initialized and synchronized successfully.");
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "An error occurred while initializing the database schema.");
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
app.UseMiddleware<CVerify.API.API.Middleware.SessionValidationMiddleware>();
app.UseAuthorization();


app.MapHealthChecks("/health");
app.MapControllers();
app.MapHub<CVerify.API.API.Hubs.AdminHub>("/hubs/admin");

app.Run();
