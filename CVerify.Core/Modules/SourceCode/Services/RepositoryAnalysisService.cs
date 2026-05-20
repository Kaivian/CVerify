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
using CVerify.API.Pipelines.Shared.Storage;
using CVerify.API.Modules.Profiles.Entities;

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
    private readonly IArtifactStorageProvider _storageProvider;

    public RepositoryAnalysisService(
        ApplicationDbContext context,
        IRepositoryAnalysisQueue queue,
        IConnectionMultiplexer redis,
        IHttpClientFactory httpClientFactory,
        IHmacSignatureService hmacService,
        EnvConfiguration envConfig,
        ILogger<RepositoryAnalysisService> logger,
        TimeProvider timeProvider,
        IArtifactStorageProvider storageProvider)
    {
        _context = context;
        _queue = queue;
        _redis = redis;
        _httpClientFactory = httpClientFactory;
        _hmacService = hmacService;
        _envConfig = envConfig;
        _logger = logger;
        _timeProvider = timeProvider;
        _storageProvider = storageProvider;
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
                .FirstOrDefaultAsync(r => r.Id == job.RepositoryId, linkedCts.Token);

            if (repo == null)
            {
                throw new KeyNotFoundException("Source repository record was not found.");
            }

            // 3. Resolve OAuth access token
            if (string.IsNullOrEmpty(repo.AuthProvider.EncryptedAccessToken))
            {
                throw new InvalidOperationException("OAuth connection credentials are missing.");
            }

            if (string.IsNullOrEmpty(_envConfig.Security.TokenEncryptionKey))
            {
                throw new InvalidOperationException("Token encryption key is not configured on server.");
            }

            var decryptedToken = EncryptionHelper.Decrypt(repo.AuthProvider.EncryptedAccessToken, _envConfig.Security.TokenEncryptionKey);

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
                // Reset/initialize task-level cost/token counters before executing to prevent double counting
                task.PromptTokens = 0;
                task.CompletionTokens = 0;
                task.CacheReadTokens = 0;
                task.CacheWriteTokens = 0;
                task.EstimatedCostUsd = 0m;
                task.ModelName = null;

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

                int maxAttempts = 3;
                int attempt = 0;
                bool isTaskSuccessful = false;
                TaskExecuteResponse? taskResponse = null;

                while (attempt < maxAttempts && !isTaskSuccessful)
                {
                    attempt++;
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
                        taskResponse = JsonSerializer.Deserialize<TaskExecuteResponse>(responseJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                        if (taskResponse == null)
                        {
                            throw new InvalidOperationException("Failed to deserialize task response.");
                        }

                        if (taskResponse.Status == "Failed")
                        {
                            // Save telemetry if present, even on failure
                            if (taskResponse.Telemetry != null)
                            {
                                var telemetry = taskResponse.Telemetry;
                                var durationMs = (long?)(_timeProvider.GetUtcNow() - task.StartedAt)?.TotalMilliseconds ?? 0;
                                await RecordExecutionAndAggregateTaskTokensAsync(jobId, job.UserId, task, telemetry, durationMs, linkedCts.Token);
                            }

                            // Determine if error is retryable
                            bool retryable = taskResponse.Retryable ?? ClassifyError(taskResponse.ErrorMessage, null).Retryable;
                            if (retryable && attempt < maxAttempts)
                            {
                                int delayMs = attempt == 1 ? 500 : attempt == 2 ? 1000 : 2000;
                                _logger.LogWarning("Task {TaskType} failed on attempt {Attempt}. Retrying in {DelayMs}ms. Error: {Error}", 
                                    task.TaskType, attempt, delayMs, taskResponse.ErrorMessage);
                                await Task.Delay(delayMs, linkedCts.Token);
                                continue;
                            }

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

                        // Upload to IArtifactStorageProvider and register entry
                        await SaveAndRegisterArtifactAsync(jobId, task.TaskType, resultData, linkedCts.Token);

                        // Update task status
                        task.Status = "Completed";
                        task.Progress = 100.0;
                        task.CompletedAt = _timeProvider.GetUtcNow();
                        task.DurationMs = (long?)(task.CompletedAt - task.StartedAt)?.TotalMilliseconds;

                        if (taskResponse.Telemetry != null)
                        {
                            var telemetry = taskResponse.Telemetry;
                            await RecordExecutionAndAggregateTaskTokensAsync(jobId, job.UserId, task, telemetry, task.DurationMs ?? 0, linkedCts.Token);
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

                        isTaskSuccessful = true;
                    }
                    catch (Exception ex)
                    {
                        var (errCode, retryable) = ClassifyError(null, ex);
                        
                        // Check if we can retry
                        if (retryable && attempt < maxAttempts)
                        {
                            int delayMs = attempt == 1 ? 500 : attempt == 2 ? 1000 : 2000;
                            _logger.LogWarning(ex, "Transient exception executing task {TaskType} on attempt {Attempt}. Retrying in {DelayMs}ms.", 
                                task.TaskType, attempt, delayMs);
                            await Task.Delay(delayMs, linkedCts.Token);
                            continue;
                        }

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

                        var finalErr = taskResponse?.ErrorCode ?? errCode;
                        var finalRetryable = taskResponse?.Retryable ?? retryable;

                        await PublishTaskProgressEventAsync(
                            jobId,
                            task.Id,
                            task.TaskType,
                            "Failed",
                            0.0,
                            "Failed",
                            job.Progress,
                            job.ErrorMessage,
                            task.DurationMs,
                            task.PromptTokens,
                            task.CompletionTokens,
                            task.CacheReadTokens,
                            task.CacheWriteTokens,
                            task.EstimatedCostUsd,
                            task.ModelName,
                            finalErr,
                            finalRetryable);
                        throw;
                    }
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

            // Upload report to IArtifactStorageProvider and register entry
            await SaveAndRegisterArtifactAsync(jobId, "RepoIntelligenceReport", finalReportJson, linkedCts.Token);

            // Project aggregated outputs to PostgreSQL relational tables
            await ProjectIntelligenceDataAsync(jobId, job.CommitSha ?? "unknown", finalReportJson, repo, results, linkedCts.Token);

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
                    await PublishProgressEventAsync(jobId, "Failed", "Failed", freshJob.Progress, ex.Message);
                }
                else if (string.IsNullOrEmpty(freshJob.ErrorMessage))
                {
                    freshJob.ErrorMessage = ex.Message;
                    freshJob.CompletedAt = _timeProvider.GetUtcNow();
                    freshJob.LastUpdatedUtc = _timeProvider.GetUtcNow();
                }

                // Always save changes to persist repo and job status updates
                await _context.SaveChangesAsync(CancellationToken.None);
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

            // Reset token/cost counters to prevent duplicate count mismatch
            task.PromptTokens = null;
            task.CompletionTokens = null;
            task.CacheReadTokens = null;
            task.CacheWriteTokens = null;
            task.EstimatedCostUsd = null;
            task.ModelName = null;

            if (task.Id == taskId)
            {
                task.RetryCount += 1;
            }

            // Remove existing executions for the tasks being reset
            var executions = await _context.AnalysisExecutions
                .Where(e => e.TaskId == task.Id)
                .ToListAsync();
            if (executions.Any())
            {
                _context.AnalysisExecutions.RemoveRange(executions);
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

    private string? AddDebugFlagToMetadata(string? existingMetadata, string flagKey, bool value)
    {
        try
        {
            var dict = string.IsNullOrEmpty(existingMetadata) 
                ? new Dictionary<string, object>() 
                : JsonSerializer.Deserialize<Dictionary<string, object>>(existingMetadata) ?? new Dictionary<string, object>();
            dict[flagKey] = value;
            return JsonSerializer.Serialize(dict);
        }
        catch
        {
            return existingMetadata;
        }
    }

    private async Task RecordExecutionAndAggregateTaskTokensAsync(
        Guid jobId,
        Guid userId,
        AnalysisTask task,
        TaskTelemetry telemetry,
        long durationMs,
        CancellationToken cancellationToken)
    {
        var execution = new AnalysisExecution
        {
            Id = Guid.CreateVersion7(),
            JobId = jobId,
            TaskId = task.Id,
            UserId = userId,
            ExecutionType = "LLM_CALL",
            Provider = telemetry.Provider ?? "Anthropic",
            Model = telemetry.ModelName ?? "unknown",
            PromptTokens = telemetry.PromptTokens ?? 0,
            CompletionTokens = telemetry.CompletionTokens ?? 0,
            TotalTokens = telemetry.TotalTokens ?? ((telemetry.PromptTokens ?? 0) + (telemetry.CompletionTokens ?? 0)),
            CachedTokens = telemetry.CacheReadTokens ?? 0,
            EstimatedCostUsd = telemetry.EstimatedCostUsd ?? 0m,
            DurationMs = durationMs,
            CreatedAtUtc = _timeProvider.GetUtcNow()
        };

        // Enforce validation consistency check
        int promptTokens = execution.PromptTokens;
        int completionTokens = execution.CompletionTokens;
        int totalTokens = execution.TotalTokens;
        if (promptTokens + completionTokens != totalTokens)
        {
            _logger.LogWarning("Token usage mismatch detected: PromptTokens ({Prompt}) + CompletionTokens ({Completion}) != TotalTokens ({Total}). Flagging for debugging.", 
                promptTokens, completionTokens, totalTokens);
            task.Metadata = AddDebugFlagToMetadata(task.Metadata, "token_mismatch_detected", true);
        }

        _context.AnalysisExecutions.Add(execution);

        // Fetch all executions for this task to compute aggregate tokens and costs
        var taskExecutions = await _context.AnalysisExecutions
            .Where(e => e.TaskId == task.Id)
            .ToListAsync(cancellationToken);

        if (!taskExecutions.Any(e => e.Id == execution.Id))
        {
            taskExecutions.Add(execution);
        }

        task.PromptTokens = taskExecutions.Sum(e => e.PromptTokens);
        task.CompletionTokens = taskExecutions.Sum(e => e.CompletionTokens);
        task.CacheReadTokens = taskExecutions.Sum(e => e.CachedTokens);
        task.CacheWriteTokens = (task.CacheWriteTokens ?? 0) + (telemetry.CacheWriteTokens ?? 0);
        task.EstimatedCostUsd = taskExecutions.Sum(e => e.EstimatedCostUsd);
        task.ModelName = execution.Model;
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
        string? modelName = null,
        string? errorCode = null,
        bool? retryable = null)
    {
        try
        {
            var eventType = taskStatus == "Completed" ? "AI_TASK_COMPLETED" : taskStatus == "Failed" ? "AI_TASK_FAILED" : "ProgressUpdate";
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
                modelName = modelName,
                eventType = eventType,
                errorCode = errorCode,
                errorMessage = taskStatus == "Failed" ? message : null,
                retryable = retryable
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

    private static (string ErrorCode, bool Retryable) ClassifyError(string? errorMessage, Exception? ex)
    {
        var msg = (errorMessage ?? ex?.Message ?? "").ToUpperInvariant();

        if (ex is TimeoutException || msg.Contains("TIMEOUT") || msg.Contains("TIME OUT") || msg.Contains("TIMED OUT"))
        {
            return ("TIMEOUT", true);
        }
        if (msg.Contains("RATE_LIMIT") || msg.Contains("RATE LIMIT") || msg.Contains("429") || msg.Contains("TOO MANY REQUESTS"))
        {
            return ("RATE_LIMIT_EXCEEDED", true);
        }
        if (msg.Contains("503") || msg.Contains("SERVICE_UNAVAILABLE") || msg.Contains("SERVICE UNAVAILABLE") || msg.Contains("502") || msg.Contains("BAD GATEWAY") || msg.Contains("504"))
        {
            return ("SERVICE_UNAVAILABLE", true);
        }
        if (ex is System.Net.Sockets.SocketException || msg.Contains("CONNECTION") || msg.Contains("REFUSED") || msg.Contains("UNREACHABLE") || msg.Contains("COULD NOT BE MADE"))
        {
            return ("CONNECTION_FAILURE", false);
        }
        if (msg.Contains("PARSE") || msg.Contains("PARSING") || msg.Contains("JSON") || msg.Contains("SERIALIZATION"))
        {
            return ("PARSING_ERROR", false);
        }
        if (msg.Contains("400") || msg.Contains("BAD REQUEST") || msg.Contains("INVALID_REQUEST") || msg.Contains("INVALID REQUEST"))
        {
            return ("INVALID_REQUEST", false);
        }
        if (ex is HttpRequestException httpEx)
        {
            if (httpEx.StatusCode == null)
            {
                return ("CONNECTION_FAILURE", false);
            }
            return ("SERVICE_UNAVAILABLE", true);
        }

        return ("UNKNOWN_ERROR", false);
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
        public string? ErrorCode { get; set; }
        public bool? Retryable { get; set; }
        public string? SchemaVersion { get; set; }
        public string? ResultData { get; set; }
        public TaskTelemetry? Telemetry { get; set; }
        public List<TaskEvent>? Events { get; set; }
    }

    private class TaskTelemetry
    {
        public int? PromptTokens { get; set; }
        public int? CompletionTokens { get; set; }
        public int? TotalTokens { get; set; }
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

    private async Task SaveAndRegisterArtifactAsync(Guid jobId, string taskType, string resultData, CancellationToken cancellationToken)
    {
        var artifactIds = taskType switch
        {
            "RepoStructure" => new[] { "L1-001", "L1-001-repo_structure" },
            "CommitIntelligence" => new[] { "L1-002", "L1-002-commit_intelligence" },
            "CommitDiff" => new[] { "L1-003", "L1-003-commit_diff" },
            "SkillExtraction" => new[] { "L1-004", "L1-004-tech_stack" },
            "FeatureExtraction" => new[] { "L1-005", "L1-005-feature_extraction" },
            "ArchitectureAnalysis" => new[] { "L1-006", "L1-006-architecture_patterns" },
            "CommitTimeline" => new[] { "L1-007", "L1-007-commit_timeline" },
            "ArchitectureChange" => new[] { "L1-008", "L1-008-architecture_change" },
            "CommitIntent" => new[] { "L1-009", "L1-009-commit_intent" },
            "Complexity" => new[] { "L1-010", "L1-010-complexity" },
            "CodeQuality" => new[] { "L1-011", "L1-011-code_quality" },
            "GitBlame" => new[] { "L1-012", "L1-012-git_blame" },
            "CloneDetection" => new[] { "L1-013", "L1-013-clone_detection" },
            "AiGeneratedCode" => new[] { "L1-014", "L1-014-ai_generated_code" },
            "Ownership" => new[] { "L1-015", "L1-015-ownership_score" },
            "RepoIntelligenceReport" => new[] { "L1-016", "L1-016-repo_intelligence_report", "repo-intelligence-report" },
            "SkillGraph" => new[] { "L1-017", "L1-017-skill_evidence_graph" },
            "TrustScore" => new[] { "L1-018", "L1-018-trust_signals" },
            _ => new[] { taskType }
        };

        // Compute a simple SHA256 checksum for the registry entry
        var checksum = "";
        try
        {
            checksum = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(Encoding.UTF8.GetBytes(resultData)));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to compute checksum for artifact {TaskType}", taskType);
            checksum = Guid.NewGuid().ToString("N");
        }

        foreach (var artifactId in artifactIds)
        {
            var storagePath = $"jobs/{jobId}/artifacts/{artifactId}.json";

            try
            {
                // 1. Save content to object storage
                await _storageProvider.SaveArtifactTextAsync(storagePath, resultData, cancellationToken);

                // 2. Register metadata entry
                var existingEntry = await _context.ArtifactRegistryEntries
                    .FirstOrDefaultAsync(x => x.JobId == jobId && x.ArtifactId == artifactId, cancellationToken);

                if (existingEntry != null)
                {
                    existingEntry.Checksum = checksum;
                    existingEntry.StoragePath = storagePath;
                    existingEntry.CreatedAtUtc = _timeProvider.GetUtcNow();
                }
                else
                {
                    _context.ArtifactRegistryEntries.Add(new CVerify.API.Pipelines.Shared.Artifacts.Entities.ArtifactRegistryEntry
                    {
                        Id = Guid.CreateVersion7(),
                        JobId = jobId,
                        ArtifactId = artifactId,
                        Name = artifactId,
                        StoragePath = storagePath,
                        Checksum = checksum,
                        MetadataJson = "{}",
                        CreatedAtUtc = _timeProvider.GetUtcNow()
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to save or register artifact {ArtifactId} for job {JobId}", artifactId, jobId);
            }
        }
    }

    private async Task ProjectIntelligenceDataAsync(
        Guid jobId,
        string commitSha,
        string finalReportJson,
        SourceCodeRepository repo,
        List<AnalysisTaskResult> results,
        CancellationToken cancellationToken)
    {
        _logger.LogInformation("Projecting Line 1 repository intelligence data into Postgres for job {JobId}", jobId);

        try
        {
            double trustScore = 0.0;
            var languages = new Dictionary<string, double>();
            var patterns = new List<string>();
            double qualityScore = 0.0;
            string cloneRiskClassification = "clean";

            using (var reportDoc = JsonDocument.Parse(finalReportJson))
            {
                var root = reportDoc.RootElement;
                if (root.TryGetProperty("trust_score", out var trustProp))
                {
                    if (trustProp.TryGetProperty("score", out var scoreProp)) trustScore = scoreProp.GetDouble();
                }

                if (root.TryGetProperty("ingestion", out var ingestionProp) && 
                    ingestionProp.TryGetProperty("language_distribution", out var langProp))
                {
                    foreach (var prop in langProp.EnumerateObject())
                    {
                        languages[prop.Name] = prop.Value.GetDouble();
                    }
                }

                if (root.TryGetProperty("architecture", out var archProp) && 
                    archProp.TryGetProperty("patterns", out var patProp))
                {
                    foreach (var item in patProp.EnumerateArray())
                    {
                        if (item.GetString() is string pat && !string.IsNullOrEmpty(pat))
                        {
                            patterns.Add(pat);
                        }
                    }
                }

                if (root.TryGetProperty("code_quality", out var qProp) && 
                    qProp.TryGetProperty("overall_score", out var oScoreProp))
                {
                    qualityScore = oScoreProp.GetDouble();
                }

                if (root.TryGetProperty("fraud_signals", out var fraudProp) && 
                    fraudProp.TryGetProperty("clone_classification", out var cloneProp))
                {
                    cloneRiskClassification = cloneProp.GetString() ?? "clean";
                }
            }

            // Find or create RepositoryAssessment
            var existingAssessment = await _context.RepositoryAssessments
                .FirstOrDefaultAsync(ra => ra.AnalysisJobId == jobId, cancellationToken);

            if (existingAssessment == null)
            {
                existingAssessment = new RepositoryAssessment
                {
                    Id = Guid.CreateVersion7(),
                    RepositoryId = repo.Id,
                    AnalysisJobId = jobId,
                    CommitSha = commitSha,
                    Status = "Completed",
                    CreatedAtUtc = _timeProvider.GetUtcNow()
                };
                _context.RepositoryAssessments.Add(existingAssessment);
            }
            else
            {
                existingAssessment.Status = "Completed";
            }

            existingAssessment.CompletedAtUtc = _timeProvider.GetUtcNow();
            existingAssessment.OverallScore = trustScore;
            existingAssessment.TechStack = JsonSerializer.Serialize(languages);
            existingAssessment.Patterns = JsonSerializer.Serialize(patterns);
            existingAssessment.QualityMetrics = JsonSerializer.Serialize(new { qualityScore = qualityScore, cloneRiskClassification = cloneRiskClassification });
            existingAssessment.JsonData = finalReportJson;
            existingAssessment.ModelVersion = "claude-3-5-sonnet-20241022";
            existingAssessment.PromptVersion = "v2.3.0";
            existingAssessment.AssessmentSchemaVersion = "2.2.0";
            existingAssessment.PipelineVersion = "1.0.0";

            await _context.SaveChangesAsync(cancellationToken);
            var assessmentId = existingAssessment.Id;

            // Remove existing records (idempotency)
            var oldCapabilities = await _context.RepositoryCapabilities.Where(x => x.RepositoryAssessmentId == assessmentId).ToListAsync(cancellationToken);
            _context.RepositoryCapabilities.RemoveRange(oldCapabilities);

            var oldSkills = await _context.RepositorySkillAttributions.Where(x => x.RepositoryAssessmentId == assessmentId).ToListAsync(cancellationToken);
            _context.RepositorySkillAttributions.RemoveRange(oldSkills);

            var oldDomains = await _context.RepositoryDomains.Where(x => x.RepositoryAssessmentId == assessmentId).ToListAsync(cancellationToken);
            _context.RepositoryDomains.RemoveRange(oldDomains);

            var oldSignals = await _context.RepositoryIntelligenceSignals.Where(x => x.RepositoryAssessmentId == assessmentId).ToListAsync(cancellationToken);
            _context.RepositoryIntelligenceSignals.RemoveRange(oldSignals);

            await _context.SaveChangesAsync(cancellationToken);

            // Project Skill Attributions and Domains
            var skillsTaskResult = results.FirstOrDefault(r => r.Task.TaskType == "SkillExtraction");
            var domainsDict = new Dictionary<string, List<string>>();
            var domainsConfidenceSum = new Dictionary<string, double>();
            var domainsEvidenceCount = new Dictionary<string, int>();

            if (skillsTaskResult != null && !string.IsNullOrEmpty(skillsTaskResult.ResultData))
            {
                try
                {
                    using var skillsDoc = JsonDocument.Parse(skillsTaskResult.ResultData);
                    var skillsRoot = skillsDoc.RootElement;
                    var dataElement = skillsRoot.TryGetProperty("data", out var dProp) ? dProp : skillsRoot;
                    if (dataElement.TryGetProperty("skills", out var skillsProp) && skillsProp.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var item in skillsProp.EnumerateArray())
                        {
                            var skillName = item.GetProperty("skill").GetString() ?? "";
                            var category = item.GetProperty("category").GetString() ?? "backend";
                            var confidence = item.GetProperty("confidence").GetDouble();
                            var evidenceList = new List<string>();
                            if (item.TryGetProperty("evidence", out var evProp) && evProp.ValueKind == JsonValueKind.Array)
                            {
                                foreach (var ev in evProp.EnumerateArray())
                                {
                                    if (ev.GetString() is string evStr) evidenceList.Add(evStr);
                                }
                            }

                            var skillAttribution = new RepositorySkillAttribution
                            {
                                Id = Guid.CreateVersion7(),
                                RepositoryAssessmentId = assessmentId,
                                SkillName = skillName,
                                ContributionWeight = (trustScore / 100.0) * (confidence / 100.0),
                                Confidence = confidence / 100.0,
                                VerificationLevel = "AiAnalyzed",
                                AssessmentVersion = "2.2.0",
                                AnalysisVersion = "1.0.0",
                                ModelVersion = "claude-3-5-sonnet-20241022",
                                PromptVersion = "v2.3.0"
                            };
                            _context.RepositorySkillAttributions.Add(skillAttribution);

                            var normCategory = category.ToLowerInvariant() switch
                            {
                                "backend" => "Backend Engineering",
                                "frontend" => "Frontend Engineering",
                                "devops" or "infra" => "DevOps & Platform Engineering",
                                "database" or "data" => "Database & Data Engineering",
                                "ml" or "ai" => "Machine Learning & AI Engineering",
                                _ => "Other Engineering"
                            };

                            if (!domainsDict.ContainsKey(normCategory))
                            {
                                domainsDict[normCategory] = new List<string>();
                                domainsConfidenceSum[normCategory] = 0.0;
                                domainsEvidenceCount[normCategory] = 0;
                            }
                            domainsDict[normCategory].Add(skillName);
                            domainsConfidenceSum[normCategory] += confidence;
                            domainsEvidenceCount[normCategory] += evidenceList.Count;
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error projecting skill attributions to Postgres for job {JobId}", jobId);
                }
            }

            // Create RepositoryDomain records
            var totalDomainSkills = domainsDict.Values.Sum(v => v.Count);
            foreach (var kvp in domainsDict)
            {
                var normCategory = kvp.Key;
                var domainSkills = kvp.Value;
                var avgConfidence = domainsConfidenceSum[normCategory] / domainSkills.Count;
                var weight = totalDomainSkills > 0 ? (double)domainSkills.Count / totalDomainSkills : 0.0;

                var repoDomain = new RepositoryDomain
                {
                    Id = Guid.CreateVersion7(),
                    RepositoryAssessmentId = assessmentId,
                    DomainName = normCategory,
                    Weight = weight,
                    Confidence = avgConfidence / 100.0,
                    EvidenceCount = domainsEvidenceCount[normCategory],
                    SupportingSignals = JsonSerializer.Serialize(domainSkills),
                    AssessmentVersion = "2.2.0",
                    AnalysisVersion = "1.0.0",
                    ModelVersion = "claude-3-5-sonnet-20241022",
                    PromptVersion = "v2.3.0"
                };
                _context.RepositoryDomains.Add(repoDomain);
            }

            // Project Capabilities from FeatureExtraction
            var featuresTaskResult = results.FirstOrDefault(r => r.Task.TaskType == "FeatureExtraction");
            if (featuresTaskResult != null && !string.IsNullOrEmpty(featuresTaskResult.ResultData))
            {
                try
                {
                    using var featuresDoc = JsonDocument.Parse(featuresTaskResult.ResultData);
                    var featuresRoot = featuresDoc.RootElement;
                    var dataElement = featuresRoot.TryGetProperty("data", out var dProp) ? dProp : featuresRoot;
                    if (dataElement.TryGetProperty("features", out var featuresProp) && featuresProp.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var item in featuresProp.EnumerateArray())
                        {
                            var name = item.GetProperty("name").GetString() ?? "";
                            var category = item.GetProperty("category").GetString() ?? "other";
                            var complexityScore = item.GetProperty("complexity_score").GetDouble();
                            var description = item.GetProperty("description").GetString() ?? "";
                            var evidenceList = new List<string>();
                            if (item.TryGetProperty("evidence", out var evProp) && evProp.ValueKind == JsonValueKind.Array)
                            {
                                foreach (var ev in evProp.EnumerateArray())
                                {
                                    if (ev.GetString() is string evStr) evidenceList.Add(evStr);
                                }
                            }

                            var maturity = complexityScore switch
                            {
                                <= 3 => "Basic",
                                <= 6 => "Intermediate",
                                <= 8 => "Advanced",
                                _ => "Enterprise"
                            };

                            var capability = new RepositoryCapability
                            {
                                Id = Guid.CreateVersion7(),
                                RepositoryAssessmentId = assessmentId,
                                Name = name,
                                Category = category,
                                Confidence = 0.85,
                                Maturity = maturity,
                                DifficultyScore = complexityScore / 10.0,
                                Score = complexityScore * 10.0,
                                EvidenceJson = JsonSerializer.Serialize(new { description = description, evidence = evidenceList }),
                                AssessmentVersion = "2.2.0",
                                AnalysisVersion = "1.0.0",
                                ModelVersion = "claude-3-5-sonnet-20241022",
                                PromptVersion = "v2.3.0"
                            };
                            _context.RepositoryCapabilities.Add(capability);
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error projecting capabilities to Postgres for job {JobId}", jobId);
                }
            }

            // Project Intelligence Signals from TrustScore and CommitIntelligence
            var trustTaskResult = results.FirstOrDefault(r => r.Task.TaskType == "TrustScore");
            double scopeSignal = 0.0;
            double complexitySignal = 0.0;
            double ownershipSignal = 0.0;
            double leadershipSignal = 0.0;
            double consistencySignal = 0.0;

            if (trustTaskResult != null && !string.IsNullOrEmpty(trustTaskResult.ResultData))
            {
                try
                {
                    using var trustDoc = JsonDocument.Parse(trustTaskResult.ResultData);
                    var trustRoot = trustDoc.RootElement;
                    var dataElement = trustRoot.TryGetProperty("data", out var dProp) ? dProp : trustRoot;
                    
                    if (dataElement.TryGetProperty("dimensions", out var dimProp))
                    {
                        if (dimProp.TryGetProperty("ownership", out var ownProp)) ownershipSignal = ownProp.GetDouble();
                        if (dimProp.TryGetProperty("code_quality", out var qualProp)) scopeSignal = qualProp.GetDouble();
                        if (dimProp.TryGetProperty("complexity", out var compProp)) complexitySignal = compProp.GetDouble();
                        if (dimProp.TryGetProperty("commit_integrity", out var integProp)) consistencySignal = integProp.GetDouble();
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error parsing trust score dimensions for job {JobId}", jobId);
                }
            }

            var commitsTaskResult = results.FirstOrDefault(r => r.Task.TaskType == "CommitIntelligence");
            var userCommitRatio = trustScore / 100.0;
            var isPrimaryAuthor = trustScore >= 50.0;
            if (commitsTaskResult != null && !string.IsNullOrEmpty(commitsTaskResult.ResultData))
            {
                try
                {
                    using var commitsDoc = JsonDocument.Parse(commitsTaskResult.ResultData);
                    var commitsRoot = commitsDoc.RootElement;
                    var dataElement = commitsRoot.TryGetProperty("data", out var dProp) ? dProp : commitsRoot;
                    if (dataElement.TryGetProperty("ownership", out var ownProp))
                    {
                        if (ownProp.TryGetProperty("user_commit_ratio", out var ratioProp)) userCommitRatio = ratioProp.GetDouble();
                        if (ownProp.TryGetProperty("is_primary_author", out var primProp)) isPrimaryAuthor = primProp.GetBoolean();
                    }
                }
                catch {}
            }
            leadershipSignal = isPrimaryAuthor ? userCommitRatio * 100.0 : userCommitRatio * 50.0;

            var intelligenceSignal = new RepositoryIntelligenceSignal
            {
                Id = Guid.CreateVersion7(),
                RepositoryAssessmentId = assessmentId,
                ScopeSignal = scopeSignal,
                ComplexitySignal = complexitySignal,
                OwnershipSignal = ownershipSignal,
                LeadershipSignal = leadershipSignal,
                ConsistencySignal = consistencySignal,
                LastUpdatedUtc = _timeProvider.GetUtcNow(),
                AssessmentVersion = "2.2.0",
                AnalysisVersion = "1.0.0",
                ModelVersion = "claude-3-5-sonnet-20241022",
                PromptVersion = "v2.3.0"
            };
            _context.RepositoryIntelligenceSignals.Add(intelligenceSignal);

            await _context.SaveChangesAsync(cancellationToken);
            _logger.LogInformation("Successfully projected all repository intelligence relational tables for job {JobId}", jobId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to project repository intelligence relational tables for job {JobId}", jobId);
        }
    }
}
