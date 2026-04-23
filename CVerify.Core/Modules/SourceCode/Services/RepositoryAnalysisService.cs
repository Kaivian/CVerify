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

        repository.LatestAnalysisStatus = "Pending";
        repository.LastUpdatedUtc = _timeProvider.GetUtcNow();

        var taskTypes = new List<string>();
        try
        {
            var configPath = Path.Combine(AppContext.BaseDirectory, "pipeline_config.json");
            if (!File.Exists(configPath)) configPath = "pipeline_config.json";
            
            if (File.Exists(configPath))
            {
                var configJson = File.ReadAllText(configPath);
                using var doc = JsonDocument.Parse(configJson);
                foreach (var element in doc.RootElement.GetProperty("stages").EnumerateArray())
                {
                    var taskType = element.GetProperty("taskType").GetString();
                    if (!string.IsNullOrEmpty(taskType))
                    {
                        taskTypes.Add(taskType);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to read pipeline_config.json in EnqueueAnalysisJobAsync.");
        }

        if (taskTypes.Count == 0)
        {
            taskTypes = new List<string> { "RepoStructure", "CommitIntelligence", "SkillExtraction", "ArchitectureAnalysis", "CodeQuality", "SecurityAnalysis", "RepositoryClassification", "RepositorySummary", "CvSynthesis" };
        }

        foreach (var tType in taskTypes)
        {
            var task = new AnalysisTask
            {
                Id = Guid.CreateVersion7(),
                JobId = jobId,
                TaskType = tType,
                Status = "Queued",
                Progress = 0.0,
                RetryCount = 0,
                CreatedAtUtc = _timeProvider.GetUtcNow(),
                LastUpdatedUtc = _timeProvider.GetUtcNow()
            };
            _context.AnalysisTasks.Add(task);
        }

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

        var tasks = await _context.AnalysisTasks
            .GroupJoin(
                _context.AnalysisTaskResults,
                task => task.Id,
                res => res.TaskId,
                (task, results) => new { task, result = results.FirstOrDefault() }
            )
            .Where(x => x.task.JobId == jobId)
            .ToListAsync();

        var orderList = new List<string>();
        try
        {
            var configPath = Path.Combine(AppContext.BaseDirectory, "pipeline_config.json");
            if (!File.Exists(configPath)) configPath = "pipeline_config.json";
            if (File.Exists(configPath))
            {
                var configJson = File.ReadAllText(configPath);
                using var doc = JsonDocument.Parse(configJson);
                foreach (var element in doc.RootElement.GetProperty("stages").EnumerateArray())
                {
                    var taskType = element.GetProperty("taskType").GetString();
                    if (!string.IsNullOrEmpty(taskType))
                    {
                        orderList.Add(taskType);
                    }
                }
            }
        }
        catch {}

        if (orderList.Count == 0)
        {
            orderList = new List<string> { "RepoStructure", "CommitIntelligence", "SkillExtraction", "ArchitectureAnalysis", "CodeQuality", "SecurityAnalysis", "RepositoryClassification", "RepositorySummary", "CvSynthesis" };
        }

        var orderedTasks = tasks.OrderBy(x => {
            var index = orderList.IndexOf(x.task.TaskType);
            return index >= 0 ? index : 99;
        }).ToList();

        var taskDtos = orderedTasks.Select(x => new AnalysisTaskDto(
            x.task.Id,
            x.task.JobId,
            x.task.TaskType,
            x.task.Status,
            x.task.Progress,
            x.task.StartedAt,
            x.task.CompletedAt,
            x.task.DurationMs,
            x.task.RetryCount,
            x.task.ErrorMessage,
            x.task.PromptTokens,
            x.task.CompletionTokens,
            x.task.EstimatedCostUsd,
            x.task.ModelName,
            x.result != null ? x.result.SchemaVersion : null,
            x.result != null ? x.result.ResultData : null,
            x.task.CreatedAtUtc
        )).ToList();

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
            job.LastUpdatedUtc,
            taskDtos
        );
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

        var repo = await _context.SourceCodeRepositories.FirstOrDefaultAsync(r => r.Id == job.RepositoryId);
        if (repo != null)
        {
            repo.LatestAnalysisStatus = "Cancelled";
            repo.LastUpdatedUtc = _timeProvider.GetUtcNow();
        }

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

        SourceCodeRepository? repo = null;
        try
        {
            // 1. Set to Preparing
            job.StartedAt = _timeProvider.GetUtcNow();
            await UpdateJobStateAsync(job, "Preparing", 10.0, "Preparing workspace...", linkedCts.Token);

            // 2. Fetch repo details
            repo = await _context.SourceCodeRepositories
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

            // 4. Load/Sort tasks to run in dependency order
            var tasks = await _context.AnalysisTasks
                .Where(t => t.JobId == jobId)
                .ToListAsync(linkedCts.Token);

            var orderList = new List<string>();
            var weights = new Dictionary<string, double>();
            double totalWeight = 0.0;
            try
            {
                var configPath = Path.Combine(AppContext.BaseDirectory, "pipeline_config.json");
                if (!File.Exists(configPath)) configPath = "pipeline_config.json";
                if (File.Exists(configPath))
                {
                    var configJson = File.ReadAllText(configPath);
                    using var doc = JsonDocument.Parse(configJson);
                    foreach (var element in doc.RootElement.GetProperty("stages").EnumerateArray())
                    {
                        var taskType = element.GetProperty("taskType").GetString()!;
                        var wt = element.GetProperty("weight").GetDouble();
                        orderList.Add(taskType);
                        weights[taskType] = wt;
                        totalWeight += wt;
                    }
                }
            }
            catch {}

            if (orderList.Count == 0)
            {
                orderList = new List<string> { "RepoStructure", "CommitIntelligence", "SkillExtraction", "ArchitectureAnalysis", "CodeQuality", "SecurityAnalysis", "RepositoryClassification", "RepositorySummary", "CvSynthesis" };
                weights["RepoStructure"] = 10.0;
                weights["CommitIntelligence"] = 20.0;
                weights["SkillExtraction"] = 15.0;
                weights["ArchitectureAnalysis"] = 15.0;
                weights["CodeQuality"] = 15.0;
                weights["SecurityAnalysis"] = 10.0;
                weights["RepositoryClassification"] = 10.0;
                weights["RepositorySummary"] = 5.0;
                weights["CvSynthesis"] = 5.0;
                totalWeight = 105.0;
            }

            tasks = tasks.OrderBy(x => {
                var index = orderList.IndexOf(x.TaskType);
                return index >= 0 ? index : 99;
            }).ToList();

            var httpClient = _httpClientFactory.CreateClient("AiServiceClient");

            // 5. Execute tasks sequentially
            foreach (var task in tasks)
            {
                if (linkedCts.Token.IsCancellationRequested) break;

                // Check if job was cancelled out-of-band
                var jobStatus = await _context.AnalysisJobs
                    .Where(j => j.Id == jobId)
                    .Select(j => j.Status)
                    .FirstOrDefaultAsync(linkedCts.Token);
                
                if (jobStatus == "Cancelled")
                {
                    throw new OperationCanceledException("Job was cancelled by the user.");
                }

                // If already completed, skip it
                if (task.Status == "Completed")
                {
                    continue;
                }

                // Map task to progress ranges based dynamically on configuration weights
                double startProgress = 10.0;
                double accumulatedProgress = 10.0;
                foreach (var t in tasks)
                {
                    if (t.TaskType == task.TaskType)
                    {
                        startProgress = accumulatedProgress;
                    }
                    var wt = weights.GetValueOrDefault(t.TaskType, 10.0);
                    var scaledWt = (wt / totalWeight) * 85.0;
                    if (t.Status == "Completed")
                    {
                        accumulatedProgress += scaledWt;
                    }
                }
                double completedProgress = startProgress + (weights.GetValueOrDefault(task.TaskType, 10.0) / totalWeight) * 85.0;

                // Update task and job to Running
                task.Status = "Running";
                task.StartedAt = _timeProvider.GetUtcNow();
                task.Progress = 10.0;
                task.LastUpdatedUtc = _timeProvider.GetUtcNow();

                job.Status = "RunningAgents";
                job.Progress = startProgress;
                job.CurrentStep = task.TaskType;
                job.LastUpdatedUtc = _timeProvider.GetUtcNow();

                await SaveTaskEventAsync(task.Id, "Info", "StepStarted", $"Started task {task.TaskType}.");
                await _context.SaveChangesAsync(linkedCts.Token);

                await PublishTaskProgressEventAsync(jobId, task.Id, task.TaskType, "Running", 10.0, "RunningAgents", startProgress, $"Executing task {task.TaskType}...");

                try
                {
                    var payload = new
                    {
                        jobId = jobId.ToString(),
                        taskType = task.TaskType,
                        repositoryId = job.RepositoryId.ToString(),
                        repoName = repo.Name,
                        repoOwner = repo.Owner,
                        encryptedToken = decryptedToken,
                        defaultBranch = repo.DefaultBranch ?? "main"
                    };
                    var payloadJson = JsonSerializer.Serialize(payload);
                    var taskPath = "/api/v1/analysis/task/execute";
                    var requestMessage = new HttpRequestMessage(HttpMethod.Post, taskPath)
                    {
                        Content = new StringContent(payloadJson, Encoding.UTF8, "application/json")
                    };

                    var (signature, timestamp, nonce) = _hmacService.CreateSignatureHeaders("POST", taskPath, payloadJson);
                    requestMessage.Headers.Add("X-Client-Id", "cverify-core");
                    requestMessage.Headers.Add("X-Timestamp", timestamp);
                    requestMessage.Headers.Add("X-Nonce", nonce);
                    requestMessage.Headers.Add("X-Correlation-Id", jobId.ToString());
                    requestMessage.Headers.Add("X-Signature", signature);

                    using var response = await httpClient.SendAsync(requestMessage, linkedCts.Token);
                    if (!response.IsSuccessStatusCode)
                    {
                        var errorResponse = await response.Content.ReadAsStringAsync(linkedCts.Token);
                        throw new HttpRequestException($"AI task service returned status code {response.StatusCode}: {errorResponse}");
                    }

                    var responseJson = await response.Content.ReadAsStringAsync(linkedCts.Token);
                    var taskResponse = JsonSerializer.Deserialize<TaskExecuteResponse>(responseJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                    if (taskResponse == null)
                    {
                        throw new InvalidOperationException("Failed to deserialize task response.");
                    }

                    if (taskResponse.Status == "Failed")
                    {
                        throw new Exception(taskResponse.ErrorMessage ?? "Task execution failed.");
                    }

                    // Save result
                    var resultData = taskResponse.ResultData ?? "{}";
                    var existingResult = await _context.AnalysisTaskResults.FirstOrDefaultAsync(r => r.TaskId == task.Id, linkedCts.Token);
                    if (existingResult != null)
                    {
                        existingResult.ResultData = resultData;
                        existingResult.SchemaVersion = taskResponse.SchemaVersion ?? "2.0.0";
                        existingResult.CreatedAtUtc = _timeProvider.GetUtcNow();
                    }
                    else
                    {
                        _context.AnalysisTaskResults.Add(new AnalysisTaskResult
                        {
                            TaskId = task.Id,
                            SchemaVersion = taskResponse.SchemaVersion ?? "2.0.0",
                            ResultData = resultData,
                            CreatedAtUtc = _timeProvider.GetUtcNow()
                        });
                    }

                    // Update task status
                    task.Status = "Completed";
                    task.Progress = 100.0;
                    task.CompletedAt = _timeProvider.GetUtcNow();
                    task.DurationMs = (long?)(task.CompletedAt - task.StartedAt)?.TotalMilliseconds;
                    
                    if (taskResponse.Telemetry != null)
                    {
                        var execution = new AnalysisExecution
                        {
                            Id = Guid.CreateVersion7(),
                            JobId = jobId,
                            TaskId = task.Id,
                            ExecutionType = "LLM_CALL",
                            Provider = taskResponse.Telemetry.Provider ?? "Anthropic",
                            Model = taskResponse.Telemetry.ModelName ?? "unknown",
                            PromptTokens = taskResponse.Telemetry.PromptTokens ?? 0,
                            CompletionTokens = taskResponse.Telemetry.CompletionTokens ?? 0,
                            TotalTokens = (taskResponse.Telemetry.PromptTokens ?? 0) + (taskResponse.Telemetry.CompletionTokens ?? 0),
                            CachedTokens = taskResponse.Telemetry.CacheReadTokens ?? 0,
                            EstimatedCostUsd = taskResponse.Telemetry.EstimatedCostUsd ?? 0m,
                            DurationMs = task.DurationMs ?? 0,
                            CreatedAtUtc = _timeProvider.GetUtcNow()
                        };
                        _context.AnalysisExecutions.Add(execution);

                        task.PromptTokens = (task.PromptTokens ?? 0) + execution.PromptTokens;
                        task.CompletionTokens = (task.CompletionTokens ?? 0) + execution.CompletionTokens;
                        task.CacheReadTokens = (task.CacheReadTokens ?? 0) + execution.CachedTokens;
                        task.CacheWriteTokens = (task.CacheWriteTokens ?? 0) + (taskResponse.Telemetry.CacheWriteTokens ?? 0);
                        task.EstimatedCostUsd = (task.EstimatedCostUsd ?? 0m) + execution.EstimatedCostUsd;
                        task.ModelName = execution.Model;
                    }

                    await SaveTaskEventAsync(task.Id, "Info", "StepCompleted", $"Completed task {task.TaskType}.");

                    if (taskResponse.Events != null)
                    {
                        foreach (var ev in taskResponse.Events)
                        {
                            DateTimeOffset.TryParse(ev.Timestamp, out var evTime);
                            _context.AnalysisTaskEvents.Add(new AnalysisTaskEvent
                            {
                                Id = Guid.CreateVersion7(),
                                TaskId = task.Id,
                                Timestamp = evTime == default ? _timeProvider.GetUtcNow() : evTime,
                                Level = ev.Level ?? "Info",
                                EventType = ev.EventType ?? "ProgressUpdate",
                                Message = ev.Message ?? "",
                                Metadata = ev.Metadata
                            });
                        }
                    }

                    job.Progress = completedProgress;
                    await _context.SaveChangesAsync(linkedCts.Token);

                    await PublishTaskProgressEventAsync(
                        jobId,
                        task.Id,
                        task.TaskType,
                        "Completed",
                        100.0,
                        "RunningAgents",
                        completedProgress,
                        $"Completed task {task.TaskType}.",
                        task.DurationMs,
                        task.PromptTokens,
                        task.CompletionTokens,
                        task.CacheReadTokens,
                        task.CacheWriteTokens,
                        task.EstimatedCostUsd,
                        task.ModelName);
                }
                catch (Exception ex)
                {
                    task.Status = "Failed";
                    task.ErrorMessage = ex.Message;
                    task.CompletedAt = _timeProvider.GetUtcNow();
                    task.DurationMs = (long?)(task.CompletedAt - task.StartedAt)?.TotalMilliseconds;

                    await SaveTaskEventAsync(task.Id, "Error", "ErrorOccurred", $"Task failed: {ex.Message}");

                    job.Status = "Failed";
                    job.ErrorMessage = $"Task {task.TaskType} failed: {ex.Message}";
                    job.CompletedAt = _timeProvider.GetUtcNow();
                    job.LastUpdatedUtc = _timeProvider.GetUtcNow();

                    await SaveEventAsync(jobId, "Failed", job.Progress, job.ErrorMessage);
                    await _context.SaveChangesAsync(CancellationToken.None);

                    await PublishTaskProgressEventAsync(
                        jobId,
                        task.Id,
                        task.TaskType,
                        "Failed",
                        0.0,
                        "Failed",
                        job.Progress,
                        job.ErrorMessage,
                        task.DurationMs);
                    throw; // Escalate to stop loop and log overall failure
                }
            }

            // 6. Aggregate Results
            await UpdateJobStateAsync(job, "AggregatingResults", 95.0, "Aggregating analysis results...", linkedCts.Token);

            var partialResultsDict = new Dictionary<string, object>();
            var results = await _context.AnalysisTaskResults
                .Where(r => r.Task.JobId == jobId)
                .ToListAsync(linkedCts.Token);

            foreach (var res in results)
            {
                try
                {
                    using var doc = JsonDocument.Parse(res.ResultData);
                    partialResultsDict[res.Task.TaskType] = doc.RootElement.Clone();
                }
                catch (JsonException ex)
                {
                    _logger.LogError(ex, "Failed to parse result data as JSON for task {TaskType} in job {JobId}", res.Task.TaskType, jobId);
                }
            }

            var aggregatePayload = new
            {
                jobId = jobId.ToString(),
                repositoryId = job.RepositoryId.ToString(),
                repoOwner = repo.Owner,
                repoName = repo.Name,
                partialResults = partialResultsDict,
                deleteWorkspace = true
            };
            var aggregatePayloadJson = JsonSerializer.Serialize(aggregatePayload);
            var aggregatePath = "/api/v1/analysis/task/aggregate";

            var aggregateMessage = new HttpRequestMessage(HttpMethod.Post, aggregatePath)
            {
                Content = new StringContent(aggregatePayloadJson, Encoding.UTF8, "application/json")
            };

            var (aggSignature, aggTimestamp, aggNonce) = _hmacService.CreateSignatureHeaders("POST", aggregatePath, aggregatePayloadJson);
            aggregateMessage.Headers.Add("X-Client-Id", "cverify-core");
            aggregateMessage.Headers.Add("X-Timestamp", aggTimestamp);
            aggregateMessage.Headers.Add("X-Nonce", aggNonce);
            aggregateMessage.Headers.Add("X-Correlation-Id", jobId.ToString());
            aggregateMessage.Headers.Add("X-Signature", aggSignature);

            using var aggregateResponse = await httpClient.SendAsync(aggregateMessage, linkedCts.Token);
            if (!aggregateResponse.IsSuccessStatusCode)
            {
                var errorResponse = await aggregateResponse.Content.ReadAsStringAsync(linkedCts.Token);
                throw new HttpRequestException($"AI aggregation service returned status code {aggregateResponse.StatusCode}: {errorResponse}");
            }

            var aggregateResponseJson = await aggregateResponse.Content.ReadAsStringAsync(linkedCts.Token);
            using var aggregateDoc = JsonDocument.Parse(aggregateResponseJson);
            var finalReportJson = aggregateDoc.RootElement.GetProperty("reportData").GetString();

            if (string.IsNullOrEmpty(finalReportJson))
            {
                throw new InvalidOperationException("Aggregation response did not contain reportData.");
            }

            // 7. Save Report
            await UpdateJobStateAsync(job, "SavingReport", 97.0, "Saving repository report...", linkedCts.Token);

            var report = new AnalysisReport
            {
                Id = Guid.CreateVersion7(),
                JobId = jobId,
                RepositoryId = job.RepositoryId,
                ReportData = finalReportJson,
                CreatedAtUtc = _timeProvider.GetUtcNow()
            };

            _context.AnalysisReports.Add(report);

            // Mark repository as verified and extract metadata based on schema version
            using var reportDoc = JsonDocument.Parse(finalReportJson);
            
            repo.LatestAnalysisStatus = "Completed";
            repo.LatestAnalysisCompletedAtUtc = _timeProvider.GetUtcNow();

            bool isV2 = reportDoc.RootElement.TryGetProperty("schemaVersion", out var schemaVersionProp) && 
                         schemaVersionProp.GetString() == "v2";

            if (isV2)
            {
                ParseV2ReportMetadata(repo, reportDoc.RootElement);
            }
            else
            {
                // Legacy parser (v1/v3)
                JsonElement confidenceProp = default;
                bool hasConfidence = false;

                if (reportDoc.RootElement.TryGetProperty("ai_conclusions", out var aiConclusionsProp) &&
                    aiConclusionsProp.TryGetProperty("trust", out var trustProp) &&
                    trustProp.TryGetProperty("confidence", out confidenceProp))
                {
                    hasConfidence = true;
                }
                else if (reportDoc.RootElement.TryGetProperty("trust", out var rootTrustProp) &&
                         rootTrustProp.TryGetProperty("confidence", out confidenceProp))
                {
                    hasConfidence = true;
                }

                if (hasConfidence)
                {
                    var confidence = confidenceProp.GetDouble();
                    repo.IsVerified = confidence >= 50.0;
                    repo.TrustScore = confidence / 100.0;
                    repo.LastSyncedAt = _timeProvider.GetUtcNow();
                }

                if (reportDoc.RootElement.TryGetProperty("ai_conclusions", out var conclusionsElement))
                {
                    if (conclusionsElement.TryGetProperty("classification", out var classificationProp) &&
                        classificationProp.TryGetProperty("primary_type", out var primaryTypeProp))
                    {
                        repo.Classification = primaryTypeProp.GetString();
                    }

                    if (conclusionsElement.TryGetProperty("authenticity", out var authenticityProp) &&
                        authenticityProp.TryGetProperty("type", out var typeProp))
                    {
                        repo.AuthenticityType = typeProp.GetString();
                    }

                    if (conclusionsElement.TryGetProperty("risk_assessment", out var riskAssessmentElement))
                    {
                        if (riskAssessmentElement.TryGetProperty("risk_score", out var scoreProp))
                        {
                            repo.LatestRiskScore = scoreProp.GetDouble();
                        }
                        if (riskAssessmentElement.TryGetProperty("risk_level", out var levelProp))
                        {
                            repo.LatestRiskLevel = levelProp.GetString() ?? "Low";
                        }
                        if (riskAssessmentElement.TryGetProperty("top_factors", out var factorsProp))
                        {
                            repo.LatestRiskFactorsJson = factorsProp.ToString();
                        }
                    }
                }
            }

            // 8. Complete Job
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

                if (repo != null)
                {
                    repo.LatestAnalysisStatus = "TimedOut";
                    repo.LastUpdatedUtc = _timeProvider.GetUtcNow();
                }

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
                if (repo != null)
                {
                    repo.LatestAnalysisStatus = "Failed";
                    repo.LastUpdatedUtc = _timeProvider.GetUtcNow();
                }

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

    public async Task<bool> RetryTaskAsync(Guid userId, Guid jobId, Guid taskId)
    {
        var job = await _context.AnalysisJobs
            .FirstOrDefaultAsync(j => j.Id == jobId && j.UserId == userId);

        if (job == null) return false;

        // Only allow retrying if the job is in a terminal state (Failed, Completed, Cancelled, TimedOut)
        var terminalStates = new[] { "Completed", "Failed", "Cancelled", "TimedOut" };
        if (!terminalStates.Contains(job.Status))
        {
            return false;
        }

        var targetTask = await _context.AnalysisTasks
            .FirstOrDefaultAsync(t => t.Id == taskId && t.JobId == jobId);

        if (targetTask == null) return false;

        // Perform dependency resetting based on target task type
        var tasksToReset = new List<AnalysisTask>();
        if (targetTask.TaskType == "RepoStructure")
        {
            // Reset ALL tasks to Queued
            tasksToReset = await _context.AnalysisTasks
                .Where(t => t.JobId == jobId)
                .ToListAsync();
        }
        else
        {
            // Reset the target task, the RepositorySummary task, and the CvSynthesis task
            tasksToReset = await _context.AnalysisTasks
                .Where(t => t.JobId == jobId && (t.Id == taskId || t.TaskType == "RepositorySummary" || t.TaskType == "CvSynthesis"))
                .ToListAsync();
        }

        var now = _timeProvider.GetUtcNow();
        foreach (var task in tasksToReset)
        {
            task.Status = "Queued";
            task.Progress = 0.0;
            task.StartedAt = null;
            task.CompletedAt = null;
            task.DurationMs = null;
            task.ErrorMessage = null;
            task.LastUpdatedUtc = now;

            if (task.Id == taskId)
            {
                task.RetryCount += 1;
            }

            // Remove existing results for the tasks being reset
            var existingResult = await _context.AnalysisTaskResults
                .FirstOrDefaultAsync(r => r.TaskId == task.Id);
            if (existingResult != null)
            {
                var archiveEvent = new AnalysisTaskEvent
                {
                    Id = Guid.CreateVersion7(),
                    TaskId = task.Id,
                    Timestamp = _timeProvider.GetUtcNow(),
                    Level = "Info",
                    EventType = "ResultVersionArchived",
                    Message = $"Archived task result data before retry. RunNumber/Retry: {task.RetryCount}.",
                    Metadata = existingResult.ResultData
                };
                _context.AnalysisTaskEvents.Add(archiveEvent);
                _context.AnalysisTaskResults.Remove(existingResult);
            }

            // Save reset event
            await SaveTaskEventAsync(task.Id, "Info", "StepStarted", $"Task reset due to retry of {targetTask.TaskType}.");
        }

        // Reset the job state so it runs again
        job.Status = "Queued";
        job.Progress = 0.0;
        job.CurrentStep = "Queued";
        job.StartedAt = null;
        job.CompletedAt = null;
        job.ErrorMessage = null;
        job.LastUpdatedUtc = now;

        var repo = await _context.SourceCodeRepositories.FirstOrDefaultAsync(r => r.Id == job.RepositoryId);
        if (repo != null)
        {
            repo.LatestAnalysisStatus = "Pending";
            repo.LastUpdatedUtc = now;
        }

        await SaveEventAsync(jobId, "Queued", 0.0, $"Retry initiated for task {targetTask.TaskType}.");
        await _context.SaveChangesAsync();

        // Broadcast to Redis
        await PublishProgressEventAsync(jobId, "Queued", "Queued", 0.0, $"Retry initiated for task {targetTask.TaskType}.");

        // Re-enqueue job
        await _queue.EnqueueJobAsync(jobId);

        return true;
    }

    public async Task<IEnumerable<AnalysisTaskEventDto>> GetTaskEventsAsync(Guid userId, Guid jobId, Guid taskId)
    {
        var taskExists = await _context.AnalysisTasks
            .AnyAsync(t => t.Id == taskId && t.JobId == jobId && t.Job.UserId == userId);

        if (!taskExists)
        {
            return Enumerable.Empty<AnalysisTaskEventDto>();
        }

        var events = await _context.AnalysisTaskEvents
            .Where(e => e.TaskId == taskId)
            .OrderBy(e => e.Timestamp)
            .Select(e => new AnalysisTaskEventDto(
                e.Id,
                e.TaskId,
                e.Timestamp,
                e.Level,
                e.EventType,
                e.Message,
                e.Metadata
            ))
            .ToListAsync();

        return events;
    }

    public async Task<string?> GetJobSnapshotAsync(Guid userId, Guid jobId)
    {
        var job = await _context.AnalysisJobs
            .FirstOrDefaultAsync(j => j.Id == jobId && j.UserId == userId);

        if (job == null) return null;

        // If completed, return the final persisted report directly
        if (job.Status == "Completed")
        {
            var report = await _context.AnalysisReports
                .Where(r => r.JobId == jobId)
                .OrderByDescending(r => r.CreatedAtUtc)
                .FirstOrDefaultAsync();
            if (report != null)
            {
                return report.ReportData;
            }
        }

        // Otherwise, fetch all completed task results for this job and aggregate them dynamically
        var completedResults = await _context.AnalysisTaskResults
            .Include(r => r.Task)
            .Where(r => r.Task.JobId == jobId && r.Task.Status == "Completed")
            .ToListAsync();

        var repo = await _context.SourceCodeRepositories
            .FirstOrDefaultAsync(r => r.Id == job.RepositoryId);

        // If RepoStructure is not completed, we cannot aggregate. Return a basic default report.
        var hasRepoStructure = completedResults.Any(r => r.Task.TaskType == "RepoStructure");
        if (!hasRepoStructure)
        {
            return GetDefaultProgressReport(job, repo);
        }

        try
        {
            var partialResultsDict = new Dictionary<string, object>();
            foreach (var res in completedResults)
            {
                try
                {
                    using var doc = JsonDocument.Parse(res.ResultData);
                    partialResultsDict[res.Task.TaskType] = doc.RootElement.Clone();
                }
                catch (JsonException)
                {
                    _logger.LogWarning("Failed to parse result data as JSON for task {TaskType} in snapshot job {JobId}", res.Task.TaskType, jobId);
                }
            }

            var aggregatePayload = new
            {
                jobId = jobId.ToString(),
                repositoryId = job.RepositoryId.ToString(),
                repoOwner = repo?.Owner ?? "",
                repoName = repo?.Name ?? "",
                partialResults = partialResultsDict,
                deleteWorkspace = false
            };

            var aggregatePayloadJson = JsonSerializer.Serialize(aggregatePayload);
            var aggregatePath = "/api/v1/analysis/task/aggregate";

            var httpClient = _httpClientFactory.CreateClient("AiServiceClient");
            var requestMessage = new HttpRequestMessage(HttpMethod.Post, aggregatePath)
            {
                Content = new StringContent(aggregatePayloadJson, Encoding.UTF8, "application/json")
            };

            var (aggSignature, aggTimestamp, aggNonce) = _hmacService.CreateSignatureHeaders("POST", aggregatePath, aggregatePayloadJson);
            requestMessage.Headers.Add("X-Client-Id", "cverify-core");
            requestMessage.Headers.Add("X-Timestamp", aggTimestamp);
            requestMessage.Headers.Add("X-Nonce", aggNonce);
            requestMessage.Headers.Add("X-Correlation-Id", jobId.ToString());
            requestMessage.Headers.Add("X-Signature", aggSignature);

            using var aggregateResponse = await httpClient.SendAsync(requestMessage);
            if (!aggregateResponse.IsSuccessStatusCode)
            {
                var errorResponse = await aggregateResponse.Content.ReadAsStringAsync();
                _logger.LogWarning("AI aggregation service returned status code {StatusCode} during snapshot for job {JobId}: {ErrorResponse}. Falling back to default progress report.", 
                    aggregateResponse.StatusCode, jobId, errorResponse);
                return GetDefaultProgressReport(job, repo);
            }

            var aggregateResponseJson = await aggregateResponse.Content.ReadAsStringAsync();
            using var aggregateDoc = JsonDocument.Parse(aggregateResponseJson);
            var reportData = aggregateDoc.RootElement.GetProperty("reportData").GetString();
            return reportData;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error aggregating dynamic snapshot for job {JobId}. Falling back to default progress report.", jobId);
            return GetDefaultProgressReport(job, repo);
        }
    }

    private string GetDefaultProgressReport(AnalysisJob job, SourceCodeRepository? repo)
    {
        var defaultReport = new
        {
            schemaVersion = "evidence-intelligence-v2",
            facts = new
            {
                repo = new
                {
                    id = job.RepositoryId.ToString(),
                    name = repo?.Name ?? "",
                    full_name = repo != null ? $"{repo.Owner}/{repo.Name}" : "",
                    url = repo != null ? $"https://github.com/{repo.Owner}/{repo.Name}" : "",
                    description = (string?)null,
                    fork = false,
                    languages = new Dictionary<string, double>()
                },
                git_metrics = new
                {
                    total_commits = 0,
                    user_commit_ratio = 0.0,
                    is_primary_author = false,
                    bus_factor = 0,
                    active_contributors = 0,
                    contributor_distribution = Array.Empty<object>()
                },
                quality_metrics = new
                {
                    files_scanned = 0,
                    files_sampled = 0,
                    skipped_files = 0,
                    coverage_pct = 0.0,
                    prompt_cache_efficiency = 0.0
                }
            },
            ai_conclusions = new
            {
                classification = new
                {
                    primary_type = "Unclassified",
                    all_types = Array.Empty<string>(),
                    complexity = "low",
                    benchmark_group = "unclassified",
                    classification_rationale = "Analysis is in progress...",
                    sampled_files = Array.Empty<string>(),
                    ignored_files_count = 0,
                    confidence_factors = Array.Empty<string>()
                },
                evidence_points = new
                {
                    total = 0,
                    breakdown = new Dictionary<string, int>()
                },
                trust = new
                {
                    classification = "unclassified",
                    confidence = 0.0,
                    rule_flags = Array.Empty<string>(),
                    ai_findings = Array.Empty<string>(),
                    explanation = "Analysis is in progress..."
                },
                positioning = new
                {
                    benchmark_group = "unclassified",
                    percentile_rank = 0,
                    peer_group_size = 0,
                    relative_strengths = Array.Empty<string>()
                },
                profile = new
                {
                    technologies = Array.Empty<object>(),
                    skills = new Dictionary<string, List<string>>(),
                    architecture = new
                    {
                        patterns = Array.Empty<string>(),
                        explanation = "Analysis is in progress..."
                    },
                    engineering_practices = new
                    {
                        testing = new { frameworks = Array.Empty<string>(), has_tests = false, detail = "" },
                        observability = new { logging_configured = false, metrics_configured = false, detail = "" },
                        cicd = new { configured = false, providers = Array.Empty<string>() }
                    }
                },
                findings = Array.Empty<object>(),
                narrative = new
                {
                    recruiter_summary = "Repository analysis is in progress. Check back soon for results.",
                    top_strengths = Array.Empty<object>(),
                    limitations = Array.Empty<object>()
                }
            }
        };
        return JsonSerializer.Serialize(defaultReport);
    }

    private async Task SaveTaskEventAsync(Guid taskId, string level, string eventType, string message, string? metadata = null)
    {
        var ev = new AnalysisTaskEvent
        {
            Id = Guid.CreateVersion7(),
            TaskId = taskId,
            Timestamp = _timeProvider.GetUtcNow(),
            Level = level,
            EventType = eventType,
            Message = message,
            Metadata = metadata
        };
        _context.AnalysisTaskEvents.Add(ev);
    }

    private async Task PublishTaskProgressEventAsync(
        Guid jobId, 
        Guid taskId, 
        string taskType, 
        string taskStatus, 
        double taskProgress, 
        string jobStatus, 
        double jobProgress, 
        string message,
        long? durationMs = null,
        int? promptTokens = null,
        int? completionTokens = null,
        int? cacheReadTokens = null,
        int? cacheWriteTokens = null,
        decimal? estimatedCostUsd = null,
        string? modelName = null)
    {
        try
        {
            var eventPayload = new
            {
                jobId = jobId,
                taskId = taskId,
                taskType = taskType,
                taskStatus = taskStatus,
                taskProgress = taskProgress,
                status = jobStatus,
                step = taskType,
                progress = jobProgress,
                message = message,
                timestamp = _timeProvider.GetUtcNow().ToString("o"),
                taskDurationMs = durationMs,
                promptTokens = promptTokens,
                completionTokens = completionTokens,
                cacheReadTokens = cacheReadTokens,
                cacheWriteTokens = cacheWriteTokens,
                estimatedCostUsd = (double?)estimatedCostUsd,
                modelName = modelName
            };
            var json = JsonSerializer.Serialize(eventPayload);

            var sub = _redis.GetSubscriber();
            await sub.PublishAsync($"repository:analysis:progress:{jobId}", json);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to publish task progress event to Redis Pub/Sub for job {JobId}", jobId);
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

    private void ParseV2ReportMetadata(SourceCodeRepository repo, JsonElement root)
    {
        if (root.TryGetProperty("classification", out var classificationProp))
        {
            if (classificationProp.TryGetProperty("isVerified", out var isVerifiedProp))
            {
                repo.IsVerified = isVerifiedProp.GetBoolean();
            }
            if (classificationProp.TryGetProperty("trustScore", out var trustScoreProp))
            {
                repo.TrustScore = trustScoreProp.GetDouble();
            }
            if (classificationProp.TryGetProperty("primaryDomain", out var primaryDomainProp))
            {
                repo.Classification = primaryDomainProp.GetString();
            }
        }

        if (root.TryGetProperty("risk", out var riskProp))
        {
            if (riskProp.TryGetProperty("score", out var scoreProp))
            {
                repo.LatestRiskScore = scoreProp.GetDouble();
            }
            if (riskProp.TryGetProperty("level", out var levelProp))
            {
                var levelStr = levelProp.GetString();
                if (!string.IsNullOrEmpty(levelStr))
                {
                    repo.LatestRiskLevel = char.ToUpper(levelStr[0]) + levelStr.Substring(1);
                }
            }
            if (riskProp.TryGetProperty("reasons", out var reasonsProp))
            {
                repo.LatestRiskFactorsJson = reasonsProp.ToString();
            }
        }
        repo.LastSyncedAt = _timeProvider.GetUtcNow();
    }

    private class TaskExecuteResponse
    {
        public string Status { get; set; } = null!;
        public string? ErrorMessage { get; set; }
        public string? SchemaVersion { get; set; }
        public string? ResultData { get; set; }
        public TaskTelemetry? Telemetry { get; set; }
        public List<TaskEvent>? Events { get; set; }
    }

    private class TaskTelemetry
    {
        public int? PromptTokens { get; set; }
        public int? CompletionTokens { get; set; }
        public int? CacheReadTokens { get; set; }
        public int? CacheWriteTokens { get; set; }
        public decimal? EstimatedCostUsd { get; set; }
        public string? ModelName { get; set; }
        public string? Provider { get; set; }
    }

    private class TaskEvent
    {
        public string Timestamp { get; set; } = null!;
        public string? Level { get; set; }
        public string? EventType { get; set; }
        public string Message { get; set; } = null!;
        public string? Metadata { get; set; }
    }
}
