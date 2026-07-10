using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Pipelines.Shared.Orchestration.Entities;
using CVerify.API.Pipelines.Shared.Queue;

namespace CVerify.API.Pipelines.Shared.Orchestration;

public class DagNode
{
    public string TaskIdentifier { get; set; } = null!;
    public string TaskName { get; set; } = null!;
    public List<string> Prerequisites { get; set; } = new();
}

public class DagScheduler : IDagScheduler
{
    private readonly ApplicationDbContext _context;
    private readonly IPipelineQueue _queue;
    private readonly ILogger<DagScheduler> _logger;

    private static readonly List<DagNode> RepositoryDag = new()
    {
        new() { TaskIdentifier = "L1-001", TaskName = "Git Ingestion Service", Prerequisites = new() },
        new() { TaskIdentifier = "L1-002", TaskName = "Commit History Extractor", Prerequisites = new() { "L1-001" } },
        new() { TaskIdentifier = "L1-003", TaskName = "Commit Diff Parser", Prerequisites = new() { "L1-001", "L1-002" } },
        new() { TaskIdentifier = "L1-004", TaskName = "Tech Stack Extractor", Prerequisites = new() { "L1-001" } },
        new() { TaskIdentifier = "L1-005", TaskName = "Feature Extractor Engine", Prerequisites = new() { "L1-004" } },
        new() { TaskIdentifier = "L1-006", TaskName = "Architecture Analyzer", Prerequisites = new() { "L1-004" } },
        new() { TaskIdentifier = "L1-007", TaskName = "Commit Timeline Analyzer", Prerequisites = new() { "L1-002" } },
        new() { TaskIdentifier = "L1-008", TaskName = "Architecture Change Detector", Prerequisites = new() { "L1-003", "L1-006" } },
        new() { TaskIdentifier = "L1-009", TaskName = "Commit Intent Inferencer", Prerequisites = new() { "L1-002", "L1-003" } },
        new() { TaskIdentifier = "L1-010", TaskName = "Complexity Analyzer", Prerequisites = new() { "L1-004" } },
        new() { TaskIdentifier = "L1-011", TaskName = "Code Quality Analyzer", Prerequisites = new() { "L1-004" } },
        new() { TaskIdentifier = "L1-012", TaskName = "Git Blame Authorship Detector", Prerequisites = new() { "L1-001" } },
        new() { TaskIdentifier = "L1-013", TaskName = "Clone Detection", Prerequisites = new() { "L1-001" } },
        new() { TaskIdentifier = "L1-014", TaskName = "AI Generated Code Detector", Prerequisites = new() { "L1-003" } },
        new() { TaskIdentifier = "L1-015", TaskName = "Ownership Score Calculator", Prerequisites = new() { "L1-012", "L1-002" } },
        new() { TaskIdentifier = "L1-017", TaskName = "Skill Evidence Graph Builder", Prerequisites = new() { "L1-004", "L1-005", "L1-015" } },
        new() { TaskIdentifier = "L1-018", TaskName = "Trust Score Generator", Prerequisites = new() { "L1-009", "L1-011", "L1-015" } },
        new() { TaskIdentifier = "L1-016", TaskName = "Repository Intelligence Aggregator", Prerequisites = new() { "L1-007", "L1-008", "L1-010", "L1-013", "L1-014", "L1-017", "L1-018" } }
    };

    public DagScheduler(
        ApplicationDbContext context,
        IPipelineQueue queue,
        ILogger<DagScheduler> logger)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _queue = queue ?? throw new ArgumentNullException(nameof(queue));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task ScheduleNextTasksAsync(Guid jobId, CancellationToken cancellationToken = default)
    {
        var job = await _context.PipelineJobs.FirstOrDefaultAsync(j => j.Id == jobId, cancellationToken);
        if (job == null)
        {
            _logger.LogWarning("Pipeline job {JobId} not found.", jobId);
            return;
        }

        if (job.Status == "Failed" || job.Status == "Completed" || job.Status == "Cancelled")
        {
            _logger.LogInformation("Job {JobId} is in terminal state {Status}. Skipping scheduling.", jobId, job.Status);
            return;
        }

        var tasks = await _context.PipelineTasks.Where(t => t.JobId == jobId).ToListAsync(cancellationToken);
        var tasksDict = tasks.ToDictionary(t => t.TaskIdentifier);

        bool anyFailed = tasks.Any(t => t.Status == "Failed");
        bool allCompleted = tasks.All(t => t.Status == "Completed");

        if (allCompleted)
        {
            job.Status = "Completed";
            job.Progress = 100.00m;
            job.CompletedAt = DateTimeOffset.UtcNow;
            await _context.SaveChangesAsync(cancellationToken);
            _logger.LogInformation("Pipeline job {JobId} completed successfully.", jobId);
            return;
        }

        if (anyFailed)
        {
            // If any critical task failed and retries are exhausted
            bool fatalFailure = tasks.Any(t => t.Status == "Failed" && t.RetryCount >= 3);
            if (fatalFailure)
            {
                job.Status = "Failed";
                job.CompletedAt = DateTimeOffset.UtcNow;
                job.ErrorMessage = "One or more critical tasks failed after maximum retries.";
                await _context.SaveChangesAsync(cancellationToken);
                _logger.LogError("Pipeline job {JobId} failed due to fatal task failures.", jobId);
                return;
            }
        }

        // Find next tasks to execute
        var tasksToEnqueue = new List<PipelineTask>();

        foreach (var node in RepositoryDag)
        {
            if (!tasksDict.TryGetValue(node.TaskIdentifier, out var task))
            {
                continue;
            }

            if (task.Status == "Pending" || task.Status == "Failed")
            {
                // Check prerequisites
                bool prerequisitesMet = true;
                foreach (var prereqId in node.Prerequisites)
                {
                    if (!tasksDict.TryGetValue(prereqId, out var prereqTask) || prereqTask.Status != "Completed")
                    {
                        prerequisitesMet = false;
                        break;
                    }
                }

                if (prerequisitesMet)
                {
                    tasksToEnqueue.Add(task);
                }
            }
        }

        if (tasksToEnqueue.Count > 0)
        {
            foreach (var task in tasksToEnqueue)
            {
                task.Status = "Queued";
                task.LastUpdatedAtUtc = DateTimeOffset.UtcNow;

                var queueName = GetQueueName(task.TaskIdentifier);
                await _queue.EnqueueTaskAsync(queueName, task.Id, cancellationToken);
                _logger.LogInformation("Enqueued task {TaskIdentifier} ({TaskName}) to queue '{QueueName}' for job {JobId}.",
                    task.TaskIdentifier, task.TaskName, queueName, jobId);
            }

            // Update global job progress based on completed tasks ratio
            int completedCount = tasks.Count(t => t.Status == "Completed");
            job.Progress = Math.Round((decimal)completedCount / tasks.Count * 100, 2);
            job.Status = "Running";
            job.LastUpdatedAtUtc = DateTimeOffset.UtcNow;

            await _context.SaveChangesAsync(cancellationToken);
        }
    }

    private static string GetQueueName(string taskIdentifier)
    {
        return taskIdentifier switch
        {
            "L1-001" or "L1-002" or "L1-003" or "L1-012" => "git",
            "L1-004" or "L1-010" or "L1-011" or "L1-013" => "static",
            "L1-015" or "L1-016" => "aggregation",
            _ => "ai" // L1-005, L1-006, L1-007, L1-008, L1-009, L1-014, L1-017, L1-018
        };
    }
}
