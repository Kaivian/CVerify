using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.Modules.Auth.BackgroundWorkers;

/// <summary>
/// Hosted background worker that cleans up expired pending OAuth provider links.
/// Runs every 30 minutes to prune records where ExpiresAt is less than the current time.
/// </summary>
public class PendingLinkCleanupService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<PendingLinkCleanupService> _logger;
    private readonly TimeProvider _timeProvider;

    public PendingLinkCleanupService(
        IServiceProvider serviceProvider,
        ILogger<PendingLinkCleanupService> logger,
        TimeProvider timeProvider)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _timeProvider = timeProvider;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Pending OAuth Link Cleanup Background Worker is starting.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunCleanupAsync(stoppingToken).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An unhandled exception occurred during pending OAuth link cleanup.");
            }

            // Run every 30 minutes
            await Task.Delay(TimeSpan.FromMinutes(30), stoppingToken).ConfigureAwait(false);
        }

        _logger.LogInformation("Pending OAuth Link Cleanup Background Worker is stopping.");
    }

    private async Task RunCleanupAsync(CancellationToken stoppingToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var cacheService = scope.ServiceProvider.GetRequiredService<ICacheService>();

        var lockKey = "lock:pending:link:cleanup";
        var lockValue = Guid.NewGuid().ToString("N");

        // Acquire a 5-minute lease lock to avoid concurrent execution in multi-instance environments
        var acquired = await cacheService.AcquireLockAsync(lockKey, lockValue, TimeSpan.FromMinutes(5)).ConfigureAwait(false);
        if (!acquired)
        {
            _logger.LogDebug("Pending OAuth link cleanup lock held by another instance. Skipping this execution cycle.");
            return;
        }

        try
        {
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var utcNow = _timeProvider.GetUtcNow();

            var expiredLinks = await context.PendingAuthProviders
                .Where(p => p.ExpiresAt < utcNow)
                .ToListAsync(stoppingToken)
                .ConfigureAwait(false);

            if (expiredLinks.Any())
            {
                _logger.LogInformation("Hard-deleting {Count} expired pending OAuth provider link records.", expiredLinks.Count);
                context.PendingAuthProviders.RemoveRange(expiredLinks);
                await context.SaveChangesAsync(stoppingToken).ConfigureAwait(false);
            }
        }
        finally
        {
            await cacheService.ReleaseLockAsync(lockKey, lockValue).ConfigureAwait(false);
        }
    }
}
