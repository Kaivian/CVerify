using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using CVerify.API.Infrastructure.Persistence;

namespace CVerify.API.Infrastructure.Services;

/// <summary>
/// A periodic background sweeping service to purge expired, consumed tokens, revoked sessions, 
/// and aged outbox audit entries. Utilizes paginated batching to avoid table locking and db CPU spikes.
/// </summary>
public class TokenCleanupBackgroundJob : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<TokenCleanupBackgroundJob> _logger;
    private readonly TimeProvider _timeProvider;

    public TokenCleanupBackgroundJob(
        IServiceProvider serviceProvider,
        ILogger<TokenCleanupBackgroundJob> logger,
        TimeProvider timeProvider)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _timeProvider = timeProvider;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Token Cleanup Sweeper Background Job starting execution.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                _logger.LogInformation("Token Cleanup Sweeper running purge tasks.");
                await PurgeExpiredEntitiesAsync(stoppingToken).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An unhandled exception occurred in the Token Cleanup Sweeper thread.");
            }

            // Sleep for 1 hour before next cleanup sweep
            await Task.Delay(TimeSpan.FromHours(1), stoppingToken).ConfigureAwait(false);
        }

        _logger.LogInformation("Token Cleanup Sweeper Background Job stopping execution.");
    }

    private async Task PurgeExpiredEntitiesAsync(CancellationToken stoppingToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var now = _timeProvider.GetUtcNow();

        // 1. Purge expired/consumed Verification Tokens (Retention: Immediate for consumed, 30 days for history)
        var gdprLimit = now.AddDays(-30);
        
        int deleted;
        do
        {
            if (stoppingToken.IsCancellationRequested) break;

            var batch = await context.VerificationTokens
                .Where(t => t.ConsumedAt != null || t.ExpiresAt < now)
                .OrderBy(t => t.Id)
                .Take(100)
                .ToListAsync(stoppingToken)
                .ConfigureAwait(false);

            deleted = batch.Count;
            if (deleted > 0)
            {
                context.VerificationTokens.RemoveRange(batch);
                await context.SaveChangesAsync(stoppingToken).ConfigureAwait(false);
                _logger.LogInformation("Swept {Count} expired/consumed verification tokens.", deleted);
                await Task.Delay(50, stoppingToken).ConfigureAwait(false); // Throttle database sleep
            }
        } while (deleted == 100);

        // 2. Purge expired/consumed Reset Password Tokens
        do
        {
            if (stoppingToken.IsCancellationRequested) break;

            var batch = await context.ResetPasswordTokens
                .Where(t => t.ConsumedAt != null || t.ExpiresAt < now)
                .OrderBy(t => t.Id)
                .Take(100)
                .ToListAsync(stoppingToken)
                .ConfigureAwait(false);

            deleted = batch.Count;
            if (deleted > 0)
            {
                context.ResetPasswordTokens.RemoveRange(batch);
                await context.SaveChangesAsync(stoppingToken).ConfigureAwait(false);
                _logger.LogInformation("Swept {Count} expired/consumed password reset tokens.", deleted);
                await Task.Delay(50, stoppingToken).ConfigureAwait(false);
            }
        } while (deleted == 100);

        // 3. Purge inactive sessions (Refresh Tokens) older than 90 days retention (GDPR compliance)
        var sessionRetentionLimit = now.AddDays(-90);
        do
        {
            if (stoppingToken.IsCancellationRequested) break;

            var batch = await context.RefreshTokens
                .Where(t => t.ExpiresAt < sessionRetentionLimit || t.RevokedAt < sessionRetentionLimit)
                .OrderBy(t => t.Id)
                .Take(100)
                .ToListAsync(stoppingToken)
                .ConfigureAwait(false);

            deleted = batch.Count;
            if (deleted > 0)
            {
                context.RefreshTokens.RemoveRange(batch);
                await context.SaveChangesAsync(stoppingToken).ConfigureAwait(false);
                _logger.LogInformation("Swept {Count} inactive/revoked refresh tokens older than 90 days.", deleted);
                await Task.Delay(50, stoppingToken).ConfigureAwait(false);
            }
        } while (deleted == 100);

        // 4. Purge processed outbox messages older than 30 days retention
        do
        {
            if (stoppingToken.IsCancellationRequested) break;

            var batch = await context.OutboxMessages
                .Where(m => m.ProcessedAt != null && m.ProcessedAt < gdprLimit)
                .OrderBy(m => m.Id)
                .Take(100)
                .ToListAsync(stoppingToken)
                .ConfigureAwait(false);

            deleted = batch.Count;
            if (deleted > 0)
            {
                context.OutboxMessages.RemoveRange(batch);
                await context.SaveChangesAsync(stoppingToken).ConfigureAwait(false);
                _logger.LogInformation("Swept {Count} processed outbox messages older than 30 days.", deleted);
                await Task.Delay(50, stoppingToken).ConfigureAwait(false);
            }
        } while (deleted == 100);

        // 5. Purge audit logs older than 90 days retention (GDPR compliance)
        var auditRetentionLimit = now.AddDays(-90);
        do
        {
            if (stoppingToken.IsCancellationRequested) break;

            var batch = await context.AuditLogs
                .Where(l => l.CreatedAt < auditRetentionLimit)
                .OrderBy(l => l.Id)
                .Take(100)
                .ToListAsync(stoppingToken)
                .ConfigureAwait(false);

            deleted = batch.Count;
            if (deleted > 0)
            {
                context.AuditLogs.RemoveRange(batch);
                await context.SaveChangesAsync(stoppingToken).ConfigureAwait(false);
                _logger.LogInformation("Swept {Count} security audit logs older than 90 days.", deleted);
                await Task.Delay(50, stoppingToken).ConfigureAwait(false);
            }
        } while (deleted == 100);
    }
}

