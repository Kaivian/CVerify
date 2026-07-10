using System;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.Intelligence.Services;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.System.Services;

namespace CVerify.API.Modules.Intelligence.BackgroundWorkers;

public class TalentOutboxBackgroundProcessor : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<TalentOutboxBackgroundProcessor> _logger;

    public TalentOutboxBackgroundProcessor(
        IServiceProvider serviceProvider,
        ILogger<TalentOutboxBackgroundProcessor> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Talent Outbox Background Processor starting execution.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessPendingMessagesAsync(stoppingToken).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An unhandled exception occurred in the Talent Outbox Background Processor thread.");
            }

            // Sleep for 3 seconds before next polling cycle
            await Task.Delay(TimeSpan.FromSeconds(3), stoppingToken).ConfigureAwait(false);
        }

        _logger.LogInformation("Talent Outbox Background Processor stopping execution.");
    }

    private async Task ProcessPendingMessagesAsync(CancellationToken stoppingToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var cacheService = scope.ServiceProvider.GetRequiredService<ICacheService>();

        var lockKey = "lock:outbox:talent:processor";
        var lockValue = Guid.NewGuid().ToString("N");

        var acquired = await cacheService.AcquireLockAsync(lockKey, lockValue, TimeSpan.FromSeconds(15)).ConfigureAwait(false);
        if (!acquired) return;

        try
        {
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var pipeline = scope.ServiceProvider.GetRequiredService<IRepositoryIntelligencePipeline>();

            // Fetch pending outbox messages matching intelligence types
            var pendingMessages = await context.OutboxMessages
                .Where(m => m.ProcessedAt == null &&
                            (m.Type == "RepositorySyncTriggered" ||
                             m.Type == "CandidateAssessmentTriggered"))
                .OrderBy(m => m.CreatedAt)
                .Take(20)
                .ToListAsync(stoppingToken)
                .ConfigureAwait(false);

            if (!pendingMessages.Any()) return;

            _logger.LogInformation("Processing {Count} pending talent intelligence outbox messages.", pendingMessages.Count);

            foreach (var message in pendingMessages)
            {
                if (stoppingToken.IsCancellationRequested) break;

                try
                {
                    switch (message.Type)
                    {
                        case "RepositorySyncTriggered":
                            var payload = JsonSerializer.Deserialize<RepoSyncPayload>(message.Payload);
                            if (payload != null)
                            {
                                _logger.LogInformation("Executing pipeline for candidate {CandidateId} and repo {RepositoryId}", payload.CandidateId, payload.RepositoryId);
                                await pipeline.ExecutePipelineAsync(payload.CandidateId, payload.RepositoryId).ConfigureAwait(false);
                            }
                            break;

                        default:
                            break;
                    }

                    message.ProcessedAt = DateTimeOffset.UtcNow;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to process talent outbox message {MessageId} of type {Type}.", message.Id, message.Type);
                    message.Error = ex.ToString();
                }
            }

            await context.SaveChangesAsync(stoppingToken).ConfigureAwait(false);
        }
        finally
        {
            await cacheService.ReleaseLockAsync(lockKey, lockValue).ConfigureAwait(false);
        }
    }

    private class RepoSyncPayload
    {
        public Guid CandidateId { get; set; }
        public Guid RepositoryId { get; set; }
    }
}
