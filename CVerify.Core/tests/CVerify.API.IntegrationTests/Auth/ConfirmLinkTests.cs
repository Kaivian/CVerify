using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using FluentAssertions;
using Xunit;
using CVerify.API.IntegrationTests.Fixtures;
using CVerify.API.Modules.Auth.Entities;
using CVerify.API.Modules.Auth.Services;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.SourceCode.Entities;
using CVerify.API.Modules.SourceCode.Services;
using CVerify.API.Modules.SourceCode.Clients;

namespace CVerify.API.IntegrationTests.Auth;

public class ConfirmLinkTests : BaseIntegrationTest
{
    public ConfirmLinkTests(SharedTestcontainerFixture containerFixture) : base(containerFixture)
    {
    }

    private async Task<(User User, Role UserRole)> SeedUserAsync(ApplicationDbContext db)
    {
        var userRole = await db.Roles.FirstOrDefaultAsync(r => r.Name == "USER");
        if (userRole == null)
        {
            userRole = new Role
            {
                Name = "USER",
                DisplayName = "General User",
                Description = "Basic user access",
                IsSystem = true,
                IsActive = true
            };
            db.Roles.Add(userRole);
            await db.SaveChangesAsync();
        }

        var user = new User
        {
            Id = Guid.CreateVersion7(),
            Email = $"user_{Guid.NewGuid()}@cverify.ai",
            Username = $"user_{Guid.NewGuid().ToString("N")[..10]}",
            FullName = "Luc Confirm Link Test User",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("TestPass123!"),
            Status = UserStatus.ACTIVE,
            EmailVerifiedAt = DateTimeOffset.UtcNow
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        return (user, userRole);
    }

    private void FakeAuthenticatedUser(IServiceProvider serviceProvider, Guid userId)
    {
        var httpContextAccessor = serviceProvider.GetRequiredService<IHttpContextAccessor>();
        var httpContext = new DefaultHttpContext();
        var claims = new[] { new Claim(ClaimTypes.NameIdentifier, userId.ToString()) };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        httpContext.User = new ClaimsPrincipal(identity);
        httpContextAccessor.HttpContext = httpContext;
    }

    [Fact]
    public async Task ConfirmLink_NewProvider_Should_Insert_Successfully()
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var authService = scope.ServiceProvider.GetRequiredService<IAuthService>();
        var timeProvider = scope.ServiceProvider.GetRequiredService<TimeProvider>();

        var (user, _) = await SeedUserAsync(db);
        FakeAuthenticatedUser(scope.ServiceProvider, user.Id);

        // Seed pending provider
        var pendingId = Guid.CreateVersion7();
        var pending = new PendingAuthProvider
        {
            Id = pendingId,
            UserId = user.Id,
            ProviderName = "github",
            ProviderKey = "12345678",
            ProviderAccountId = "github_user_acc",
            ProviderUsername = "github_user_acc",
            ProviderDisplayName = "GitHub Display Name",
            EncryptedAccessToken = "EncryptedAccessTokenText",
            ExpiresAt = timeProvider.GetUtcNow().AddMinutes(10),
            CreatedAt = timeProvider.GetUtcNow()
        };
        db.PendingAuthProviders.Add(pending);
        await db.SaveChangesAsync();

        // Act
        var result = await authService.ConfirmLinkAsync(pendingId);

        // Assert
        result.Should().BeTrue();

        var provider = await db.AuthProviders.FirstOrDefaultAsync(ap => ap.UserId == user.Id && ap.ProviderName == "github");
        provider.Should().NotBeNull();
        provider!.ProviderKey.Should().Be("12345678");
        provider.ScopeValidationStatus.Should().Be(ProviderScopeStatus.Valid);
        provider.SyncStatus.Should().Be("Pending");

        var pendingExists = await db.PendingAuthProviders.AnyAsync(pap => pap.Id == pendingId);
        pendingExists.Should().BeFalse();
    }

    [Fact]
    public async Task ConfirmLink_ActiveProvider_Should_Update_And_Reset_Metadata()
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var authService = scope.ServiceProvider.GetRequiredService<IAuthService>();
        var timeProvider = scope.ServiceProvider.GetRequiredService<TimeProvider>();

        var (user, _) = await SeedUserAsync(db);
        FakeAuthenticatedUser(scope.ServiceProvider, user.Id);

        // Seed existing active provider link in degraded/failed status
        var existing = new AuthProvider
        {
            Id = Guid.CreateVersion7(),
            UserId = user.Id,
            ProviderName = "github",
            ProviderKey = "12345678",
            ProviderAccountId = "old_acc",
            ProviderUsername = "old_user",
            ScopeValidationStatus = ProviderScopeStatus.ReconnectRequired,
            SyncStatus = "Failed",
            SyncError = "Token expired",
            RefreshFailureCount = 5,
            CreatedAt = timeProvider.GetUtcNow().AddDays(-10)
        };
        db.AuthProviders.Add(existing);
        await db.SaveChangesAsync();

        // Seed pending provider with new credentials
        var pendingId = Guid.CreateVersion7();
        var pending = new PendingAuthProvider
        {
            Id = pendingId,
            UserId = user.Id,
            ProviderName = "github",
            ProviderKey = "12345678", // Same key
            ProviderAccountId = "new_acc",
            ProviderUsername = "new_user",
            ProviderDisplayName = "New Display Name",
            EncryptedAccessToken = "NewAccessToken",
            ExpiresAt = timeProvider.GetUtcNow().AddMinutes(10),
            CreatedAt = timeProvider.GetUtcNow()
        };
        db.PendingAuthProviders.Add(pending);
        await db.SaveChangesAsync();

        // Act
        var result = await authService.ConfirmLinkAsync(pendingId);

        // Assert
        result.Should().BeTrue();

        // Verify no duplicate row was created, only updated
        var count = await db.AuthProviders.CountAsync(ap => ap.UserId == user.Id && ap.ProviderName == "github");
        count.Should().Be(1);

        var updated = await db.AuthProviders.FirstOrDefaultAsync(ap => ap.Id == existing.Id);
        updated.Should().NotBeNull();
        updated!.ProviderAccountId.Should().Be("new_acc");
        updated.ProviderUsername.Should().Be("new_user");
        updated.ProviderDisplayName.Should().Be("New Display Name");
        updated.EncryptedAccessToken.Should().Be("NewAccessToken");

        // Metadata should be reset
        updated.ScopeValidationStatus.Should().Be(ProviderScopeStatus.Valid);
        updated.SyncStatus.Should().Be("Pending");
        updated.SyncError.Should().BeNull();
        updated.RefreshFailureCount.Should().Be(0);
    }

    [Fact]
    public async Task ConfirmLink_SoftDeletedProvider_Should_Reactivate_And_Update()
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var authService = scope.ServiceProvider.GetRequiredService<IAuthService>();
        var timeProvider = scope.ServiceProvider.GetRequiredService<TimeProvider>();

        var (user, _) = await SeedUserAsync(db);
        FakeAuthenticatedUser(scope.ServiceProvider, user.Id);

        // Seed existing soft-deleted provider
        var existing = new AuthProvider
        {
            Id = Guid.CreateVersion7(),
            UserId = user.Id,
            ProviderName = "github",
            ProviderKey = "12345678",
            ProviderAccountId = "github_acc",
            DeletedAt = timeProvider.GetUtcNow().AddDays(-2),
            ScopeValidationStatus = ProviderScopeStatus.ReconnectRequired,
            SyncStatus = "Failed",
            SyncError = "Revoked"
        };
        db.AuthProviders.Add(existing);
        await db.SaveChangesAsync();

        // Seed pending provider
        var pendingId = Guid.CreateVersion7();
        var pending = new PendingAuthProvider
        {
            Id = pendingId,
            UserId = user.Id,
            ProviderName = "github",
            ProviderKey = "12345678",
            ProviderAccountId = "github_acc",
            ProviderUsername = "github_user_new",
            EncryptedAccessToken = "ReactivatedToken",
            ExpiresAt = timeProvider.GetUtcNow().AddMinutes(10)
        };
        db.PendingAuthProviders.Add(pending);
        await db.SaveChangesAsync();

        // Act
        var result = await authService.ConfirmLinkAsync(pendingId);

        // Assert
        result.Should().BeTrue();

        // The query filter ap.DeletedAt == null is bypassed by the reactivation update.
        // Let's verify we have exactly 1 active provider in the DB.
        var count = await db.AuthProviders.CountAsync(ap => ap.UserId == user.Id && ap.ProviderName == "github");
        count.Should().Be(1);

        var updated = await db.AuthProviders.IgnoreQueryFilters().FirstOrDefaultAsync(ap => ap.Id == existing.Id);
        updated.Should().NotBeNull();
        updated!.DeletedAt.Should().BeNull(); // Reactivated!
        updated.ProviderUsername.Should().Be("github_user_new");
        updated.EncryptedAccessToken.Should().Be("ReactivatedToken");

        // Metadata reset check
        updated.ScopeValidationStatus.Should().Be(ProviderScopeStatus.Valid);
        updated.SyncStatus.Should().Be("Pending");
        updated.SyncError.Should().BeNull();
    }

    [Fact]
    public async Task ConfirmLink_ConcurrentRequests_Should_Serialize_And_Not_Duplicate()
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var authService = scope.ServiceProvider.GetRequiredService<IAuthService>();
        var timeProvider = scope.ServiceProvider.GetRequiredService<TimeProvider>();

        var (user, _) = await SeedUserAsync(db);

        // Seed two pending provider links representing concurrent callbacks (simulated double click)
        var pendingId1 = Guid.CreateVersion7();
        var pending1 = new PendingAuthProvider
        {
            Id = pendingId1,
            UserId = user.Id,
            ProviderName = "github",
            ProviderKey = "12345678",
            ProviderAccountId = "github_acc",
            EncryptedAccessToken = "AccessToken1",
            ExpiresAt = timeProvider.GetUtcNow().AddMinutes(10)
        };

        var pendingId2 = Guid.CreateVersion7();
        var pending2 = new PendingAuthProvider
        {
            Id = pendingId2,
            UserId = user.Id,
            ProviderName = "github",
            ProviderKey = "12345678",
            ProviderAccountId = "github_acc",
            EncryptedAccessToken = "AccessToken2",
            ExpiresAt = timeProvider.GetUtcNow().AddMinutes(10)
        };

        db.PendingAuthProviders.AddRange(pending1, pending2);
        await db.SaveChangesAsync();

        // Run both ConfirmLinkAsync concurrently using separate scopes to simulate parallel HTTP requests
        var task1 = Task.Run(async () =>
        {
            using var s1 = Factory.Services.CreateScope();
            FakeAuthenticatedUser(s1.ServiceProvider, user.Id);
            var service1 = s1.ServiceProvider.GetRequiredService<IAuthService>();
            try
            {
                return await service1.ConfirmLinkAsync(pendingId1);
            }
            catch (Exception)
            {
                return false;
            }
        });

        var task2 = Task.Run(async () =>
        {
            using var s2 = Factory.Services.CreateScope();
            FakeAuthenticatedUser(s2.ServiceProvider, user.Id);
            var service2 = s2.ServiceProvider.GetRequiredService<IAuthService>();
            try
            {
                return await service2.ConfirmLinkAsync(pendingId2);
            }
            catch (Exception)
            {
                return false;
            }
        });

        // Act
        await Task.WhenAll(task1, task2);

        // Assert
        var res1 = await task1;
        var res2 = await task2;

        // One must succeed, the other might fail or succeed depending on whether it updates or throws.
        // But the key assertion is that NO unique constraint violations were triggered that left the DB dirty,
        // and we have exactly 1 active provider in the DB.
        (res1 || res2).Should().BeTrue();

        var providersCount = await db.AuthProviders.CountAsync(ap => ap.UserId == user.Id && ap.ProviderName == "github");
        providersCount.Should().Be(1);
    }

    [Fact]
    public async Task ProviderReactivation_Should_Preserve_Existing_Repository_Relationships()
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var authService = scope.ServiceProvider.GetRequiredService<IAuthService>();
        var timeProvider = scope.ServiceProvider.GetRequiredService<TimeProvider>();

        var (user, _) = await SeedUserAsync(db);
        FakeAuthenticatedUser(scope.ServiceProvider, user.Id);

        // Seed provider
        var providerId = Guid.CreateVersion7();
        var provider = new AuthProvider
        {
            Id = providerId,
            UserId = user.Id,
            ProviderName = "github",
            ProviderKey = "12345678",
            ProviderAccountId = "github_acc",
            DeletedAt = timeProvider.GetUtcNow().AddDays(-5),
            ScopeValidationStatus = ProviderScopeStatus.ReconnectRequired
        };
        db.AuthProviders.Add(provider);

        // Seed repository linked to this provider
        var repoId = Guid.CreateVersion7();
        var repo = new SourceCodeRepository
        {
            Id = repoId,
            AuthProviderId = providerId,
            ExternalRepositoryId = "999999",
            Name = "integrity-test-repo",
            Owner = "github_acc",
            HtmlUrl = "https://github.com/github_acc/integrity-test-repo",
            DefaultBranch = "main",
            OwnerLogin = "github_acc",
            OwnerType = "User",
            IsAccessible = true,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            LastUpdatedUtc = DateTimeOffset.UtcNow,
            LastSeenAt = DateTimeOffset.UtcNow,
            LastSyncedAt = DateTimeOffset.UtcNow
        };
        db.SourceCodeRepositories.Add(repo);
        await db.SaveChangesAsync();

        // Seed pending provider for reactivation
        var pendingId = Guid.CreateVersion7();
        var pending = new PendingAuthProvider
        {
            Id = pendingId,
            UserId = user.Id,
            ProviderName = "github",
            ProviderKey = "12345678",
            ProviderAccountId = "github_acc",
            EncryptedAccessToken = "NewAccessToken",
            ExpiresAt = timeProvider.GetUtcNow().AddMinutes(10)
        };
        db.PendingAuthProviders.Add(pending);
        await db.SaveChangesAsync();

        // Act - Reactivate the provider
        var confirmResult = await authService.ConfirmLinkAsync(pendingId);
        confirmResult.Should().BeTrue();

        // Assert - Relationships remain intact and active
        var activeProvider = await db.AuthProviders.FirstOrDefaultAsync(ap => ap.Id == providerId);
        activeProvider.Should().NotBeNull();
        activeProvider!.DeletedAt.Should().BeNull();

        // Verify the repository is still correctly linked to this reactivated provider
        var linkedRepo = await db.SourceCodeRepositories
            .FirstOrDefaultAsync(r => r.Id == repoId && r.AuthProviderId == providerId);
        linkedRepo.Should().NotBeNull();
        linkedRepo!.Name.Should().Be("integrity-test-repo");
    }

    [Fact]
    public async Task SyncJob_InvalidProvider_Should_Skip_Syncing_And_Mark_Failed()
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var syncService = scope.ServiceProvider.GetRequiredService<ISourceCodeProviderService>();
        var timeProvider = scope.ServiceProvider.GetRequiredService<TimeProvider>();

        var (user, _) = await SeedUserAsync(db);

        // Seed provider connection in ReconnectRequired state
        var provider = new AuthProvider
        {
            Id = Guid.CreateVersion7(),
            UserId = user.Id,
            ProviderName = "github",
            ProviderKey = "12345678",
            ProviderAccountId = "github_acc",
            ScopeValidationStatus = ProviderScopeStatus.ReconnectRequired,
            SyncStatus = "Pending"
        };
        db.AuthProviders.Add(provider);
        await db.SaveChangesAsync();

        // Enqueue the job first, which registers it in Redis cache
        var jobId = await syncService.EnqueueSyncJobAsync(user.Id, provider.Id);
        var job = new RepositorySyncJob(jobId, user.Id, provider.Id);

        // Act
        await syncService.ExecuteSyncJobAsync(job, System.Threading.CancellationToken.None);

        // Assert
        var updatedProvider = await db.AuthProviders.FirstOrDefaultAsync(ap => ap.Id == provider.Id);
        updatedProvider.Should().NotBeNull();
        updatedProvider!.SyncStatus.Should().Be("Failed");
        updatedProvider.SyncError.Should().ContainEquivalentOf("re-authorization is required");
    }

    [Fact]
    public async Task Reconnect_And_Unlink_Should_Toggle_Repository_Accessibility()
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var authService = scope.ServiceProvider.GetRequiredService<IAuthService>();
        var timeProvider = scope.ServiceProvider.GetRequiredService<TimeProvider>();

        var (user, _) = await SeedUserAsync(db);
        FakeAuthenticatedUser(scope.ServiceProvider, user.Id);

        // 1. Seed provider in ReconnectRequired state with a repository
        var providerId = Guid.CreateVersion7();
        var provider = new AuthProvider
        {
            Id = providerId,
            UserId = user.Id,
            ProviderName = "github",
            ProviderKey = "12345678",
            ProviderAccountId = "github_acc",
            ScopeValidationStatus = ProviderScopeStatus.ReconnectRequired
        };
        db.AuthProviders.Add(provider);

        var repoId = Guid.CreateVersion7();
        var repo = new SourceCodeRepository
        {
            Id = repoId,
            AuthProviderId = providerId,
            ExternalRepositoryId = "999999",
            Name = "visibility-test-repo",
            Owner = "github_acc",
            HtmlUrl = "https://github.com/github_acc/visibility-test-repo",
            DefaultBranch = "main",
            OwnerLogin = "github_acc",
            OwnerType = "User",
            IsAccessible = false, // starts hidden because reconnect is required
            CreatedAtUtc = DateTimeOffset.UtcNow,
            LastUpdatedUtc = DateTimeOffset.UtcNow,
            LastSeenAt = DateTimeOffset.UtcNow,
            LastSyncedAt = DateTimeOffset.UtcNow
        };
        db.SourceCodeRepositories.Add(repo);
        await db.SaveChangesAsync();

        // Seed pending provider for reconnection
        var pendingId = Guid.CreateVersion7();
        var pending = new PendingAuthProvider
        {
            Id = pendingId,
            UserId = user.Id,
            ProviderName = "github",
            ProviderKey = "12345678",
            ProviderAccountId = "github_acc",
            EncryptedAccessToken = "NewAccessToken",
            ExpiresAt = timeProvider.GetUtcNow().AddMinutes(10)
        };
        db.PendingAuthProviders.Add(pending);
        await db.SaveChangesAsync();

        // Act - Reconnect
        var confirmResult = await authService.ConfirmLinkAsync(pendingId);
        confirmResult.Should().BeTrue();

        // Assert - repositories linked back together (IsAccessible is true)
        var updatedRepo = await db.SourceCodeRepositories.FirstOrDefaultAsync(r => r.Id == repoId);
        updatedRepo.Should().NotBeNull();
        updatedRepo!.IsAccessible.Should().BeTrue();

        // Seed second method (e.g. password) to allow unlinking
        var updatedUser = await db.Users.FirstOrDefaultAsync(u => u.Id == user.Id);
        updatedUser!.PasswordHash = "hashedpassword";
        await db.SaveChangesAsync();

        // Act - Unlink
        var unlinkResult = await authService.UnlinkProviderConnectionAsync(providerId);
        unlinkResult.Should().BeTrue();

        // Assert - repositories are hidden again (IsAccessible is false)
        var unlinkedRepo = await db.SourceCodeRepositories.IgnoreQueryFilters().FirstOrDefaultAsync(r => r.Id == repoId);
        unlinkedRepo.Should().NotBeNull();
        unlinkedRepo!.IsAccessible.Should().BeFalse();
    }
}
