using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Xunit;

namespace CVerify.API.IntegrationTests.Helpers
{
    public class TestQueryRunner
    {
        [Fact(Skip = "Manual diagnostics only. Requires populated local development DB.")]
        public async Task RunDbDiagnosticsTest()
        {
            Console.WriteLine("=== C# DB TEST RUNNER ===");
            try
            {
                // Set env variables
                Environment.SetEnvironmentVariable("DB_HOST", "localhost");
                Environment.SetEnvironmentVariable("DB_PORT", "5432");
                Environment.SetEnvironmentVariable("DB_NAME", "cverify_db_development");
                Environment.SetEnvironmentVariable("DB_USER", "postgres");
                Environment.SetEnvironmentVariable("DB_PASSWORD", "123123");
                Environment.SetEnvironmentVariable("REDIS_HOST", "localhost");
                Environment.SetEnvironmentVariable("REDIS_PORT", "6379");
                Environment.SetEnvironmentVariable("REDIS_PASSWORD", "123123");
                Environment.SetEnvironmentVariable("JWT_KEY", "DbqDgBM1u2H5lNnUFBgYrRaotpSP9Wda8jASgjIbFh6");
                Environment.SetEnvironmentVariable("SUPER_ADMIN_PASSWORD", "SuperAdminPassword123");
                Environment.SetEnvironmentVariable("TOKEN_ENCRYPTION_KEY", "h7X8k2P9q4W1v5Z0y3N6s9B2m5C8x1R4");
                Environment.SetEnvironmentVariable("ACCESS_KEY_ID", "dummy");
                Environment.SetEnvironmentVariable("SECRET_ACCESS_KEY", "dummy");
                Environment.SetEnvironmentVariable("R2_ENDPOINT", "https://dummy.r2.cloudflarestorage.com");
                Environment.SetEnvironmentVariable("R2_BUCKET", "dummy");

                var builder = new DbContextOptionsBuilder<ApplicationDbContext>()
                    .UseNpgsql("Host=localhost;Port=5432;Database=cverify_db_development;Username=postgres;Password=123123")
                    .UseSnakeCaseNamingConvention();

                using (var context = new ApplicationDbContext(builder.Options))
                {
                    var reqId = Guid.Parse("019ee4bc-e455-7f66-b9ad-3fd28d3c7681");
                    
                    Console.WriteLine($"Querying requirement: {reqId}");
                    var req = await context.HiringRequirements
                        .Include(r => r.BusinessOutcomes)
                        .Include(r => r.Responsibilities)
                        .Include(r => r.Capabilities)
                            .ThenInclude(c => c.EvidenceSignals)
                        .Include(r => r.TechnologyRequirements)
                        .Include(r => r.RequirementArtifacts)
                        .FirstOrDefaultAsync(r => r.Id == reqId);

                    Assert.NotNull(req);
                    Console.WriteLine($"Found requirement: {req.Title}, Capabilities count: {req.Capabilities.Count}");
                    
                    // Try to add a test artifact
                    Console.WriteLine("Adding test RequirementArtifact...");
                    var artifact = new RequirementArtifact
                    {
                        Id = Guid.CreateVersion7(),
                        HiringRequirementId = reqId,
                        ArtifactType = "JobDescription",
                        MarkdownContent = "",
                        Status = "Generating",
                        CreatedAt = DateTimeOffset.UtcNow,
                        UpdatedAt = DateTimeOffset.UtcNow
                    };
                    context.RequirementArtifacts.Add(artifact);
                    await context.SaveChangesAsync();
                    Console.WriteLine("Successfully saved changes!");

                    // Delete it clean
                    context.RequirementArtifacts.Remove(artifact);
                    await context.SaveChangesAsync();
                    Console.WriteLine("Cleaned up test artifact successfully.");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"EXCEPTION OCCURRED: {ex}");
                throw;
            }
        }
    }
}
