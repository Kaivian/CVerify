using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.Auth.Enums;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.Modules.Auth.BackgroundWorkers;

/// <summary>
/// Hosted background worker that prunes stale database states, preventing index bloat.
/// - Transitions ACTIVE sessions older than 24 hours to EXPIRED.
/// - Hard-deletes EXPIRED/INVALIDATED/VERIFIED records older than 30 days.
/// </summary>
public class OtpCleanupBackgroundWorker : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<OtpCleanupBackgroundWorker> _logger;
    private readonly TimeProvider _timeProvider;

    public OtpCleanupBackgroundWorker(
        IServiceProvider serviceProvider,
        ILogger<OtpCleanupBackgroundWorker> logger,
        TimeProvider timeProvider)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _timeProvider = timeProvider;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("OTP Database Cleanup Background Worker is starting.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunCleanupAsync(stoppingToken).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An unhandled exception occurred during OTP database cleanup.");
            }

            // Run hourly
            await Task.Delay(TimeSpan.FromHours(1), stoppingToken).ConfigureAwait(false);
        }

        _logger.LogInformation("OTP Database Cleanup Background Worker is stopping.");
    }

    private async Task RunCleanupAsync(CancellationToken stoppingToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var cacheService = scope.ServiceProvider.GetRequiredService<ICacheService>();

        var lockKey = "lock:otp:cleanup:worker";
        var lockValue = Guid.NewGuid().ToString("N");

        // Acquire a 5-minute lease lock to avoid concurrent execution in multi-instance environments
        var acquired = await cacheService.AcquireLockAsync(lockKey, lockValue, TimeSpan.FromMinutes(5)).ConfigureAwait(false);
        if (!acquired)
        {
            _logger.LogDebug("OTP cleanup lock held by another instance. Skipping this execution cycle.");
            return;
        }

        try
        {
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var utcNow = _timeProvider.GetUtcNow();

            // 1. Transition ACTIVE sessions older than 24 hours to EXPIRED
            var staleThreshold = utcNow.AddHours(-24);
            var staleActiveSessions = await context.OtpVerifications
                .Where(v => v.Status == OtpSessionStatus.ACTIVE && v.CreatedAt < staleThreshold)
                .ToListAsync(stoppingToken)
                .ConfigureAwait(false);

            if (staleActiveSessions.Any())
            {
                _logger.LogInformation("Transitioning {Count} stale ACTIVE OTP sessions to EXPIRED status.", staleActiveSessions.Count);
                foreach (var session in staleActiveSessions)
                {
                    session.Status = OtpSessionStatus.EXPIRED;
                }
            }

            // 2. Hard-delete EXPIRED/INVALIDATED/VERIFIED records older than 30 days
            var pruneThreshold = utcNow.AddDays(-30);
            var pruneStatuses = new[] { OtpSessionStatus.EXPIRED, OtpSessionStatus.INVALIDATED, OtpSessionStatus.VERIFIED };

            var obsoleteRecords = await context.OtpVerifications
                .Where(v => pruneStatuses.Contains(v.Status) && v.CreatedAt < pruneThreshold)
                .ToListAsync(stoppingToken)
                .ConfigureAwait(false);

            if (obsoleteRecords.Any())
            {
                _logger.LogInformation("Hard-deleting {Count} obsolete OTP records (EXPIRED/INVALIDATED/VERIFIED) older than 30 days.", obsoleteRecords.Count);
                context.OtpVerifications.RemoveRange(obsoleteRecords);
            }

            if (staleActiveSessions.Any() || obsoleteRecords.Any())
            {
                await context.SaveChangesAsync(stoppingToken).ConfigureAwait(false);
            }
        }
        finally
        {
            await cacheService.ReleaseLockAsync(lockKey, lockValue).ConfigureAwait(false);
        }
    }
}
