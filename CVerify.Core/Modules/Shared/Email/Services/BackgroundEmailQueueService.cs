
using System;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.Shared.Email.DTOs;

namespace CVerify.API.Modules.Shared.Email.Services;

/// <summary>
/// Thread-safe in-memory email channel queue backed by System.Threading.Channels.
/// </summary>
public class BackgroundEmailQueue : IEmailQueue
{
    private readonly Channel<EmailMessage> _channel;

    /// <summary>
    /// Initializes a new instance of the <see cref="BackgroundEmailQueue"/> class.
    /// </summary>
    public BackgroundEmailQueue()
    {
        // Enforces backpressure of 1000 messages to protect system memory
        var options = new BoundedChannelOptions(1000)
        {
            FullMode = BoundedChannelFullMode.Wait,
            SingleWriter = false,
            SingleReader = true
        };
        _channel = Channel.CreateBounded<EmailMessage>(options);
    }

    /// <inheritdoc />
    public void QueueEmail(EmailMessage message)
    {
        ArgumentNullException.ThrowIfNull(message);
        
        // Writer.TryWrite is thread-safe and non-blocking
        if (!_channel.Writer.TryWrite(message))
        {
            // Fallback to blocking write if bounded bounds are hit
            // In normal configurations, TryWrite completes instantly
            Task.Run(async () => await _channel.Writer.WriteAsync(message).ConfigureAwait(false));
        }
    }

    /// <inheritdoc />
    public async Task<EmailMessage> DequeueAsync(CancellationToken cancellationToken)
    {
        return await _channel.Reader.ReadAsync(cancellationToken).ConfigureAwait(false);
    }

    /// <inheritdoc />
    public bool TryDequeue(out EmailMessage message)
    {
        return _channel.Reader.TryRead(out message!);
    }

    /// <inheritdoc />
    public async Task<bool> WaitToReadAsync(CancellationToken cancellationToken)
    {
        return await _channel.Reader.WaitToReadAsync(cancellationToken).ConfigureAwait(false);
    }

    /// <inheritdoc />
    public void CompleteWriter()
    {
        _channel.Writer.TryComplete();
    }
}

/// <summary>
/// Background worker hosted service that dequeues and delivers emails asynchronously, supporting graceful shutdown draining.
/// </summary>
public class BackgroundEmailQueueProcessor : BackgroundService
{
    private readonly IEmailQueue _emailQueue;
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<BackgroundEmailQueueProcessor> _logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="BackgroundEmailQueueProcessor"/> class.
    /// </summary>
    public BackgroundEmailQueueProcessor(
        IEmailQueue emailQueue,
        IServiceProvider serviceProvider,
        ILogger<BackgroundEmailQueueProcessor> logger)
    {
        _emailQueue = emailQueue;
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    /// <inheritdoc />
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Background Email Queue Processor started.");

        // Loop until the channel is completed and empty (WaitToReadAsync returns false)
        // We pass CancellationToken.None to WaitToReadAsync so that we can finish draining even after StopAsync triggers cancellation!
        while (true)
        {
            try
            {
                // If stoppingToken has initiated cancellation, we bypass waiting for new writes and only drain what remains!
                var hasItem = false;
                if (!stoppingToken.IsCancellationRequested)
                {
                    hasItem = await _emailQueue.WaitToReadAsync(stoppingToken).ConfigureAwait(false);
                }
                else
                {
                    // During shutdown draining, check if any items remain in memory without blocking
                    hasItem = await _emailQueue.WaitToReadAsync(CancellationToken.None).ConfigureAwait(false);
                }

                if (!hasItem)
                {
                    break; // Queue is closed and empty. Exit background loop.
                }

                // Process all currently available items in the channel
                while (_emailQueue.TryDequeue(out var message))
                {
                    _logger.LogInformation("[CorrelationID: {CorrelationId}] Background thread picked up email targeting {ToEmail} for delivery.", message.CorrelationId, message.ToEmail);

                    // Execute delivery inside an isolated service scope to prevent DbContext or client lifecycle issues
                    using var scope = _serviceProvider.CreateScope();
                    
                    // We resolve the active transport using a Keyed Service named "raw" to bypass the public decorator wrapper!
                    var rawSender = scope.ServiceProvider.GetRequiredKeyedService<IEmailSender>("raw");

                    try
                    {
                        // Use CancellationToken.None during execution so that active sends are not aborted mid-transmission during app pool recycling
                        await rawSender.SendEmailAsync(message, CancellationToken.None).ConfigureAwait(false);
                        _logger.LogInformation("[CorrelationID: {CorrelationId}] Background email successfully sent to {ToEmail}.", message.CorrelationId, message.ToEmail);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "[CorrelationID: {CorrelationId}] Failed to deliver background email to {ToEmail}.", message.CorrelationId, message.ToEmail);
                    }
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                // Prevent task cancellation crashes during regular stop transitions
                _logger.LogInformation("Background Email worker loop interrupted via regular cancellation. Draining remaining items...");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An unhandled exception occurred in the Background Email Queue Processor loop.");
                
                // Yield thread execution briefly to prevent tight CPU loops on persistent errors
                await Task.Delay(1000, CancellationToken.None).ConfigureAwait(false);
            }
        }

        _logger.LogInformation("Background Email Queue Processor loop exited.");
    }

    /// <inheritdoc />
    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Stopping Background Email Queue Processor. Draining all queued items in memory...");
        
        // Complete the channel writer. Prevents new enqueues but preserves existing buffer.
        _emailQueue.CompleteWriter();

        // Wait for the background ExecuteAsync loop to process remaining buffer items
        await base.StopAsync(cancellationToken).ConfigureAwait(false);

        _logger.LogInformation("Background Email Queue Processor stopped successfully.");
    }
}
