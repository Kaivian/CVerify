
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Time.Testing;
using FluentAssertions;
using Moq;
using Polly;
using Polly.CircuitBreaker;
using Polly.Timeout;
using Xunit;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.Email;
using CVerify.API.Modules.Shared.Email.Services;
using CVerify.API.Modules.Shared.Security.Authorization;

namespace CVerify.API.UnitTests.Services;

/// <summary>
/// Verifies the modern Polly v8 Resilience Pipeline behavior (Retries, Circuit Breaker, Timeout strategies)
/// using FakeTimeProvider temporal control.
/// </summary>
public class PollyResilienceTests
{
    private readonly FakeTimeProvider _timeProvider;
    private readonly Mock<IEmailAuditLogger> _auditLoggerMock;
    private readonly ResiliencePipeline _pipeline;

    /// <summary>
    /// Initializes a new instance of the <see cref="PollyResilienceTests"/> class.
    /// </summary>
    public PollyResilienceTests()
    {
        _timeProvider = new FakeTimeProvider();
        _auditLoggerMock = new Mock<IEmailAuditLogger>();

        // Build a real in-memory configuration collection
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                { "EmailSettings:RetryCount", "3" },
                { "EmailSettings:RetryDelaySeconds", "1" }, // Short delay for quick test runs
                { "EmailSettings:TimeoutSeconds", "5" }, // Meets minimum 5-second validation threshold!
                { "EmailSettings:SenderEmail", "resilience-test@cverify.ai" },
                { "EmailSettings:SenderName", "Resilience Tester" }
            })
            .Build();

        var services = new ServiceCollection();

        // 1. Pre-register the FakeTimeProvider as singleton so AddEmailInfrastructure's TryAddSingleton skips overwriting it
        services.AddSingleton<TimeProvider>(_timeProvider);
        services.AddSingleton<IEmailAuditLogger>(_auditLoggerMock.Object);
        services.AddLogging();

        // 2. Add complete email infrastructure
        services.AddEmailInfrastructure(configuration);

        var serviceProvider = services.BuildServiceProvider();
        _pipeline = serviceProvider.GetRequiredService<ResiliencePipeline>();
    }

    [Fact]
    public async Task Pipeline_ShouldRetryTransientFailuresAndSucceedIfSubsequentAttemptsWork()
    {
        var attempts = 0;

        // Act - Start execution as a task without awaiting it immediately
        var executeTask = _pipeline.ExecuteAsync(async ct =>
        {
            attempts++;
            if (attempts < 3)
            {
                throw new InvalidOperationException("Temporary SMTP socket timeout.");
            }
            return await Task.FromResult("SUCCESS").ConfigureAwait(false);
        });

        // Yield and advance time provider repeatedly to bypass retry delay
        for (int i = 0; i < 5; i++)
        {
            await Task.Delay(50);
            _timeProvider.Advance(TimeSpan.FromSeconds(5));
        }

        var result = await executeTask;

        // Assert
        result.Should().Be("SUCCESS");
        attempts.Should().Be(3); // 2 failures + 1 success = 3 attempts total
    }

    [Fact]
    public async Task Pipeline_ShouldLimitRetriesAndThrowIfLimitExceeded()
    {
        var attempts = 0;

        // Act - Start execution as a task without awaiting it immediately
        var executeTask = _pipeline.ExecuteAsync<string>(async ct =>
        {
            attempts++;
            throw new InvalidOperationException("Persistent gateway authentication failure.");
        });

        // Yield and advance time provider repeatedly to bypass retry delay
        for (int i = 0; i < 5; i++)
        {
            await Task.Delay(50);
            _timeProvider.Advance(TimeSpan.FromSeconds(5));
        }

        // Assert
        Func<Task> act = async () => await executeTask.ConfigureAwait(false);
        await act.Should().ThrowAsync<InvalidOperationException>();
        // Original attempt (1) + MaxRetryAttempts (3) = 4 total attempts
        attempts.Should().Be(4);
    }

    [Fact]
    public async Task Pipeline_ShouldEnforceTimeoutPolicyAndCancelHangingRequests()
    {
        // Build a dedicated pipeline with strict timeout settings to isolate from DI overrides
        var builder = new ResiliencePipelineBuilder();
        builder.TimeProvider = _timeProvider;
        builder.AddTimeout(TimeSpan.FromSeconds(2));
        var pipeline = builder.Build();

        // Act
        var act = async () => await pipeline.ExecuteAsync(async ct =>
        {
            // Hang infinitely until Polly's cancellation token is triggered
            await Task.Delay(Timeout.InfiniteTimeSpan, ct).ConfigureAwait(false);
            return "LATE_SUCCESS";
        }).ConfigureAwait(false);

        var executeTask = act();
        await Task.Delay(100); // Yield execution to let Polly register its timeout timer
        _timeProvider.Advance(TimeSpan.FromSeconds(3));

        // Assert
        Func<Task> actTimeout = async () => await executeTask.ConfigureAwait(false);
        await actTimeout.Should().ThrowAsync<TimeoutRejectedException>();
    }

    [Fact]
    public async Task Pipeline_ShouldOpenCircuitBreakerOnConsecutiveFailures()
    {
        // Build a dedicated pipeline with strict circuit breaker settings
        var breakerOptions = new CircuitBreakerStrategyOptions
        {
            FailureRatio = 0.5, // Break if 50% fail
            SamplingDuration = TimeSpan.FromSeconds(10),
            MinimumThroughput = 2,
            BreakDuration = TimeSpan.FromSeconds(5)
        };

        var builder = new ResiliencePipelineBuilder();
        builder.TimeProvider = _timeProvider;

        var pipeline = builder
            .AddCircuitBreaker(breakerOptions)
            .Build();

        // 1. Trigger two consecutive failures to break the circuit
        Func<Task> action1 = async () => await pipeline.ExecuteAsync(async ct => throw new InvalidOperationException("Error 1")).ConfigureAwait(false);
        Func<Task> action2 = async () => await pipeline.ExecuteAsync(async ct => throw new InvalidOperationException("Error 2")).ConfigureAwait(false);

        await action1.Should().ThrowAsync<InvalidOperationException>();
        await action2.Should().ThrowAsync<InvalidOperationException>();

        // 2. The third attempt should fail-fast instantly with BrokenCircuitException
        Func<Task> action3 = async () => await pipeline.ExecuteAsync(async ct => "SUCCESS").ConfigureAwait(false);
        await action3.Should().ThrowAsync<BrokenCircuitException>();
    }
}
