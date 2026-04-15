using System;
using System.Net.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using Polly;
using Polly.CircuitBreaker;
using Polly.Retry;
using Polly.Timeout;
using CVerify.API.Modules.AiChat.Entities;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.Diagnostics;
using CVerify.API.Modules.Shared.Email.DTOs;
using CVerify.API.Modules.Shared.Email.Services;

namespace CVerify.API.Modules.Shared.Email;

/// <summary>
/// Provides extension methods to register the complete email infrastructure stack in the dependency injection container.
/// </summary>
public static class EmailInfrastructureExtensions
{
    /// <summary>
    /// Adds all necessary configuration, services, transport senders, background processors, and health checks for email delivery.
    /// </summary>
    public static IServiceCollection AddEmailInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        // Register TimeProvider (TryAddSingleton allows test suites to inject Mock/FakeTimeProvider)
        services.TryAddSingleton(TimeProvider.System);

        services.Configure<EmailSettings>(options =>
        {
            var section = configuration.GetSection(EmailSettings.SectionName);

            // Build a resolved in-memory dictionary of all keys in the section
            var resolvedData = new Dictionary<string, string?>();
            foreach (var child in section.AsEnumerable(makePathsRelative: true))
            {
                if (child.Value != null)
                {
                    resolvedData[child.Key] = child.Value.ResolveEnvironmentVariables();
                }
            }

            // Bind from the resolved in-memory configuration to support both string and non-string placeholder evaluation safely
            var resolvedConfig = new ConfigurationBuilder()
                .AddInMemoryCollection(resolvedData)
                .Build();

            resolvedConfig.Bind(options);
        });

        // Register configuration validation on startup
        services.AddOptions<EmailSettings>()
            .ValidateDataAnnotations()
            .ValidateOnStart();

        // 2. Register Template, Audit Logger, and Cache Abstractions
        services.AddSingleton<IEmailTemplateService, EmailTemplateService>();
        services.AddSingleton<IEmailAuditLogger, StructuredEmailAuditLogger>();

        // 3. Register standard and typed HttpClient for SendGrid REST endpoint dispatch
        services.AddHttpClient<SendGridHttpSender>();

        // 4. Register transport senders
        services.AddTransient<MailKitSmtpSender>();
        services.AddTransient<SendGridHttpSender>();
        services.AddTransient<FailoverEmailSender>();

        // 5. Build and register the modern Polly v8 Resilience Pipeline
        services.AddSingleton<ResiliencePipeline>(sp =>
        {
            var settings = sp.GetRequiredService<IOptions<EmailSettings>>().Value;
            var auditLogger = sp.GetRequiredService<IEmailAuditLogger>();
            var timeProvider = sp.GetRequiredService<TimeProvider>();

            // Setup a robust retry strategy with exponential backoff and randomized jitter to protect gateways
            var retryOptions = new RetryStrategyOptions
            {
                MaxRetryAttempts = settings.RetryCount > 0 ? settings.RetryCount : 3,
                BackoffType = DelayBackoffType.Exponential,
                UseJitter = true,
                Delay = TimeSpan.FromSeconds(settings.RetryDelaySeconds > 0 ? settings.RetryDelaySeconds : 2),
                OnRetry = args =>
                {
                    // Inspect context property parameters to log retry audits cleanly via our observer
                    if (args.Context.Properties.TryGetValue(new ResiliencePropertyKey<EmailMessage>("Message"), out var message) &&
                        args.Context.Properties.TryGetValue(new ResiliencePropertyKey<string>("Provider"), out var provider))
                    {
                        auditLogger.LogRetry(message, provider, args.AttemptNumber + 1, args.Outcome.Exception!);
                    }
                    return default;
                }
            };

            // Setup a circuit breaker to fail-fast during external mail gateway blackouts or API errors
            var cbOptions = new CircuitBreakerStrategyOptions
            {
                FailureRatio = 0.5, // Break if 50% of requests fail
                SamplingDuration = TimeSpan.FromMinutes(2),
                MinimumThroughput = 8,
                BreakDuration = TimeSpan.FromSeconds(30)
            };

            // Setup connection timeouts to protect application thread pools from socket lockups
            var timeoutOptions = new TimeoutStrategyOptions
            {
                Timeout = TimeSpan.FromSeconds(settings.TimeoutSeconds > 0 ? settings.TimeoutSeconds : 30)
            };

            var builder = new ResiliencePipelineBuilder();
            builder.TimeProvider = timeProvider;

            return builder
                .AddRetry(retryOptions)
                .AddCircuitBreaker(cbOptions)
                .AddTimeout(timeoutOptions)
                .Build();
        });

        // 6. Register Keyed Services for transport decorator mapping
        services.AddKeyedTransient<IEmailSender>("raw", (sp, key) =>
        {
            var settings = sp.GetRequiredService<IOptions<EmailSettings>>().Value;

            return settings.Provider switch
            {
                EmailProvider.Smtp => sp.GetRequiredService<MailKitSmtpSender>(),
                EmailProvider.SendGrid => sp.GetRequiredService<SendGridHttpSender>(),
                EmailProvider.Failover => sp.GetRequiredService<FailoverEmailSender>(),
                _ => throw new InvalidOperationException($"Unsupported email provider configuration: '{settings.Provider}'")
            };
        });

        // 7. Configure background channel enqueuer and draining worker processor
        services.AddSingleton<IEmailQueue, BackgroundEmailQueue>();
        services.AddHostedService<BackgroundEmailQueueProcessor>();

        // 8. Register the primary IEmailSender interface public binding
        services.AddTransient<IEmailSender>(sp =>
        {
            var settings = sp.GetRequiredService<IOptions<EmailSettings>>().Value;
            
            // If background channel queuing is enabled, return the decorator; otherwise, resolve the raw sender directly
            if (settings.EnableBackgroundQueue)
            {
                return new QueuedEmailSenderDecorator(
                    sp.GetRequiredService<IEmailQueue>(),
                    sp.GetRequiredService<ILogger<QueuedEmailSenderDecorator>>());
            }

            return sp.GetRequiredKeyedService<IEmailSender>("raw");
        });

        // 9. Register business-level service
        services.AddScoped<IEmailRecipientResolver, EmailRecipientResolver>();
        services.AddTransient<IEmailService, EmailService>();

        // 10. Register health monitoring diagnostics integration
        services.AddHealthChecks()
            .AddCheck<EmailProviderHealthCheck>("email_provider");

        return services;
    }
}
