using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using StackExchange.Redis;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.Persistence;

namespace CVerify.API.Modules.Shared.System.Services;

public class AiStreamingSessionService : IAiStreamingSessionService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly IConnectionMultiplexer _redis;

    public AiStreamingSessionService(ApplicationDbContext dbContext, IConnectionMultiplexer redis)
    {
        _dbContext = dbContext;
        _redis = redis;
    }

    private async Task PublishEventAsync(
        Guid sessionId,
        string eventType,
        string status,
        double progress,
        string? message = null,
        string? stageId = null,
        string? parentStageId = null,
        int? inputTokens = null,
        int? outputTokens = null,
        double? costUsd = null,
        string? logLevel = null,
        string? logComponent = null,
        string? chunk = null,
        string? jsonData = null,
        long? durationMs = null)
    {
        var session = await _dbContext.AiStreamingSessions.AsNoTracking().FirstOrDefaultAsync(s => s.Id == sessionId);
        if (session == null) return;

        var ev = new
        {
            sessionId = sessionId.ToString(),
            pipelineId = session.PipelineId,
            eventType = eventType,
            status = session.Status,
            timestamp = DateTimeOffset.UtcNow.ToString("o"),
            progress = session.Progress,
            message = message,
            stageId = stageId,
            parentStageId = parentStageId,
            inputTokens = inputTokens,
            outputTokens = outputTokens,
            costUsd = costUsd,
            modelName = session.ModelName,
            provider = session.Provider,
            logLevel = logLevel,
            logComponent = logComponent,
            chunk = chunk,
            jsonData = jsonData,
            durationMs = durationMs
        };

        var json = JsonSerializer.Serialize(ev, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        var sub = _redis.GetSubscriber();
        var channel = $"ai:streaming:progress:{sessionId}";
        await sub.PublishAsync(channel, json);
        await sub.PublishAsync("ai:streaming:progress:all", json);
    }

    public async Task<AiStreamingSession> CreateSessionAsync(Guid sessionId, string pipelineId, Guid userId, Guid? workspaceId, string modelName, string provider, string pipelineVersion, string? expectedOutputsJson = null)
    {
        // 1. Manage transient streaming session
        var existing = await _dbContext.AiStreamingSessions.FirstOrDefaultAsync(s => s.Id == sessionId);
        if (existing != null)
        {
            existing.Status = "Pending";
            existing.Progress = 0.0;
            existing.StartedAt = null;
            existing.CompletedAt = null;
            existing.TotalCostUsd = 0m;
            existing.TotalInputTokens = 0;
            existing.TotalOutputTokens = 0;
            existing.LastUpdatedUtc = DateTimeOffset.UtcNow;
        }
        else
        {
            existing = new AiStreamingSession
            {
                Id = sessionId,
                PipelineId = pipelineId,
                UserId = userId,
                WorkspaceId = workspaceId,
                Status = "Pending",
                Progress = 0.0,
                ModelName = modelName,
                Provider = provider,
                PipelineVersion = pipelineVersion,
                ExpectedOutputs = expectedOutputsJson,
                CreatedAtUtc = DateTimeOffset.UtcNow,
                LastUpdatedUtc = DateTimeOffset.UtcNow
            };
            _dbContext.AiStreamingSessions.Add(existing);
        }

        // 2. Manage durable PipelineExecution
        var execution = await _dbContext.PipelineExecutions.FirstOrDefaultAsync(e => e.Id == sessionId);
        if (execution != null)
        {
            execution.Status = "Pending";
            execution.Progress = 0.00m;
            execution.StartedAt = null;
            execution.CompletedAt = null;
            execution.CumulativeCostUsd = 0.00m;
            execution.TotalInputTokens = 0;
            execution.TotalOutputTokens = 0;
            execution.LastUpdatedAtUtc = DateTimeOffset.UtcNow;
            execution.RetryCount = 0;
        }
        else
        {
            execution = new PipelineExecution
            {
                Id = sessionId,
                PipelineType = pipelineId,
                ReferenceId = sessionId,
                Status = "Pending",
                Progress = 0.00m,
                UserId = userId,
                WorkspaceId = workspaceId,
                ModelName = modelName,
                Provider = provider,
                PipelineVersion = pipelineVersion,
                CreatedAtUtc = DateTimeOffset.UtcNow,
                LastUpdatedAtUtc = DateTimeOffset.UtcNow
            };
            _dbContext.PipelineExecutions.Add(execution);
        }

        // Remove existing stages for this session to reset the timeline (authoritative state handling)
        var oldStages = await _dbContext.AiStreamingStages.Where(s => s.SessionId == sessionId).ToListAsync();
        if (oldStages.Any())
        {
            _dbContext.AiStreamingStages.RemoveRange(oldStages);
        }

        var oldDurableStages = await _dbContext.PipelineStages.Where(s => s.ExecutionId == sessionId).ToListAsync();
        if (oldDurableStages.Any())
        {
            _dbContext.PipelineStages.RemoveRange(oldDurableStages);
        }

        // Define default stages to pre-populate in the database
        var stagesToCreate = new List<(string Id, string Name, string Description)>();

        if (pipelineId == "candidate-assessment")
        {
            stagesToCreate.Add(("Initialize", "Initialization", "Spinning up secure assessment environment and fetching workspace context."));
            stagesToCreate.Add(("FetchLine1", "Retrieve Repository Artifacts", "Fetches verified static analysis, provenance, and git telemetry artifacts for the candidate's active repositories."));
            stagesToCreate.Add(("ConsolidateLine1", "Consolidate Repository Signals", "Merges multidimensional capability signals, code quality scores, and commit telemetry across all repositories."));
            stagesToCreate.Add(("L2-001", "Skill Taxonomy Mapping", "Normalizes raw project-level skills against the global CVerify technical skill taxonomy."));
            stagesToCreate.Add(("L2-002", "Skill Proficiency Estimation", "Estimates the depth, scope, and capability bands for each extracted skill using commit frequency and syntax patterns."));
            stagesToCreate.Add(("L2-003", "Capabilities & Gaps Diagnostics", "Pinpoints key architectural strengths and potential engineering development areas from the codebase history."));
            stagesToCreate.Add(("L2-004", "Career Level Assessment", "Maps codebase scope, ownership ratio, and engineering complexity to career-level thresholds."));
            stagesToCreate.Add(("L2-005", "Career Level Calibration", "Calibrates career level alignment across multiple repositories using weighted developer experience metrics."));
            stagesToCreate.Add(("L2-006", "Career Level Evaluation Gate", "Applies validation constraints and overrides to finalize candidate level classifications."));
            stagesToCreate.Add(("L2-007", "Engineering Maturity Evaluation", "Evaluates project hygiene, logging practices, test coverage, and structural organization."));
            stagesToCreate.Add(("L2-008", "Problem Solving Complexity Analyzer", "Analyzes diagnostic intent, recovery patterns, and bug-fix cycles in git commit messages."));
            stagesToCreate.Add(("L2-009", "Technical Tendency Classification", "Classifies developer affinity towards backend, frontend, devops, or fullstack development."));
            stagesToCreate.Add(("L2-010", "Working Style Classification", "Infers collaboration density, velocity consistency, and code review compliance from git metadata."));
            stagesToCreate.Add(("L2-011", "Experience Confidence Calibration", "Adjusts assessment confidence scores based on codebase age, volume, and contributor density."));
            stagesToCreate.Add(("L2-012", "Role Recommendation Engine", "Computes alignment percentages for classic industry roles (e.g. Backend, Tech Lead, DevOps, Architect)."));
            stagesToCreate.Add(("L2-013", "Executive Summary Generation", "Generates a comprehensive recruiter-friendly assessment narrative and executive summary."));
            stagesToCreate.Add(("L2-016", "Skill Tree Generation", "Constructs a validated, hierarchical taxonomy of skills and capabilities based on code and profile evidence."));
            stagesToCreate.Add(("L2-014", "AI Profile Composition", "Assembles and serializes the final verified candidate profile and calibrated score index."));
            stagesToCreate.Add(("L2-015", "Candidate Improvement Engine", "Generates personalized capability improvement plans and score optimization pathways."));
        }
        else if (pipelineId == "repository-analysis")
        {
            stagesToCreate.Add(("RepoStructure", "Structure Parsing", "Scanning directory tree to map project structure and configuration files."));
            stagesToCreate.Add(("CommitIntelligence", "Authorship & Git History", "Analyzing Git commits to verify identity and code volume contributions."));
            stagesToCreate.Add(("SkillExtraction", "Code Capability Extraction", "Running semantic parser to extract technical skills and patterns."));
            stagesToCreate.Add(("ArchitectureAnalysis", "Architecture & Modularity", "Mapping package relationships and architectural patterns."));
            stagesToCreate.Add(("CodeQuality", "Code Quality & Complexity", "Calculating cyclomatic complexity, code smells, and quality score."));
            stagesToCreate.Add(("SecurityAnalysis", "Security & Vulnerability", "Auditing dependency files and secrets leakages."));
            stagesToCreate.Add(("RepositoryClassification", "Classification", "Determining project type, framework, and utility class."));
            stagesToCreate.Add(("RepositorySummary", "Summarization", "Generating codebase overview, stats, and highlights."));
            stagesToCreate.Add(("CvSynthesis", "Relational Mapping", "Aligning repository findings with candidate career orientation."));
        }
        else if (pipelineId == "jd-generation")
        {
            stagesToCreate.Add(("AnalyzeRequirements", "Requirement Profiling", "Ingesting core hiring constraints and target profile criteria."));
            stagesToCreate.Add(("VerifyMarketRates", "Market Calibration", "Retrieving industry salary bounds and active role descriptions."));
            stagesToCreate.Add(("ComposeDraft", "Draft Composition", "Composing structured job description segments (responsibilities, skills)."));
            stagesToCreate.Add(("CalibrateScoring", "Score Rubric Calibration", "Configuring the evaluation rubric that candidates will be graded against."));
            stagesToCreate.Add(("FinalizeJd", "Verification & Release", "Validating description completeness and preparing final draft."));
        }
        else if (pipelineId == "candidate-discovery")
        {
            stagesToCreate.Add(("IndexRequirements", "Requirement Vector Indexing", "Transforming hiring description into capability vectors."));
            stagesToCreate.Add(("QueryTalentGraph", "Talent Graph Querying", "Filtering candidate pool by baseline skill requirements."));
            stagesToCreate.Add(("ComputeAlignment", "Authorship Fit Matching", "Calculating alignment scores based on validated repository evidence."));
            stagesToCreate.Add(("RankCandidates", "Scored Ranking Compilation", "Generating ranked candidate cohort and calibration diagnostics."));
        }

        foreach (var s in stagesToCreate)
        {
            _dbContext.AiStreamingStages.Add(new AiStreamingStage
            {
                Id = Guid.CreateVersion7(),
                SessionId = sessionId,
                StageId = s.Id,
                StageName = s.Name,
                ParentStageId = null,
                Status = "Pending",
                Progress = 0.0,
                Description = s.Description,
                Details = null,
                RetryCount = 0,
                DurationMs = null,
                StartedAt = null,
                CompletedAt = null
            });

            _dbContext.PipelineStages.Add(new PipelineStage
            {
                Id = Guid.CreateVersion7(),
                ExecutionId = sessionId,
                StageId = s.Id,
                StageName = s.Name,
                ParentStageId = null,
                Status = "Pending",
                Progress = 0.00m,
                Description = s.Description,
                DetailsJson = null,
                RetryCount = 0,
                DurationMs = null,
                StartedAt = null,
                CompletedAt = null
            });
        }

        await _dbContext.SaveChangesAsync();

        await PublishEventAsync(sessionId, "SESSION_STARTED", "Pending", 0.0, "Session created.");
        return existing;
    }

    public async Task UpdateSessionStatusAsync(Guid sessionId, string status, string? errorMessage = null, string? summaryData = null)
    {
        var session = await _dbContext.AiStreamingSessions.FirstOrDefaultAsync(s => s.Id == sessionId);
        if (session != null)
        {
            session.Status = status;
            if (status == "Running" && session.StartedAt == null)
            {
                session.StartedAt = DateTimeOffset.UtcNow;
            }
            else if (status == "Completed" || status == "Failed" || status == "Cancelled")
            {
                session.CompletedAt = DateTimeOffset.UtcNow;
            }

            if (!string.IsNullOrEmpty(errorMessage))
            {
                session.ErrorMessage = errorMessage;
            }

            if (!string.IsNullOrEmpty(summaryData))
            {
                session.SummaryData = summaryData;
            }

            session.LastUpdatedUtc = DateTimeOffset.UtcNow;
        }

        // Durable PipelineExecution update
        var execution = await _dbContext.PipelineExecutions.FirstOrDefaultAsync(e => e.Id == sessionId);
        if (execution != null)
        {
            execution.Status = status;
            if (status == "Running" && execution.StartedAt == null)
            {
                execution.StartedAt = DateTimeOffset.UtcNow;
            }
            else if (status == "Completed" || status == "Failed" || status == "Cancelled")
            {
                execution.CompletedAt = DateTimeOffset.UtcNow;
            }

            if (!string.IsNullOrEmpty(errorMessage))
            {
                execution.ErrorMessage = errorMessage;
            }

            execution.LastUpdatedAtUtc = DateTimeOffset.UtcNow;
        }

        await _dbContext.SaveChangesAsync();

        if (session != null)
        {
            var eventType = (status == "Completed" || status == "Failed" || status == "Cancelled")
                ? "SESSION_COMPLETED"
                : "STAGE_PROGRESS";

            await PublishEventAsync(
                sessionId,
                eventType,
                status,
                session.Progress,
                errorMessage ?? (status == "Completed" ? "Session completed successfully." : null),
                jsonData: summaryData
            );
        }
    }

    public async Task UpdateSessionProgressAsync(Guid sessionId, double progress, string currentStep)
    {
        var session = await _dbContext.AiStreamingSessions.FirstOrDefaultAsync(s => s.Id == sessionId);
        if (session != null)
        {
            session.Progress = progress;
            session.CurrentStep = currentStep;
            session.LastUpdatedUtc = DateTimeOffset.UtcNow;
        }

        var execution = await _dbContext.PipelineExecutions.FirstOrDefaultAsync(e => e.Id == sessionId);
        if (execution != null)
        {
            execution.Progress = (decimal)progress;
            execution.CurrentStep = currentStep;
            execution.LastUpdatedAtUtc = DateTimeOffset.UtcNow;
        }

        await _dbContext.SaveChangesAsync();

        if (session != null)
        {
            await PublishEventAsync(sessionId, "STAGE_PROGRESS", session.Status, progress, currentStep);
        }
    }

    public async Task<AiStreamingStage> UpsertStageAsync(Guid sessionId, string stageId, string stageName, string status, double progress, string? description = null, string? parentStageId = null, string? detailsJson = null, int retryCount = 0, long? durationMs = null)
    {
        // 1. Transient streaming stage
        var stage = await _dbContext.AiStreamingStages
            .FirstOrDefaultAsync(s => s.SessionId == sessionId && s.StageId == stageId);

        if (stage == null)
        {
            stage = new AiStreamingStage
            {
                Id = Guid.CreateVersion7(),
                SessionId = sessionId,
                StageId = stageId,
                StageName = stageName,
                ParentStageId = parentStageId,
                Status = status,
                Progress = progress,
                Description = description,
                Details = detailsJson,
                RetryCount = retryCount,
                DurationMs = durationMs,
                StartedAt = status == "Running" ? DateTimeOffset.UtcNow : null
            };

            if (status == "Completed" || status == "Failed")
            {
                stage.CompletedAt = DateTimeOffset.UtcNow;
            }

            _dbContext.AiStreamingStages.Add(stage);
        }
        else
        {
            stage.Status = status;
            stage.Progress = progress;
            if (!string.IsNullOrEmpty(stageName)) stage.StageName = stageName;
            if (!string.IsNullOrEmpty(description)) stage.Description = description;
            if (!string.IsNullOrEmpty(parentStageId)) stage.ParentStageId = parentStageId;
            if (!string.IsNullOrEmpty(detailsJson)) stage.Details = detailsJson;
            if (retryCount > 0) stage.RetryCount = retryCount;
            if (durationMs.HasValue) stage.DurationMs = durationMs;

            if (status == "Running" && stage.StartedAt == null)
            {
                stage.StartedAt = DateTimeOffset.UtcNow;
            }
            else if ((status == "Completed" || status == "Failed") && stage.CompletedAt == null)
            {
                stage.CompletedAt = DateTimeOffset.UtcNow;
                if (stage.StartedAt.HasValue && !durationMs.HasValue)
                {
                    stage.DurationMs = (long)(DateTimeOffset.UtcNow - stage.StartedAt.Value).TotalMilliseconds;
                }
            }
        }

        // 2. Durable PipelineStage upsert
        var pStage = await _dbContext.PipelineStages
            .FirstOrDefaultAsync(s => s.ExecutionId == sessionId && s.StageId == stageId);

        if (pStage == null)
        {
            pStage = new PipelineStage
            {
                Id = Guid.CreateVersion7(),
                ExecutionId = sessionId,
                StageId = stageId,
                StageName = stageName,
                ParentStageId = parentStageId,
                Status = status,
                Progress = (decimal)progress,
                Description = description,
                DetailsJson = detailsJson,
                RetryCount = retryCount,
                DurationMs = durationMs,
                StartedAt = status == "Running" ? DateTimeOffset.UtcNow : null
            };

            if (status == "Completed" || status == "Failed")
            {
                pStage.CompletedAt = DateTimeOffset.UtcNow;
            }

            _dbContext.PipelineStages.Add(pStage);
        }
        else
        {
            pStage.Status = status;
            pStage.Progress = (decimal)progress;
            if (!string.IsNullOrEmpty(stageName)) pStage.StageName = stageName;
            if (!string.IsNullOrEmpty(description)) pStage.Description = description;
            if (!string.IsNullOrEmpty(parentStageId)) pStage.ParentStageId = parentStageId;
            if (!string.IsNullOrEmpty(detailsJson)) pStage.DetailsJson = detailsJson;
            if (retryCount > 0) pStage.RetryCount = retryCount;
            if (durationMs.HasValue) pStage.DurationMs = durationMs;

            if (status == "Running" && pStage.StartedAt == null)
            {
                pStage.StartedAt = DateTimeOffset.UtcNow;
            }
            else if ((status == "Completed" || status == "Failed") && pStage.CompletedAt == null)
            {
                pStage.CompletedAt = DateTimeOffset.UtcNow;
                if (pStage.StartedAt.HasValue && !durationMs.HasValue)
                {
                    pStage.DurationMs = (long)(DateTimeOffset.UtcNow - pStage.StartedAt.Value).TotalMilliseconds;
                }
            }
        }

        await _dbContext.SaveChangesAsync();

        string eventType = status == "Completed" ? "STAGE_COMPLETED" :
                           status == "Failed" ? "STAGE_FAILED" :
                           status == "Running" ? "STAGE_STARTED" : "STAGE_PROGRESS";

        await PublishEventAsync(
            sessionId,
            eventType,
            status,
            progress,
            description,
            stageId,
            parentStageId,
            jsonData: detailsJson,
            durationMs: stage.DurationMs
        );

        return stage;
    }

    public async Task AddLogAsync(Guid sessionId, string? stageId, string logLevel, string? component, string message)
    {
        var log = new AiStreamingLog
        {
            Id = Guid.CreateVersion7(),
            SessionId = sessionId,
            StageId = stageId,
            LogLevel = logLevel,
            Component = component,
            Message = message,
            Timestamp = DateTimeOffset.UtcNow
        };

        _dbContext.AiStreamingLogs.Add(log);

        // Durable PipelineEvent add
        var pEvent = new PipelineEvent
        {
            Id = Guid.CreateVersion7(),
            ExecutionId = sessionId,
            StageId = stageId,
            LogLevel = logLevel,
            Component = component,
            Message = message,
            Timestamp = DateTimeOffset.UtcNow
        };
        _dbContext.PipelineEventsDurable.Add(pEvent);

        await _dbContext.SaveChangesAsync();

        var session = await _dbContext.AiStreamingSessions.AsNoTracking().FirstOrDefaultAsync(s => s.Id == sessionId);
        var status = session?.Status ?? "Running";
        var progress = session?.Progress ?? 0.0;

        await PublishEventAsync(
            sessionId,
            "LOG_EVENT",
            status,
            progress,
            message,
            stageId,
            logLevel: logLevel,
            logComponent: component
        );
    }

    public async Task AddMetricAsync(Guid sessionId, string? stageId, string metricName, double metricValue)
    {
        var metric = new AiStreamingMetric
        {
            Id = Guid.CreateVersion7(),
            SessionId = sessionId,
            StageId = stageId,
            MetricName = metricName,
            MetricValue = metricValue,
            Timestamp = DateTimeOffset.UtcNow
        };

        _dbContext.AiStreamingMetrics.Add(metric);

        // Also aggregate directly on the AiStreamingSession if relevant
        var session = await _dbContext.AiStreamingSessions.FirstOrDefaultAsync(s => s.Id == sessionId);
        if (session != null)
        {
            if (metricName == "input_tokens" || metricName == "prompt_tokens")
            {
                session.TotalInputTokens = (session.TotalInputTokens ?? 0) + (int)metricValue;
            }
            else if (metricName == "output_tokens" || metricName == "completion_tokens")
            {
                session.TotalOutputTokens = (session.TotalOutputTokens ?? 0) + (int)metricValue;
            }
            else if (metricName == "cost_usd")
            {
                session.TotalCostUsd = (session.TotalCostUsd ?? 0m) + (decimal)metricValue;
            }
        }

        // Durable PipelineExecution update
        var execution = await _dbContext.PipelineExecutions.FirstOrDefaultAsync(e => e.Id == sessionId);
        if (execution != null)
        {
            if (metricName == "input_tokens" || metricName == "prompt_tokens")
            {
                execution.TotalInputTokens = (execution.TotalInputTokens ?? 0) + (int)metricValue;
            }
            else if (metricName == "output_tokens" || metricName == "completion_tokens")
            {
                execution.TotalOutputTokens = (execution.TotalOutputTokens ?? 0) + (int)metricValue;
            }
            else if (metricName == "cost_usd")
            {
                execution.CumulativeCostUsd = (execution.CumulativeCostUsd) + (decimal)metricValue;
            }
            execution.LastUpdatedAtUtc = DateTimeOffset.UtcNow;
        }

        // Add to PipelineTaskEntity if stageId is defined to keep detailed metrics
        if (!string.IsNullOrEmpty(stageId))
        {
            var pTask = await _dbContext.PipelineTasksDurable.FirstOrDefaultAsync(t => t.ExecutionId == sessionId && t.TaskIdentifier == stageId);
            if (pTask == null)
            {
                pTask = new PipelineTaskEntity
                {
                    Id = Guid.CreateVersion7(),
                    ExecutionId = sessionId,
                    TaskIdentifier = stageId,
                    TaskName = stageId, // placeholder
                    Status = "Running",
                    Progress = 0.00m,
                    StartedAt = DateTimeOffset.UtcNow,
                    CreatedAtUtc = DateTimeOffset.UtcNow
                };
                _dbContext.PipelineTasksDurable.Add(pTask);
            }

            if (metricName == "input_tokens" || metricName == "prompt_tokens")
            {
                pTask.PromptTokens = (pTask.PromptTokens ?? 0) + (int)metricValue;
            }
            else if (metricName == "output_tokens" || metricName == "completion_tokens")
            {
                pTask.CompletionTokens = (pTask.CompletionTokens ?? 0) + (int)metricValue;
            }
            else if (metricName == "cost_usd")
            {
                pTask.EstimatedCostUsd = (pTask.EstimatedCostUsd ?? 0m) + (decimal)metricValue;
            }
            pTask.Status = "Completed";
            pTask.CompletedAt = DateTimeOffset.UtcNow;
            pTask.DurationMs = pTask.StartedAt.HasValue ? (long?)(DateTimeOffset.UtcNow - pTask.StartedAt.Value).TotalMilliseconds : null;
        }

        await _dbContext.SaveChangesAsync();

        if (session != null)
        {
            string eventType = "METRIC_UPDATED";
            int? inTokens = null;
            int? outTokens = null;
            double? cost = null;

            if (metricName == "input_tokens" || metricName == "prompt_tokens")
            {
                eventType = "TOKEN_UPDATED";
                inTokens = (int)metricValue;
            }
            else if (metricName == "output_tokens" || metricName == "completion_tokens")
            {
                eventType = "TOKEN_UPDATED";
                outTokens = (int)metricValue;
            }
            else if (metricName == "cost_usd")
            {
                eventType = "COST_UPDATED";
                cost = metricValue;
            }

            await PublishEventAsync(
                sessionId,
                eventType,
                session.Status,
                session.Progress,
                stageId: stageId,
                inputTokens: inTokens,
                outputTokens: outTokens,
                costUsd: cost
            );
        }
    }

    public async Task StreamTextChunkAsync(Guid sessionId, string stageId, string chunk)
    {
        var session = await _dbContext.AiStreamingSessions.AsNoTracking().FirstOrDefaultAsync(s => s.Id == sessionId);
        var status = session?.Status ?? "Running";
        var progress = session?.Progress ?? 0.0;

        await PublishEventAsync(
            sessionId,
            "STAGE_PROGRESS",
            status,
            progress,
            stageId: stageId,
            chunk: chunk
        );
    }

    public async Task<(global::System.Collections.Generic.List<string> Events, DateTimeOffset LatestTimestamp, string SessionStatus)> GetFormattedHistoryAsync(Guid sessionId)
    {
        var session = await _dbContext.AiStreamingSessions
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == sessionId);

        if (session == null)
        {
            return (new global::System.Collections.Generic.List<string>(), DateTimeOffset.MinValue, "Pending");
        }

        var events = new global::System.Collections.Generic.List<string>();
        var latestTimestamp = DateTimeOffset.MinValue;
        var jsonOptions = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

        // 1. Fetch and format stages
        var stages = await _dbContext.AiStreamingStages
            .AsNoTracking()
            .Where(s => s.SessionId == sessionId)
            .OrderBy(s => s.StartedAt ?? DateTimeOffset.MinValue)
            .ToListAsync();

        foreach (var stage in stages)
        {
            var eventType = stage.Status == "Completed" ? "STAGE_COMPLETED" :
                            stage.Status == "Failed" ? "STAGE_FAILED" :
                            stage.Status == "Running" ? "STAGE_STARTED" : "STAGE_PROGRESS";

            var stageTimestamp = stage.CompletedAt ?? stage.StartedAt ?? session.CreatedAtUtc;
            if (stageTimestamp > latestTimestamp)
            {
                latestTimestamp = stageTimestamp;
            }

            var ev = new
            {
                sessionId = sessionId.ToString(),
                pipelineId = session.PipelineId,
                eventType = eventType,
                status = stage.Status,
                timestamp = stageTimestamp.ToString("o"),
                progress = stage.Progress,
                message = stage.Description,
                stageId = stage.StageId,
                parentStageId = stage.ParentStageId,
                durationMs = stage.DurationMs,
                jsonData = stage.Details,
                modelName = session.ModelName,
                provider = session.Provider
            };

            events.Add(JsonSerializer.Serialize(ev, jsonOptions));
        }

        // 2. Fetch and format logs
        var logs = await _dbContext.AiStreamingLogs
            .AsNoTracking()
            .Where(l => l.SessionId == sessionId)
            .OrderBy(l => l.Timestamp)
            .ToListAsync();

        foreach (var log in logs)
        {
            if (log.Timestamp > latestTimestamp)
            {
                latestTimestamp = log.Timestamp;
            }

            var ev = new
            {
                sessionId = sessionId.ToString(),
                pipelineId = session.PipelineId,
                eventType = "LOG_EVENT",
                status = session.Status,
                timestamp = log.Timestamp.ToString("o"),
                message = log.Message,
                stageId = log.StageId,
                logLevel = log.LogLevel,
                logComponent = log.Component,
                modelName = session.ModelName,
                provider = session.Provider
            };

            events.Add(JsonSerializer.Serialize(ev, jsonOptions));
        }

        return (events, latestTimestamp, session.Status);
    }
}
