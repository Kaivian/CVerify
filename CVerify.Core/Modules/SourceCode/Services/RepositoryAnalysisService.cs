using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Security;
using CVerify.API.Modules.Shared.System.Services;
using CVerify.API.Modules.SourceCode.DTOs;
using CVerify.API.Modules.SourceCode.Entities;

namespace CVerify.API.Modules.SourceCode.Services;

public class RepositoryAnalysisService : IRepositoryAnalysisService
{
    private readonly ApplicationDbContext _context;
    private readonly IRepositoryAnalysisQueue _queue;
    private readonly IConnectionMultiplexer _redis;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IHmacSignatureService _hmacService;
    private readonly EnvConfiguration _envConfig;
    private readonly ILogger<RepositoryAnalysisService> _logger;
    private readonly TimeProvider _timeProvider;

    public RepositoryAnalysisService(
        ApplicationDbContext context,
        IRepositoryAnalysisQueue queue,
        IConnectionMultiplexer redis,
        IHttpClientFactory httpClientFactory,
        IHmacSignatureService hmacService,
        EnvConfiguration envConfig,
        ILogger<RepositoryAnalysisService> logger,
        TimeProvider timeProvider)
    {
        _context = context;
        _queue = queue;
        _redis = redis;
        _httpClientFactory = httpClientFactory;
        _hmacService = hmacService;
        _envConfig = envConfig;
        _logger = logger;
        _timeProvider = timeProvider;
    }

    public async Task<Guid> EnqueueAnalysisJobAsync(Guid userId, Guid repositoryId)
    {
        // 1. Verify repository exists and belongs to the user
        var repository = await _context.SourceCodeRepositories
            .Include(r => r.AuthProvider)
            .FirstOrDefaultAsync(r => r.Id == repositoryId && r.AuthProvider.UserId == userId && r.AuthProvider.DeletedAt == null);

        if (repository == null)
        {
            throw new KeyNotFoundException("Repository not found or access denied.");
        }

        // 2. Check for active analyses to prevent duplicates
        var activeJob = await _context.AnalysisJobs
            .FirstOrDefaultAsync(j => j.RepositoryId == repositoryId && 
                                      (j.Status == "Queued" || j.Status == "Preparing" || j.Status == "CloningRepository" ||
                                       j.Status == "DetectingTechnologyStack" || j.Status == "SamplingCode" || 
                                       j.Status == "RunningAgents" || j.Status == "AggregatingResults" || j.Status == "SavingReport"));

        if (activeJob != null)
        {
            return activeJob.Id;
        }

        // 3. Enforce maximum active analyses per user (Limit: 2)
        var activeUserJobsCount = await _context.AnalysisJobs
            .CountAsync(j => j.UserId == userId && 
                             (j.Status == "Queued" || j.Status == "Preparing" || j.Status == "CloningRepository" ||
                              j.Status == "DetectingTechnologyStack" || j.Status == "SamplingCode" || 
                              j.Status == "RunningAgents" || j.Status == "AggregatingResults" || j.Status == "SavingReport"));

        if (activeUserJobsCount >= 2)
        {
            throw new InvalidOperationException("User active analysis jobs limit exceeded.");
        }

        // 4. Create and persist Job
        var jobId = Guid.CreateVersion7();
        var job = new AnalysisJob
        {
            Id = jobId,
            RepositoryId = repositoryId,
            UserId = userId,
            Status = "Queued",
            Progress = 0.0,
            CurrentStep = "Queued",
            CreatedAtUtc = _timeProvider.GetUtcNow(),
            LastUpdatedUtc = _timeProvider.GetUtcNow()
        };

        _context.AnalysisJobs.Add(job);
        await _context.SaveChangesAsync();

        // 5. Enqueue Job ID
        await _queue.EnqueueJobAsync(jobId);

        return jobId;
    }

    public async Task<AnalysisJobDto?> GetJobStatusAsync(Guid userId, Guid jobId)
    {
        var job = await _context.AnalysisJobs
            .FirstOrDefaultAsync(j => j.Id == jobId && j.UserId == userId);

        if (job == null) return null;

        return MapToDto(job);
    }

    public async Task<IEnumerable<AnalysisJobEventDto>> GetJobEventsAsync(Guid userId, Guid jobId)
    {
        var jobExists = await _context.AnalysisJobs
            .AnyAsync(j => j.Id == jobId && j.UserId == userId);

        if (!jobExists)
        {
            return Enumerable.Empty<AnalysisJobEventDto>();
        }

        var events = await _context.AnalysisJobEvents
            .Where(e => e.JobId == jobId)
            .OrderBy(e => e.CreatedAtUtc)
            .Select(e => new AnalysisJobEventDto(
                e.Id,
                e.JobId,
                e.Step,
                e.Progress,
                e.Message,
                e.CreatedAtUtc
            ))
            .ToListAsync();

        return events;
    }

    public async Task<string?> GetLatestReportAsync(Guid userId, Guid repositoryId)
    {
        var repository = await _context.SourceCodeRepositories
            .Include(r => r.AuthProvider)
            .FirstOrDefaultAsync(r => r.Id == repositoryId && r.AuthProvider.UserId == userId && r.AuthProvider.DeletedAt == null);

        if (repository == null)
        {
            throw new KeyNotFoundException("Repository not found or access denied.");
        }

        var report = await _context.AnalysisReports
            .Where(r => r.RepositoryId == repositoryId)
            .OrderByDescending(r => r.CreatedAtUtc)
            .FirstOrDefaultAsync();

        return report?.ReportData;
    }

    public async Task<bool> CancelJobAsync(Guid userId, Guid jobId)
    {
        var job = await _context.AnalysisJobs
            .FirstOrDefaultAsync(j => j.Id == jobId && j.UserId == userId);

        if (job == null) return false;

        var activeStates = new[] { "Queued", "Preparing", "CloningRepository", "DetectingTechnologyStack", "SamplingCode", "RunningAgents", "AggregatingResults", "SavingReport" };
        if (!activeStates.Contains(job.Status))
        {
            return false;
        }

        job.Status = "Cancelled";
        job.CompletedAt = _timeProvider.GetUtcNow();
        job.LastUpdatedUtc = _timeProvider.GetUtcNow();

        await SaveEventAsync(jobId, "Cancelled", job.Progress, "Analysis cancelled by user.");
        await _context.SaveChangesAsync();

        // Broadcast to Redis Pub/Sub to notify listening SSE connections
        await PublishProgressEventAsync(jobId, "Cancelled", "Cancelled", job.Progress, "Analysis cancelled by user.");

        return true;
    }

    public async Task ExecuteAnalysisJobAsync(Guid jobId, CancellationToken cancellationToken)
    {
        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        linkedCts.CancelAfter(TimeSpan.FromMinutes(10)); // Max 10 mins timeout

        var job = await _context.AnalysisJobs.FirstOrDefaultAsync(j => j.Id == jobId);
        if (job == null) return;

        // Verify if job was already cancelled/aborted before starting
        if (job.Status == "Cancelled") return;

        try
        {
            // 1. Set to Preparing
            await UpdateJobStateAsync(job, "Preparing", 10.0, "Preparing workspace...", linkedCts.Token);

            // 2. Fetch repo details
            var repo = await _context.SourceCodeRepositories
                .Include(r => r.AuthProvider)
                .ThenInclude(ap => ap.OAuthCredential)
                .FirstOrDefaultAsync(r => r.Id == job.RepositoryId, linkedCts.Token);

            if (repo == null)
            {
                throw new KeyNotFoundException("Source repository record was not found.");
            }

            // 3. Resolve OAuth access token
            var credential = repo.AuthProvider.OAuthCredential;
            if (credential == null)
            {
                credential = await _context.OAuthCredentials
                    .FirstOrDefaultAsync(oc => oc.AuthProviderId == repo.AuthProviderId, linkedCts.Token);
            }

            if (credential == null)
            {
                throw new InvalidOperationException("OAuth connection credentials are missing.");
            }

            if (string.IsNullOrEmpty(_envConfig.Security.TokenEncryptionKey))
            {
                throw new InvalidOperationException("Token encryption key is not configured on server.");
            }

            var decryptedToken = EncryptionHelper.Decrypt(credential.EncryptedAccessToken, _envConfig.Security.TokenEncryptionKey);

            // 4. Update status to Cloning
            await UpdateJobStateAsync(job, "CloningRepository", 20.0, $"Cloning branch '{repo.DefaultBranch ?? "main"}'...", linkedCts.Token);

            // 5. Connect to Python FastAPI microservice using HttpClient
            var httpClient = _httpClientFactory.CreateClient("AiServiceClient");
            var payload = new
            {
                repositoryId = job.RepositoryId,
                repoName = repo.Name,
                repoOwner = repo.Owner,
                encryptedToken = decryptedToken,
                defaultBranch = repo.DefaultBranch ?? "main"
            };
            var payloadJson = JsonSerializer.Serialize(payload);
            var requestPath = "/api/v1/analysis/orchestrate/stream";

            var requestMessage = new HttpRequestMessage(HttpMethod.Post, requestPath)
            {
                Content = new StringContent(payloadJson, Encoding.UTF8, "application/json")
            };

            // Sign payload with HMAC
            var (signature, timestamp, nonce) = _hmacService.CreateSignatureHeaders("POST", requestPath, payloadJson);
            requestMessage.Headers.Add("X-Client-Id", "cverify-core");
            requestMessage.Headers.Add("X-Timestamp", timestamp);
            requestMessage.Headers.Add("X-Nonce", nonce);
            requestMessage.Headers.Add("X-Correlation-Id", jobId.ToString());
            requestMessage.Headers.Add("X-Signature", signature);

            using var response = await httpClient.SendAsync(requestMessage, HttpCompletionOption.ResponseHeadersRead, linkedCts.Token);
            if (!response.IsSuccessStatusCode)
            {
                var errorResponse = await response.Content.ReadAsStringAsync(linkedCts.Token);
                throw new HttpRequestException($"AI service returned status code {response.StatusCode}: {errorResponse}");
            }

            // Read SSE response stream
            using var responseStream = await response.Content.ReadAsStreamAsync(linkedCts.Token);
            using var reader = new StreamReader(responseStream);

            string? finalReportJson = null;
            string? line;

            while ((line = await reader.ReadLineAsync(linkedCts.Token)) != null)
            {
                if (string.IsNullOrWhiteSpace(line)) continue;

                if (line.StartsWith("data: "))
                {
                    var dataStr = line.Substring(6).Trim();
                    if (dataStr == "[DONE]") break;

                    try
                    {
                        using var jsonDoc = JsonDocument.Parse(dataStr);
                        var root = jsonDoc.RootElement;

                        // Check if it's the final completed report payload
                        if (root.TryGetProperty("reportData", out var reportProp))
                        {
                            finalReportJson = reportProp.ToString();
                        }
                        // Otherwise, parse it as a progress event
                        else if (root.TryGetProperty("status", out var statusProp))
                        {
                            var sseStatus = statusProp.GetString() ?? "RunningAgents";
                            var sseStep = root.TryGetProperty("step", out var stepProp) ? stepProp.GetString() : sseStatus;
                            var sseProgress = root.TryGetProperty("progress", out var progProp) ? progProp.GetDouble() : job.Progress;
                            var sseMessage = root.TryGetProperty("message", out var msgProp) ? msgProp.GetString() : string.Empty;

                            await UpdateJobStateAsync(job, sseStatus, sseProgress, sseMessage ?? sseStep ?? string.Empty, linkedCts.Token);
                        }
                    }
                    catch (JsonException ex)
                    {
                        _logger.LogError(ex, "Failed to parse SSE event chunk from AI microservice: {Chunk}", dataStr);
                    }
                }
            }

            if (string.IsNullOrEmpty(finalReportJson))
            {
                if (job.Status == "Failed")
                {
                    throw new InvalidOperationException(job.ErrorMessage ?? "AI microservice analysis failed.");
                }
                throw new InvalidOperationException("AI microservice stream ended without returning final report data.");
            }

            // 6. Save Report
            await UpdateJobStateAsync(job, "SavingReport", 95.0, "Saving repository report...", linkedCts.Token);

            var report = new AnalysisReport
            {
                Id = Guid.CreateVersion7(),
                JobId = jobId,
                RepositoryId = job.RepositoryId,
                ReportData = finalReportJson,
                CreatedAtUtc = _timeProvider.GetUtcNow()
            };

            _context.AnalysisReports.Add(report);
            
            // Mark repository as verified based on score in final report
            using var reportDoc = JsonDocument.Parse(finalReportJson);
            if (reportDoc.RootElement.TryGetProperty("scoring", out var scoringProp) && 
                scoringProp.TryGetProperty("final_score", out var finalScoreProp))
            {
                var finalScore = finalScoreProp.GetDouble();
                repo.IsVerified = finalScore >= 50.0;
                repo.TrustScore = finalScore / 100.0;
                repo.LastSyncedAt = _timeProvider.GetUtcNow();
            }

            // 7. Complete Job
            job.Status = "Completed";
            job.Progress = 100.0;
            job.CurrentStep = "Completed";
            job.CompletedAt = _timeProvider.GetUtcNow();
            job.LastUpdatedUtc = _timeProvider.GetUtcNow();

            await SaveEventAsync(jobId, "Completed", 100.0, "Analysis completed successfully.");
            await _context.SaveChangesAsync(CancellationToken.None);

            await PublishProgressEventAsync(jobId, "Completed", "Completed", 100.0, "Analysis completed successfully.");
        }
        catch (OperationCanceledException) when (linkedCts.Token.IsCancellationRequested)
        {
            _logger.LogWarning("Repository analysis job {JobId} timed out or was cancelled.", jobId);
            
            // Re-fetch job status to verify if it was manually cancelled
            var freshJob = await _context.AnalysisJobs.FirstOrDefaultAsync(j => j.Id == jobId);
            if (freshJob != null && freshJob.Status != "Cancelled")
            {
                freshJob.Status = "TimedOut";
                freshJob.CompletedAt = _timeProvider.GetUtcNow();
                freshJob.LastUpdatedUtc = _timeProvider.GetUtcNow();
                freshJob.ErrorMessage = "The analysis exceeded the maximum execution timeout of 10 minutes.";

                await SaveEventAsync(jobId, "TimedOut", freshJob.Progress, freshJob.ErrorMessage);
                await _context.SaveChangesAsync(CancellationToken.None);

                await PublishProgressEventAsync(jobId, "TimedOut", "TimedOut", freshJob.Progress, freshJob.ErrorMessage);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to run analysis job {JobId}", jobId);

            // Re-fetch job status to verify if it was manually cancelled during execution
            var freshJob = await _context.AnalysisJobs.FirstOrDefaultAsync(j => j.Id == jobId);
            if (freshJob != null && freshJob.Status != "Cancelled")
            {
                if (freshJob.Status != "Failed")
                {
                    freshJob.Status = "Failed";
                    freshJob.CompletedAt = _timeProvider.GetUtcNow();
                    freshJob.LastUpdatedUtc = _timeProvider.GetUtcNow();
                    freshJob.ErrorMessage = ex.Message;

                    await SaveEventAsync(jobId, "Failed", freshJob.Progress, ex.Message);
                    await _context.SaveChangesAsync(CancellationToken.None);

                    await PublishProgressEventAsync(jobId, "Failed", "Failed", freshJob.Progress, ex.Message);
                }
                else if (string.IsNullOrEmpty(freshJob.ErrorMessage))
                {
                    freshJob.ErrorMessage = ex.Message;
                    freshJob.CompletedAt = _timeProvider.GetUtcNow();
                    freshJob.LastUpdatedUtc = _timeProvider.GetUtcNow();
                    await _context.SaveChangesAsync(CancellationToken.None);
                }
            }
        }
    }

    private async Task UpdateJobStateAsync(AnalysisJob job, string status, double progress, string message, CancellationToken cancellationToken)
    {
        // Check if job was cancelled out-of-band before updating
        var currentStatus = await _context.AnalysisJobs
            .Where(j => j.Id == job.Id)
            .Select(j => j.Status)
            .FirstOrDefaultAsync(cancellationToken);

        if (currentStatus == "Cancelled")
        {
            throw new OperationCanceledException("Job was cancelled by the user.");
        }

        job.Status = status;
        job.Progress = progress;
        job.CurrentStep = status;
        job.LastUpdatedUtc = _timeProvider.GetUtcNow();
        if (status == "Failed")
        {
            job.ErrorMessage = message;
            job.CompletedAt = _timeProvider.GetUtcNow();
        }

        await SaveEventAsync(job.Id, status, progress, message);
        await _context.SaveChangesAsync(cancellationToken);

        await PublishProgressEventAsync(job.Id, status, status, progress, message);
    }

    private async Task SaveEventAsync(Guid jobId, string step, double progress, string message)
    {
        var ev = new AnalysisJobEvent
        {
            Id = Guid.CreateVersion7(),
            JobId = jobId,
            Step = step,
            Progress = progress,
            Message = message,
            CreatedAtUtc = _timeProvider.GetUtcNow()
        };

        _context.AnalysisJobEvents.Add(ev);
    }

    private async Task PublishProgressEventAsync(Guid jobId, string status, string step, double progress, string message)
    {
        try
        {
            var eventPayload = new
            {
                jobId = jobId,
                status = status,
                step = step,
                progress = progress,
                message = message,
                timestamp = _timeProvider.GetUtcNow().ToString("o")
            };
            var json = JsonSerializer.Serialize(eventPayload);

            var sub = _redis.GetSubscriber();
            await sub.PublishAsync($"repository:analysis:progress:{jobId}", json);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to publish progress event to Redis Pub/Sub for job {JobId}", jobId);
        }
    }

    private static AnalysisJobDto MapToDto(AnalysisJob job)
    {
        return new AnalysisJobDto(
            job.Id,
            job.RepositoryId,
            job.UserId,
            job.Status,
            job.Progress,
            job.CurrentStep,
            job.CommitSha,
            job.StartedAt,
            job.CompletedAt,
            job.ErrorMessage,
            job.CreatedAtUtc,
            job.LastUpdatedUtc
        );
    }
}
