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
    }

    private readonly PostgreSqlContainer _dbContainer = new PostgreSqlBuilder()
        .WithDatabase("cverify_integration_db")
        .WithUsername("postgres")
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
        // Search relative lookup from BaseDirectory up to locate resources folder
        var currentDir = AppContext.BaseDirectory;
        string scriptPath = null;
        while (currentDir != null && !File.Exists(Path.Combine(currentDir, "resources", "Initialize SQL.sql")))
        {
            currentDir = Directory.GetParent(currentDir)?.FullName;
        }
        if (currentDir != null)
        {
            scriptPath = Path.Combine(currentDir, "resources", "Initialize SQL.sql");
        }
        else
        {
            // Fallback to absolute workspace path if running in some isolated host context
            scriptPath = @"d:\Coding Space\Github\CVerify\CVerify.Core\resources\Initialize SQL.sql";
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

        // Seed __EFMigrationsHistory with all applied migration IDs to prevent EF Core MigrateAsync conflicts
        var seedMigrationsSql = @"
            INSERT INTO public.""__EFMigrationsHistory"" (migration_id, product_version) VALUES
            ('20260611091911_AddNotificationSystem', '10.0.4'),
            ('20260614071252_AddWorkspacePostsTable', '10.0.4'),
            ('20260614100549_AddJobVacanciesTable', '10.0.4'),
            ('20260615093611_AddCandidateAssessments', '10.0.4'),
            ('20260615141609_AddExternalOrganizations', '10.0.4'),
            ('20260615152001_AddProjectEntriesAndLinks', '10.0.4'),
            ('20260615171115_AddRepositoryAssessments', '10.0.4'),
            ('20260616080806_AddRepositoryIntelligenceTables', '10.0.4'),
            ('20260616082519_AddCandidateIntelligenceTablesPhase2', '10.0.4'),
            ('20260620101455_AddMetadataToJobVacancy', '10.0.4'),
            ('20260620103710_AddHiringRequirementSystem', '10.0.4'),
            ('20260620104410_AddDraftJobDescription', '10.0.4'),
            ('20260620120213_AddCapabilityCatalogTaxonomy', '10.0.4'),
            ('20260620140210_AddRequirementArtifacts', '10.0.4'),
            ('20260621102139_AddJobVacancyWorkflowRedesign', '10.0.4'),
            ('20260621103138_AddJobVacancyCascadeDelete', '10.0.4'),
            ('20260621172337_AddHiringLifecycleAndDiscoveryRuns', '10.0.4'),
            ('20260621173554_MakeTriggeredByIdNullable', '10.0.4'),
            ('20260621175628_AddCapabilityRegistryAndGraphSchema', '10.0.4'),
            ('20260621183546_AddTalentIntelligenceGraph', '10.0.4'),
            ('20260621185145_AddPublicJobsAndInteractions', '10.0.4'),
            ('20260621194522_AddCandidateEvaluationSnapshotsAndProjections', '10.0.4'),
            ('20260622183209_AddRankingAndFollows', '10.0.4'),
            ('20260623181310_AddWorkspaceDescriptionAndOwner', '10.0.4'),
            ('20260628104720_AddCandidateSkillTreeNodes', '10.0.4'),
            ('20260628120042_AddAiSuggestionsJsonToUserProfile', '10.0.4'),
            ('20260628143050_AddAiStreamingTables', '10.0.4'),
            ('20260629103220_AddCandidateAssessmentMetadataColumns', '10.0.4'),
            ('20260629114108_UpdateBioMaxLength', '10.0.4'),
            ('20260629120025_AddProfessionalBioToAssessment', '10.0.4'),
            ('20260701142634_AddForumModule', '10.0.4'),
            ('20260707095049_AddUserCvSettings', '10.0.4'),
            ('20260714050836_AddSecurityEventsModule', '10.0.4'),
            ('20260714054243_AddAuditLogComplianceSchema', '10.0.4'),
            ('20260714063454_AddEnterpriseOperations', '10.0.4'),
            ('20260714071924_AddDurablePipelineExecution', '10.0.4'),
            ('20260714072225_AddCurrentStepToPipelineExecution', '10.0.4'),
            ('20260716063940_AddCanonicalSkillAndTaxonomyFields', '10.0.4'),
            ('20260716114046_AddSkillAliasesTableAndExpandUserSkills', '10.0.4'),
            ('20260721105711_AddOrganizationCandidates', '10.0.4')
            ON CONFLICT (migration_id) DO NOTHING;";

        using var seedCommand = new NpgsqlCommand(seedMigrationsSql, connection);
        await seedCommand.ExecuteNonQueryAsync().ConfigureAwait(false);
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
