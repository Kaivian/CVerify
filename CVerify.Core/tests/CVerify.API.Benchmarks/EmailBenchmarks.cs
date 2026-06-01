
using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using BenchmarkDotNet.Attributes;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Email.DTOs;
using CVerify.API.Modules.Shared.Email.Services;

namespace CVerify.API.Benchmarks;

/// <summary>
/// Micro-benchmarks validating execution speed and memory allocations for core template compilation and background queuing.
/// </summary>
[MemoryDiagnoser]
public class EmailBenchmarks
{
    private EmailTemplateService _templateService = null!;
    private BackgroundEmailQueue _queue = null!;
    private Dictionary<string, object> _model = null!;
    private EmailMessage _message = null!;
    private string _templatesDirectory = null!;

    /// <summary>
    /// Bootstraps test assets and initial states once before execution.
    /// </summary>
    [GlobalSetup]
    public void Setup()
    {
        _templatesDirectory = Path.Combine(AppContext.BaseDirectory, "Infrastructure", "EmailTemplates");
        Directory.CreateDirectory(_templatesDirectory);

        // Seed a temporary template file specifically for micro-rendering validations
        File.WriteAllText(
            Path.Combine(_templatesDirectory, "VerificationEmail.html"),
            "Hello {{ full_name }}! Verify your account via: {{ verification_link }}"
        );

        _templateService = new EmailTemplateService();
        _queue = new BackgroundEmailQueue();

        _model = new Dictionary<string, object>
        {
            { "full_name", "Luc Benchmark User" },
            { "verification_link", "https://cverify.ai/verify?token=benchmark_token_xyz" }
        };

        _message = new EmailMessage(
            ToEmail: "bench@example.com",
            ToName: "Bench User",
            Subject: "Benchmark Test",
            HtmlContent: "<h1>Benchmark</h1>",
            PlainTextContent: "Benchmark",
            CorrelationId: "corr_bench_123",
            Category: EmailCategory.Notification,
            IdempotencyKey: null
        );
    }

    /// <summary>
    /// Cleans up test files after execution finishes.
    /// </summary>
    [GlobalCleanup]
    public void Cleanup()
    {
        if (Directory.Exists(_templatesDirectory))
        {
            try
            {
                Directory.Delete(_templatesDirectory, true);
            }
            catch
            {
                // Suppress lock release delays
            }
        }
    }

    /// <summary>
    /// Measures execution latency and memory overhead of physical Scriban template renders.
    /// </summary>
    [Benchmark]
    public async Task<string> TemplateRendering_Scriban()
    {
        return await _templateService.RenderTemplateAsync("VerificationEmail.html", _model).ConfigureAwait(false);
    }

    /// <summary>
    /// Measures processing latency of high-performance System.Threading.Channels enqueuer/dequeuer.
    /// </summary>
    [Benchmark]
    public void Queue_EnqueueAndDequeue()
    {
        _queue.QueueEmail(_message);
        _queue.TryDequeue(out _);
    }
}
