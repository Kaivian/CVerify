using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.SourceCode.Entities;
using CVerify.API.Modules.Auth.Entities;

namespace CVerify.API.Modules.Shared.Persistence;

public class DemoRepositorySeeder : ISeederModule
{
    public string ModuleId => "DemoRepositorySeeder";
    public string Version => "1.0.0";
    public IReadOnlyCollection<string> Dependencies => new[] { "DemoUserSeeder" };

    public async Task<SeederResult> SeedAsync(ApplicationDbContext context, SeedingConfig config)
    {
        if (context == null) throw new ArgumentNullException(nameof(context));
        if (!config.GenerateDemoData)
        {
            return new SeederResult(ModuleId, SeedingStatus.Skipped, "Demo repository seeding skipped because GenerateDemoData is false.");
        }

        var user = await context.Users.FirstOrDefaultAsync(u => u.Email == "admin@system.com")
                   ?? await context.Users.FirstOrDefaultAsync();

        if (user == null)
        {
            return new SeederResult(ModuleId, SeedingStatus.Failed, "No user found to associate with demo repositories.");
        }

        // 1. Ensure AuthProvider exists
        var provider = await context.AuthProviders
            .FirstOrDefaultAsync(ap => ap.UserId == user.Id && ap.ProviderName == "GitHub");

        if (provider == null)
        {
            provider = new AuthProvider
            {
                Id = Guid.Parse("019f12f7-74d4-7d28-9391-da9d81d7c600"),
                UserId = user.Id,
                ProviderName = "GitHub",
                ProviderKey = "1234567",
                ProviderAccountId = "1234567",
                ProviderUsername = "kaivian",
                EncryptedAccessToken = "mock_access_token",
                EncryptedRefreshToken = "mock_refresh_token",
                ExpiresAt = DateTimeOffset.UtcNow.AddYears(1),
                GrantedScopes = "read:user,repo",
                SyncStatus = "Completed",
                CreatedAt = DateTimeOffset.UtcNow,
                TokenUpdatedAt = DateTimeOffset.UtcNow
            };
            context.AuthProviders.Add(provider);
            await context.SaveChangesAsync();
        }

        // 2. Seed Mock Repositories
        var mockRepos = new List<SourceCodeRepository>
        {
            new()
            {
                Id = Guid.Parse("019f12f7-74d4-7d28-9391-da9d81d7c601"),
                AuthProviderId = provider.Id,
                ExternalRepositoryId = "1000001",
                Name = "CVerify",
                Owner = "kaivian",
                OwnerLogin = "kaivian",
                OwnerType = "User",
                Description = "Environment-aware developer trust verification platform.",
                HtmlUrl = "https://github.com/kaivian/CVerify",
                DefaultBranch = "main",
                PrimaryLanguage = "C#",
                IsPrivate = true,
                StarsCount = 42,
                ForksCount = 8,
                OpenIssuesCount = 3,
                WatchersCount = 42,
                IsAccessible = true,
                IsEnabled = true,
                IsVerified = true,
                TrustScore = 0.74,
                Classification = "BackendService",
                AuthenticityType = "HighAuthenticity",
                LatestRiskScore = 0.05,
                LatestRiskLevel = "Low",
                LatestAnalysisStatus = "Completed",
                LatestAnalysisCompletedAtUtc = DateTimeOffset.UtcNow.AddDays(-2),
                LatestRiskFactorsJson = "[]",
                CreatedAtUtc = DateTimeOffset.UtcNow.AddMonths(-3),
                LastUpdatedUtc = DateTimeOffset.UtcNow.AddDays(-2),
                LastSeenAt = DateTimeOffset.UtcNow,
                LastSyncedAt = DateTimeOffset.UtcNow
            },
            new()
            {
                Id = Guid.Parse("019f12f7-74d4-7d28-9391-da9d81d7c602"),
                AuthProviderId = provider.Id,
                ExternalRepositoryId = "1000002",
                Name = "kaivian.github.io",
                Owner = "kaivian",
                OwnerLogin = "kaivian",
                OwnerType = "User",
                Description = "Personal portfolio and technical blog.",
                HtmlUrl = "https://github.com/kaivian/kaivian.github.io",
                DefaultBranch = "main",
                PrimaryLanguage = "HTML",
                IsPrivate = false,
                StarsCount = 15,
                ForksCount = 2,
                OpenIssuesCount = 0,
                WatchersCount = 15,
                IsAccessible = true,
                IsEnabled = true,
                IsVerified = true,
                TrustScore = 0.95,
                Classification = "StaticWebsite",
                AuthenticityType = "OriginalWork",
                LatestRiskScore = 0.01,
                LatestRiskLevel = "Low",
                LatestAnalysisStatus = "Completed",
                LatestAnalysisCompletedAtUtc = DateTimeOffset.UtcNow.AddDays(-1),
                LatestRiskFactorsJson = "[]",
                CreatedAtUtc = DateTimeOffset.UtcNow.AddMonths(-6),
                LastUpdatedUtc = DateTimeOffset.UtcNow.AddDays(-1),
                LastSeenAt = DateTimeOffset.UtcNow,
                LastSyncedAt = DateTimeOffset.UtcNow
            },
            new()
            {
                Id = Guid.Parse("019f12f7-74d4-7d28-9391-da9d81d7c603"),
                AuthProviderId = provider.Id,
                ExternalRepositoryId = "1000003",
                Name = "ExploreWorld",
                Owner = "kaivian",
                OwnerLogin = "kaivian",
                OwnerType = "User",
                Description = "3D world exploration engine written in Unity/C#.",
                HtmlUrl = "https://github.com/kaivian/ExploreWorld",
                DefaultBranch = "master",
                PrimaryLanguage = "C#",
                IsPrivate = false,
                StarsCount = 256,
                ForksCount = 38,
                OpenIssuesCount = 12,
                WatchersCount = 256,
                IsAccessible = true,
                IsEnabled = true,
                IsVerified = false,
                TrustScore = 0.15,
                Classification = "GameEngine",
                AuthenticityType = "CopiedTemplate",
                LatestRiskScore = 0.85,
                LatestRiskLevel = "High",
                LatestAnalysisStatus = "Failed",
                LatestAnalysisCompletedAtUtc = DateTimeOffset.UtcNow.AddHours(-4),
                LatestRiskFactorsJson = "[\"Simhash matched 85% with public Unity template\"]",
                CreatedAtUtc = DateTimeOffset.UtcNow.AddYears(-1),
                LastUpdatedUtc = DateTimeOffset.UtcNow.AddHours(-4),
                LastSeenAt = DateTimeOffset.UtcNow,
                LastSyncedAt = DateTimeOffset.UtcNow
            },
            new()
            {
                Id = Guid.Parse("019f12f7-74d4-7d28-9391-da9d81d7c604"),
                AuthProviderId = provider.Id,
                ExternalRepositoryId = "1000004",
                Name = "Icicle",
                Owner = "kaivian",
                OwnerLogin = "kaivian",
                OwnerType = "User",
                Description = "Lightweight distributed configuration management service.",
                HtmlUrl = "https://github.com/kaivian/Icicle",
                DefaultBranch = "master",
                PrimaryLanguage = "Go",
                IsPrivate = true,
                StarsCount = 8,
                ForksCount = 1,
                OpenIssuesCount = 1,
                WatchersCount = 8,
                IsAccessible = true,
                IsEnabled = true,
                IsVerified = false,
                TrustScore = 0.0,
                LatestRiskScore = 0.0,
                LatestRiskLevel = "Low",
                LatestAnalysisStatus = "Running",
                CreatedAtUtc = DateTimeOffset.UtcNow.AddMonths(-1),
                LastUpdatedUtc = DateTimeOffset.UtcNow.AddMinutes(-5),
                LastSeenAt = DateTimeOffset.UtcNow,
                LastSyncedAt = DateTimeOffset.UtcNow
            },
            new()
            {
                Id = Guid.Parse("019f12f7-74d4-7d28-9391-da9d81d7c605"),
                AuthProviderId = provider.Id,
                ExternalRepositoryId = "1000006",
                Name = "KWardrobe",
                Owner = "kaivian",
                OwnerLogin = "kaivian",
                OwnerType = "User",
                Description = "Closet management and outfit coordinator mobile app.",
                HtmlUrl = "https://github.com/kaivian/KWardrobe",
                DefaultBranch = "main",
                PrimaryLanguage = "Dart",
                IsPrivate = true,
                StarsCount = 3,
                ForksCount = 0,
                OpenIssuesCount = 0,
                WatchersCount = 3,
                IsAccessible = true,
                IsEnabled = true,
                IsVerified = false,
                TrustScore = 0.0,
                LatestRiskScore = 0.0,
                LatestRiskLevel = "Low",
                LatestAnalysisStatus = "Queued",
                CreatedAtUtc = DateTimeOffset.UtcNow.AddMonths(-2),
                LastUpdatedUtc = DateTimeOffset.UtcNow.AddMinutes(-1),
                LastSeenAt = DateTimeOffset.UtcNow,
                LastSyncedAt = DateTimeOffset.UtcNow
            }
        };

        int affected = 0;
        foreach (var repo in mockRepos)
        {
            var existing = await context.SourceCodeRepositories.FirstOrDefaultAsync(r => r.Id == repo.Id);
            if (existing == null)
            {
                context.SourceCodeRepositories.Add(repo);
                affected++;
            }
            else
            {
                existing.AuthProviderId = repo.AuthProviderId;
                existing.Name = repo.Name;
                existing.Description = repo.Description;
                existing.HtmlUrl = repo.HtmlUrl;
                existing.PrimaryLanguage = repo.PrimaryLanguage;
                existing.IsVerified = repo.IsVerified;
                existing.TrustScore = repo.TrustScore;
                existing.Classification = repo.Classification;
                existing.AuthenticityType = repo.AuthenticityType;
                existing.LatestRiskScore = repo.LatestRiskScore;
                existing.LatestRiskLevel = repo.LatestRiskLevel;
                existing.LatestAnalysisStatus = repo.LatestAnalysisStatus;
                context.SourceCodeRepositories.Update(existing);
                affected++;
            }
        }

        await context.SaveChangesAsync();
        return new SeederResult(ModuleId, SeedingStatus.Success, "Demo repositories seeded successfully.", affected);
    }
}
