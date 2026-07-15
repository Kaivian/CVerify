# CVerify Backend Server Layer

Welcome to the CVerify Backend Server Layer. This is a highly resilient REST API built using the .NET 10.0 runtime ecosystem. The project follows Clean Architecture patterns to enforce decoupling, fail-fast configuration validations, explicit persistence mapping rules, distributed caching, and secure session management.

## Technology Stack

The backend uses a high-performance stack designed for low-latency RESTful transactions, transaction safety, and resilient external service integrations:

* Runtime Framework: ASP.NET Core v10.
* Primary Database: PostgreSQL >= 15.x as the absolute source of truth.
* ORM Layer: Entity Framework Core (EF Core) v10, using snake_case conventions, custom converters, and native PostgreSQL enum mappings.
* Caching and Rate Limiting: Redis v6.x / v7.x for distributed caching, rate limit partitioning, and session states.
* AI Microservice Gateway: Named HttpClient client (AiServiceClient) connecting to the FastAPI microservice with HMAC SHA-256 signatures.
* Email Delivery: SMTP MailKit client orchestrated through a background Outbox processor.
* Metrics and Telemetry: Custom health checks and standard ASP.NET Core health diagnostics.

## Clean Architecture Structure

The project code is divided into four concentric layers to enforce inwards-directed dependency flows:

```
CVerify.Core/
├── API/                    # Presentation Layer (REST Controllers, Middlewares, Extensions)
│   ├── Controllers/        # HTTP Handlers (AuthController, SystemController, EmailTestController)
│   ├── Extensions/         # Startup config helpers (Authorization, Email, Middlewares)
│   └── Middlewares/        # Custom HTTP pipelines (SecurityHeadersMiddleware, GlobalExceptionHandler)
├── Application/            # Business Logic & Usecases Layer
│   ├── DTOs/               # Input/Output Data Transfer Objects
│   ├── Exceptions/         # Domain-specific custom exceptions (e.g. ConflictException)
│   ├── Interfaces/         # Interface abstractions (Services, Repositories, Caching)
│   └── Services/           # Core use-case implementations (AuthService, AccountService)
├── Core/                   # Domain Core Layer (No external dependencies)
│   └── Entities/           # Database Domain entities, Value Objects, and Enums
├── Infrastructure/         # Adapter Infrastructure Layer (Data persistence, External services)
│   ├── Configuration/      # Env configs and Fail-Fast Environment validators
│   ├── Diagnostics/        # AuthMetrics counters and third-party API HealthChecks
│   ├── EmailTemplates/     # Pre-compiled HTML layout resources for verification & resets
│   ├── Persistence/        # EF Core DbContext, DB seeds, and Identity repositories
│   └── Services/           # Adapters (BackgroundQueue, Cache, Token, MailKit)
├── tests/                  # Robust automated testing suites
│   ├── CVerify.API.Benchmarks/       # High-performance code path bench markers
│   ├── CVerify.API.IntegrationTests/ # End-to-End API test executions
│   ├── CVerify.API.PerformanceTests/ # Stress and concurrent load tests
│   └── CVerify.API.UnitTests/        # Isolated mock service test suites
├── Program.cs              # Global Application Bootstrapper & Dependency Injection Container
├── appsettings.json        # Static base configurations
└── CVerify.sln             # Multi-project solution configuration file
```

## Configuration and Environment Variables

The server parses configurations at startup from the root `.env` file using the `EnvValidator` class. If any required configurations are missing or invalid, the server halts immediately (Fail-Fast policy).

The table below lists the required configuration keys:

| Environment Key | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| DB_HOST | Yes | localhost | Hostname of the PostgreSQL database server. |
| DB_PORT | Yes | 5432 | Port number of the PostgreSQL database server. |
| DB_NAME | Yes | cverify_db | Name of the primary target database. |
| DB_USER | Yes | postgres | Database username credential. |
| DB_PASSWORD | Yes | None | Database password credential. |
| REDIS_HOST | Yes | localhost | Hostname of the Redis caching server. |
| REDIS_PORT | Yes | 6379 | Port number of the Redis caching server. |
| REDIS_PASSWORD | No | None | Password credential for the Redis server. |
| JWT_KEY | Yes | None | Symmetric signature key (requires 32+ characters for HS256). |
| PORT | No | 5247 | Port address for the ASP.NET Core server. |
| EMAIL_SENDER_EMAIL | Yes | dev@cverify.ai | From address shown in outbound system emails. |
| SMTP_HOST | No | localhost | SMTP host address for MailKit fallback. |
| SMTP_PORT | No | 587 | SMTP port for MailKit fallback. |
| SMTP_USERNAME | No | None | SMTP username credential. |
| SMTP_PASSWORD | No | None | SMTP password credential. |
| GOOGLE_CLIENT_ID | Yes | None | Client ID for Google SSO validation. |
| AI_SERVICE_URL | Yes | http://localhost:8000 | URL pointing to the CVerify.AI FastAPI microservice. |
| AI_SERVICE_SHARED_SECRET | Yes | None | Shared HMAC secret key matching the CVerify.AI secret. |
| AI_SERVICE_CLIENT_ID | No | cverify-core | The identifier for the backend client in AI requests. |
| CLAUDE_MODEL | No | claude-sonnet-4-6 | AI model version requested by backend tasks. |
| SUPER_ADMIN_EMAIL | Yes | admin@system.com | Default Super Admin email address. |
| SUPER_ADMIN_PASSWORD | Yes | None | Default Super Admin account password. |
| ACCESS_KEY_ID | Yes | None | Cloudflare R2 access key. |
| SECRET_ACCESS_KEY | Yes | None | Cloudflare R2 secret access key. |
| R2_ENDPOINT | Yes | None | Cloudflare R2 storage endpoint. |
| R2_BUCKET | Yes | None | Cloudflare R2 storage bucket. |
| DISABLE_RATE_LIMITS | No | false | Allows disabling rate limiters during testing. |
| TOKEN_ENCRYPTION_KEY | Yes | None | Encryption key for database-stored tokens (AES-256-GCM, requires exactly 32 bytes). |
| FRONTEND_URL | Yes | http://localhost:3000 | URL of the frontend application for CORS rules. |

## Database Setup and Migrations

The database layer is managed through EF Core. Migrations are checked and applied automatically on startup inside `DbInitializer.InitializeAsync`, meaning you do not need to execute database migrations manually on local development machines.

### Manual EF Core Migrations
If you make changes to domain entities and need to create a new migration, use the dotnet-ef tools CLI:

1. Install the EF global tool (if not already present):
   ```bash
   dotnet tool install --global dotnet-ef
   ```
2. Generate a new migration:
   ```bash
   dotnet ef migrations add NameOfMigration --project CVerify.API.csproj
   ```
3. Update the database schema manually (optional):
   ```bash
   dotnet ef database update --project CVerify.API.csproj
   ```

## Security Architecture

1. Dual Cookie Authentication: Authentications issue an access token and a refresh token inside HttpOnly cookies:
   * `access_token`: Short-lived token (15 minutes) containing role claims and verification flags. SameSite=Lax.
   * `refresh_token`: Long-lived token (7 days) mapped to the database. SameSite=Strict.
   Cookies are automatically read and validated by a custom authentication handler in the HTTP request pipeline.
2. IP-Partitioned Rate Limiting: Limits access to sensitive endpoints to prevent brute-force attacks:
   * ForgotPasswordLimit: Allows 3 attempts per 15 minutes.
   * ResetPasswordLimit: Allows 5 attempts per 15 minutes.
   * ResendVerificationLimit: Allows 3 attempts per 10 minutes.
   * VerifyEmailLimit: Allows 5 attempts per 10 minutes.
   * RegisterLimit: Allows 5 attempts per 15 minutes.

## Resilient Email Transport (Outbox Pattern)

The application separates database operations from network email transactions using the Outbox pattern:

1. Stage Outbox: Email tasks are stored as records inside the `outbox_messages` table within the same transaction as the parent action.
2. Background Processing: The `EmailOutboxBackgroundProcessor` hosted service scans the database at regular intervals.
3. SMTP Dispatch: The background worker attempts to dispatch emails using the SMTP MailKit client.

## OpenAPI Swagger Sandbox

In the Development environment, the API exposes live Swagger documentation:

* Swagger UI Page: `http://localhost:5247/swagger`
* OpenAPI Definition JSON: `http://localhost:5247/openapi/v1.json`

To test authenticated endpoints in the sandbox:
1. Obtain a valid JWT.
2. Click the Authorize button in the top right of the Swagger UI.
3. Paste the token in the text box in the format `Bearer <your-token>`.

## Running Locally

### 1. Restore NuGet Packages
```bash
dotnet restore
```

### 2. Run Web Host
```bash
dotnet run
```
The server will start and bind to `http://localhost:5247`.

### 3. Run Automated Tests
```bash
dotnet test
```

## Troubleshooting

### JWT Key Length Constraint Exception
If the application crashes on startup throwing symmetric key length errors, verify that `JWT_KEY` in your `.env` contains at least 32 characters. C# cryptographic providers enforce this minimum length for security purposes.

### PostgreSQL Enum Mapping Conflict
If database queries fail with casting exceptions (e.g. mapping column status values to integer parameters), check that the enum type is registered in the DbContext options during initialization, and verify that the corresponding migration registering the custom enum inside PostgreSQL has been applied.

### Delayed Email Dispatch
If verification emails are not being sent, check the background logs for `EmailOutboxBackgroundProcessor`. Ensure your SMTP credentials are set correctly. You can trigger test emails using the `/api/email-test` endpoint in Swagger for validation.
