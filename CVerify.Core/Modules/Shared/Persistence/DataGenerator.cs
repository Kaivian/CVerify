using System;
using System.Collections.Generic;
using System.Linq;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.SourceCode.Entities;

namespace CVerify.API.Modules.Shared.Persistence;

public static class DataGenerator
{
    public static List<PipelineExecution> GeneratePipelineExecutions(Guid? userId, Guid? workspaceId, List<SourceCodeRepository> repos)
    {
        if (repos == null || !repos.Any())
        {
            return new List<PipelineExecution>();
        }

        Guid GetRepoId(string name)
        {
            var r = repos.FirstOrDefault(x => x.Name.Equals(name, StringComparison.OrdinalIgnoreCase));
            return r?.Id ?? repos.First().Id;
        }

        var utcNow = DateTimeOffset.UtcNow;

        return new List<PipelineExecution>
        {
            // ==================== Repository Analysis ====================
            new PipelineExecution
            {
                Id = Guid.Parse("019f12f7-74d4-7d28-9391-da9d81d7c646"),
                PipelineType = "repository-analysis",
                ReferenceId = GetRepoId("CVerify"),
                Status = "Completed",
                Progress = 100.00m,
                CurrentStep = "Trust Score Gen",
                StartedAt = utcNow.AddDays(-2),
                CompletedAt = utcNow.AddDays(-2).AddMinutes(5),
                RetryCount = 0,
                MaxBudgetUsd = 5.00m,
                CumulativeCostUsd = 0.455000m,
                TotalInputTokens = 68000,
                TotalOutputTokens = 18000,
                UserId = userId,
                WorkspaceId = workspaceId,
                ModelName = "claude-haiku-4-5-20251001",
                Provider = "Claude",
                PipelineVersion = "1.0.0",
                CreatedAtUtc = utcNow.AddDays(-2),
                LastUpdatedAtUtc = utcNow.AddDays(-2).AddMinutes(5)
            },
            new PipelineExecution
            {
                Id = Guid.Parse("019f12f7-74d5-753d-8a1b-1616f7b7eb9b"),
                PipelineType = "repository-analysis",
                ReferenceId = GetRepoId("kaivian.github.io"),
                Status = "Completed",
                Progress = 100.00m,
                CurrentStep = "Trust Score Gen",
                StartedAt = utcNow.AddDays(-1),
                CompletedAt = utcNow.AddDays(-1).AddMinutes(3),
                RetryCount = 0,
                MaxBudgetUsd = 5.00m,
                CumulativeCostUsd = 0.185000m,
                TotalInputTokens = 45000,
                TotalOutputTokens = 12000,
                UserId = userId,
                WorkspaceId = workspaceId,
                ModelName = "gemini-3.5-flash",
                Provider = "Google Gemini",
                PipelineVersion = "1.0.0",
                CreatedAtUtc = utcNow.AddDays(-1),
                LastUpdatedAtUtc = utcNow.AddDays(-1).AddMinutes(3)
            },
            new PipelineExecution
            {
                Id = Guid.Parse("019f12f7-74d4-703f-8c76-d64c0212c7df"),
                PipelineType = "repository-analysis",
                ReferenceId = GetRepoId("ExploreWorld"),
                Status = "Failed",
                Progress = 70.00m,
                CurrentStep = "AI Code Detect",
                StartedAt = utcNow.AddHours(-4),
                CompletedAt = utcNow.AddHours(-4).AddMinutes(2),
                ErrorMessage = "Rate limit exceeded for provider Google Gemini. Falling back to OpenAI failed due to context length limits.",
                RetryCount = 1,
                MaxBudgetUsd = 5.00m,
                CumulativeCostUsd = 0.220000m,
                TotalInputTokens = 35000,
                TotalOutputTokens = 9000,
                UserId = userId,
                WorkspaceId = workspaceId,
                ModelName = "gemini-3.5-flash",
                Provider = "Google Gemini",
                PipelineVersion = "1.0.0",
                CreatedAtUtc = utcNow.AddHours(-4),
                LastUpdatedAtUtc = utcNow.AddHours(-4).AddMinutes(2)
            },
            new PipelineExecution
            {
                Id = Guid.Parse("019f12f7-74b5-7b4a-bf6d-e497bfdb1eed"),
                PipelineType = "repository-analysis",
                ReferenceId = GetRepoId("Icicle"),
                Status = "Running",
                Progress = 45.00m,
                CurrentStep = "Stack Extractor",
                StartedAt = utcNow.AddMinutes(-5),
                RetryCount = 0,
                MaxBudgetUsd = 5.00m,
                CumulativeCostUsd = 0.120000m,
                TotalInputTokens = 18000,
                TotalOutputTokens = 5000,
                UserId = userId,
                WorkspaceId = workspaceId,
                ModelName = "gpt-4o",
                Provider = "OpenAI",
                PipelineVersion = "1.0.0",
                CreatedAtUtc = utcNow.AddMinutes(-5),
                LastUpdatedAtUtc = utcNow.AddMinutes(-5)
            },
            new PipelineExecution
            {
                Id = Guid.Parse("019f12f7-74d5-71f7-b091-8f8d340b274e"),
                PipelineType = "repository-analysis",
                ReferenceId = GetRepoId("KWardrobe"),
                Status = "Queued",
                Progress = 0.00m,
                CurrentStep = "Queued",
                RetryCount = 0,
                MaxBudgetUsd = 5.00m,
                CumulativeCostUsd = 0.000000m,
                TotalInputTokens = 0,
                TotalOutputTokens = 0,
                UserId = userId,
                WorkspaceId = workspaceId,
                PipelineVersion = "1.0.0",
                CreatedAtUtc = utcNow.AddMinutes(-1),
                LastUpdatedAtUtc = utcNow.AddMinutes(-1)
            },

            // ==================== CV Analysis ====================
            new PipelineExecution
            {
                Id = Guid.Parse("019f12f7-74d5-7abc-1234-56789abcdef0"),
                PipelineType = "cv-analysis",
                ReferenceId = Guid.Parse("019f12f7-74d5-7abc-0000-000000000001"),
                Status = "Completed",
                Progress = 100.00m,
                CurrentStep = "Save Results",
                StartedAt = utcNow.AddDays(-3),
                CompletedAt = utcNow.AddDays(-3).AddSeconds(15),
                RetryCount = 0,
                MaxBudgetUsd = 1.00m,
                CumulativeCostUsd = 0.050000m,
                TotalInputTokens = 8000,
                TotalOutputTokens = 2000,
                UserId = userId,
                WorkspaceId = workspaceId,
                ModelName = "gemini-3.5-flash",
                Provider = "Google Gemini",
                PipelineVersion = "1.0.0",
                CreatedAtUtc = utcNow.AddDays(-3),
                LastUpdatedAtUtc = utcNow.AddDays(-3).AddSeconds(15)
            },
            new PipelineExecution
            {
                Id = Guid.Parse("019f12f7-74d5-7abc-1234-56789abcdef1"),
                PipelineType = "cv-analysis",
                ReferenceId = Guid.Parse("019f12f7-74d5-7abc-0000-000000000002"),
                Status = "Completed",
                Progress = 100.00m,
                CurrentStep = "Save Results",
                StartedAt = utcNow.AddDays(-1),
                CompletedAt = utcNow.AddDays(-1).AddSeconds(12),
                RetryCount = 0,
                MaxBudgetUsd = 1.00m,
                CumulativeCostUsd = 0.040000m,
                TotalInputTokens = 6000,
                TotalOutputTokens = 1800,
                UserId = userId,
                WorkspaceId = workspaceId,
                ModelName = "gpt-4o",
                Provider = "OpenAI",
                PipelineVersion = "1.0.0",
                CreatedAtUtc = utcNow.AddDays(-1),
                LastUpdatedAtUtc = utcNow.AddDays(-1).AddSeconds(12)
            },
            new PipelineExecution
            {
                Id = Guid.Parse("019f12f7-74d5-7abc-1234-56789abcdef2"),
                PipelineType = "cv-analysis",
                ReferenceId = Guid.Parse("019f12f7-74d5-7abc-0000-000000000003"),
                Status = "Failed",
                Progress = 60.00m,
                CurrentStep = "Parse Experience",
                StartedAt = utcNow.AddHours(-2),
                CompletedAt = utcNow.AddHours(-2).AddSeconds(8),
                ErrorMessage = "Context length limit exceeded for Google Gemini on CV document of size 12MB.",
                RetryCount = 0,
                MaxBudgetUsd = 1.00m,
                CumulativeCostUsd = 0.020000m,
                TotalInputTokens = 10000,
                TotalOutputTokens = 500,
                UserId = userId,
                WorkspaceId = workspaceId,
                ModelName = "gemini-3.5-flash",
                Provider = "Google Gemini",
                PipelineVersion = "1.0.0",
                CreatedAtUtc = utcNow.AddHours(-2),
                LastUpdatedAtUtc = utcNow.AddHours(-2).AddSeconds(8)
            },
            new PipelineExecution
            {
                Id = Guid.Parse("019f12f7-74d5-7abc-1234-56789abcdef3"),
                PipelineType = "cv-analysis",
                ReferenceId = Guid.Parse("019f12f7-74d5-7abc-0000-000000000004"),
                Status = "Running",
                Progress = 40.00m,
                CurrentStep = "Extract Skills",
                StartedAt = utcNow.AddSeconds(-30),
                RetryCount = 0,
                MaxBudgetUsd = 1.00m,
                CumulativeCostUsd = 0.010000m,
                TotalInputTokens = 4000,
                TotalOutputTokens = 100,
                UserId = userId,
                WorkspaceId = workspaceId,
                ModelName = "gemini-3.5-flash",
                Provider = "Google Gemini",
                PipelineVersion = "1.0.0",
                CreatedAtUtc = utcNow.AddSeconds(-30),
                LastUpdatedAtUtc = utcNow.AddSeconds(-30)
            },

            // ==================== JD Generation ====================
            new PipelineExecution
            {
                Id = Guid.Parse("019f12f7-74d5-7abc-5678-56789abcdef0"),
                PipelineType = "jd-generation",
                ReferenceId = Guid.Parse("019f12f7-74d5-7abc-0000-000000000005"),
                Status = "Completed",
                Progress = 100.00m,
                CurrentStep = "Draft JD Complete",
                StartedAt = utcNow.AddDays(-4),
                CompletedAt = utcNow.AddDays(-4).AddSeconds(8),
                RetryCount = 0,
                MaxBudgetUsd = 2.00m,
                CumulativeCostUsd = 0.150000m,
                TotalInputTokens = 12000,
                TotalOutputTokens = 4000,
                UserId = userId,
                WorkspaceId = workspaceId,
                ModelName = "gpt-4o",
                Provider = "OpenAI",
                PipelineVersion = "1.0.0",
                CreatedAtUtc = utcNow.AddDays(-4),
                LastUpdatedAtUtc = utcNow.AddDays(-4).AddSeconds(8)
            },
            new PipelineExecution
            {
                Id = Guid.Parse("019f12f7-74d5-7abc-5678-56789abcdef1"),
                PipelineType = "jd-generation",
                ReferenceId = Guid.Parse("019f12f7-74d5-7abc-0000-000000000006"),
                Status = "Completed",
                Progress = 100.00m,
                CurrentStep = "Draft JD Complete",
                StartedAt = utcNow.AddDays(-2),
                CompletedAt = utcNow.AddDays(-2).AddSeconds(9),
                RetryCount = 0,
                MaxBudgetUsd = 2.00m,
                CumulativeCostUsd = 0.120000m,
                TotalInputTokens = 10000,
                TotalOutputTokens = 3500,
                UserId = userId,
                WorkspaceId = workspaceId,
                ModelName = "gpt-4o",
                Provider = "OpenAI",
                PipelineVersion = "1.0.0",
                CreatedAtUtc = utcNow.AddDays(-2),
                LastUpdatedAtUtc = utcNow.AddDays(-2).AddSeconds(9)
            },

            // ==================== Candidate Match ====================
            new PipelineExecution
            {
                Id = Guid.Parse("019f12f7-74d5-7abc-9999-56789abcdef0"),
                PipelineType = "candidate-match",
                ReferenceId = Guid.Parse("019f12f7-74d5-7abc-0000-000000000007"),
                Status = "Completed",
                Progress = 100.00m,
                CurrentStep = "Ranking Generated",
                StartedAt = utcNow.AddDays(-5),
                CompletedAt = utcNow.AddDays(-5).AddSeconds(22),
                RetryCount = 0,
                MaxBudgetUsd = 3.00m,
                CumulativeCostUsd = 0.320000m,
                TotalInputTokens = 22000,
                TotalOutputTokens = 8000,
                UserId = userId,
                WorkspaceId = workspaceId,
                ModelName = "claude-haiku-4-5-20251001",
                Provider = "Claude",
                PipelineVersion = "1.0.0",
                CreatedAtUtc = utcNow.AddDays(-5),
                LastUpdatedAtUtc = utcNow.AddDays(-5).AddSeconds(22)
            },
            new PipelineExecution
            {
                Id = Guid.Parse("019f12f7-74d5-7abc-9999-56789abcdef1"),
                PipelineType = "candidate-match",
                ReferenceId = Guid.Parse("019f12f7-74d5-7abc-0000-000000000008"),
                Status = "Completed",
                Progress = 100.00m,
                CurrentStep = "Ranking Generated",
                StartedAt = utcNow.AddDays(-3),
                CompletedAt = utcNow.AddDays(-3).AddSeconds(18),
                RetryCount = 0,
                MaxBudgetUsd = 3.00m,
                CumulativeCostUsd = 0.280000m,
                TotalInputTokens = 20000,
                TotalOutputTokens = 7000,
                UserId = userId,
                WorkspaceId = workspaceId,
                ModelName = "claude-haiku-4-5-20251001",
                Provider = "Claude",
                PipelineVersion = "1.0.0",
                CreatedAtUtc = utcNow.AddDays(-3),
                LastUpdatedAtUtc = utcNow.AddDays(-3).AddSeconds(18)
            },
            new PipelineExecution
            {
                Id = Guid.Parse("019f12f7-74d5-7abc-9999-56789abcdef2"),
                PipelineType = "candidate-match",
                ReferenceId = Guid.Parse("019f12f7-74d5-7abc-0000-000000000009"),
                Status = "Running",
                Progress = 80.00m,
                CurrentStep = "Ranking Candidates",
                StartedAt = utcNow.AddSeconds(-20),
                RetryCount = 0,
                MaxBudgetUsd = 3.00m,
                CumulativeCostUsd = 0.150000m,
                TotalInputTokens = 15000,
                TotalOutputTokens = 4000,
                UserId = userId,
                WorkspaceId = workspaceId,
                ModelName = "claude-haiku-4-5-20251001",
                Provider = "Claude",
                PipelineVersion = "1.0.0",
                CreatedAtUtc = utcNow.AddSeconds(-20),
                LastUpdatedAtUtc = utcNow.AddSeconds(-20)
            }
        };
    }

    public static List<PipelineStage> GeneratePipelineStages(List<PipelineExecution> executions)
    {
        var stages = new List<PipelineStage>();
        var utcNow = DateTimeOffset.UtcNow;

        // 1. CVerify (Repository Analysis Completed)
        var cverifyExec = executions.FirstOrDefault(e => e.Id == Guid.Parse("019f12f7-74d4-7d28-9391-da9d81d7c646"));
        if (cverifyExec != null)
        {
            stages.AddRange(new[]
            {
                new PipelineStage { Id = Guid.CreateVersion7(), ExecutionId = cverifyExec.Id, StageId = "L1-001", StageName = "Git Ingest", Status = "Completed", Progress = 100.00m, Description = "Cloning and parsing git layout", StartedAt = utcNow.AddDays(-2), CompletedAt = utcNow.AddDays(-2).AddMinutes(1), DurationMs = 60000 },
                new PipelineStage { Id = Guid.CreateVersion7(), ExecutionId = cverifyExec.Id, StageId = "L1-002", StageName = "Commit Extractor", Status = "Completed", Progress = 100.00m, Description = "Extracting git logs and metadata", StartedAt = utcNow.AddDays(-2).AddMinutes(1), CompletedAt = utcNow.AddDays(-2).AddMinutes(2), DurationMs = 60000 },
                new PipelineStage { Id = Guid.CreateVersion7(), ExecutionId = cverifyExec.Id, StageId = "L1-004", StageName = "Stack Extractor", Status = "Completed", Progress = 100.00m, Description = "Identifying stack dependencies", StartedAt = utcNow.AddDays(-2).AddMinutes(2), CompletedAt = utcNow.AddDays(-2).AddMinutes(3), DurationMs = 60000 },
                new PipelineStage { Id = Guid.CreateVersion7(), ExecutionId = cverifyExec.Id, StageId = "L1-012", StageName = "Blame Authorship", Status = "Completed", Progress = 100.00m, Description = "Attributing authorship via git blame", StartedAt = utcNow.AddDays(-2).AddMinutes(3), CompletedAt = utcNow.AddDays(-2).AddMinutes(4), DurationMs = 60000 },
                new PipelineStage { Id = Guid.CreateVersion7(), ExecutionId = cverifyExec.Id, StageId = "L1-018", StageName = "Trust Score Gen", Status = "Completed", Progress = 100.00m, Description = "Evaluating trust scoring matrix", StartedAt = utcNow.AddDays(-2).AddMinutes(4), CompletedAt = utcNow.AddDays(-2).AddMinutes(5), DurationMs = 60000 }
            });
        }

        // 2. ExploreWorld (Repository Analysis Failed)
        var exploreWorldExec = executions.FirstOrDefault(e => e.Id == Guid.Parse("019f12f7-74d4-703f-8c76-d64c0212c7df"));
        if (exploreWorldExec != null)
        {
            stages.AddRange(new[]
            {
                new PipelineStage { Id = Guid.CreateVersion7(), ExecutionId = exploreWorldExec.Id, StageId = "L1-001", StageName = "Git Ingest", Status = "Completed", Progress = 100.00m, Description = "Cloning and parsing git layout", StartedAt = utcNow.AddHours(-4), CompletedAt = utcNow.AddHours(-4).AddMinutes(1), DurationMs = 60000 },
                new PipelineStage { Id = Guid.CreateVersion7(), ExecutionId = exploreWorldExec.Id, StageId = "L1-014", StageName = "AI Code Detect", Status = "Failed", Progress = 0.00m, Description = "Running simhash clone analysis", StartedAt = utcNow.AddHours(-4).AddMinutes(1), CompletedAt = utcNow.AddHours(-4).AddMinutes(2), DurationMs = 60000 }
            });
        }

        // 3. CV Analysis Completed
        var cvExec = executions.FirstOrDefault(e => e.Id == Guid.Parse("019f12f7-74d5-7abc-1234-56789abcdef0"));
        if (cvExec != null)
        {
            stages.AddRange(new[]
            {
                new PipelineStage { Id = Guid.CreateVersion7(), ExecutionId = cvExec.Id, StageId = "CV-001", StageName = "Document Parse", Status = "Completed", Progress = 100.00m, Description = "Parsing PDF CV document layout", StartedAt = utcNow.AddDays(-3), CompletedAt = utcNow.AddDays(-3).AddSeconds(5) },
                new PipelineStage { Id = Guid.CreateVersion7(), ExecutionId = cvExec.Id, StageId = "CV-002", StageName = "Skills Extraction", Status = "Completed", Progress = 100.00m, Description = "Extracting technical capabilities", StartedAt = utcNow.AddDays(-3).AddSeconds(5), CompletedAt = utcNow.AddDays(-3).AddSeconds(10) },
                new PipelineStage { Id = Guid.CreateVersion7(), ExecutionId = cvExec.Id, StageId = "CV-003", StageName = "Generate Summary", Status = "Completed", Progress = 100.00m, Description = "Writing brief profile overview", StartedAt = utcNow.AddDays(-3).AddSeconds(10), CompletedAt = utcNow.AddDays(-3).AddSeconds(15) }
            });
        }

        // 4. CV Analysis Failed
        var cvFailedExec = executions.FirstOrDefault(e => e.Id == Guid.Parse("019f12f7-74d5-7abc-1234-56789abcdef2"));
        if (cvFailedExec != null)
        {
            stages.AddRange(new[]
            {
                new PipelineStage { Id = Guid.CreateVersion7(), ExecutionId = cvFailedExec.Id, StageId = "CV-001", StageName = "Document Parse", Status = "Completed", Progress = 100.00m, Description = "Parsing PDF CV document layout", StartedAt = utcNow.AddHours(-2), CompletedAt = utcNow.AddHours(-2).AddSeconds(4) },
                new PipelineStage { Id = Guid.CreateVersion7(), ExecutionId = cvFailedExec.Id, StageId = "CV-002", StageName = "Skills Extraction", Status = "Failed", Progress = 0.00m, Description = "Extracting technical capabilities", StartedAt = utcNow.AddHours(-2).AddSeconds(4), CompletedAt = utcNow.AddHours(-2).AddSeconds(8) }
            });
        }

        // 5. JD Generation Completed
        var jdExec = executions.FirstOrDefault(e => e.Id == Guid.Parse("019f12f7-74d5-7abc-5678-56789abcdef0"));
        if (jdExec != null)
        {
            stages.AddRange(new[]
            {
                new PipelineStage { Id = Guid.CreateVersion7(), ExecutionId = jdExec.Id, StageId = "JD-001", StageName = "JD Draft Outline", Status = "Completed", Progress = 100.00m, Description = "Drafting job requirements shell", StartedAt = utcNow.AddDays(-4), CompletedAt = utcNow.AddDays(-4).AddSeconds(4) },
                new PipelineStage { Id = Guid.CreateVersion7(), ExecutionId = jdExec.Id, StageId = "JD-002", StageName = "Requirement Enrich", Status = "Completed", Progress = 100.00m, Description = "Refining required skillset bullet points", StartedAt = utcNow.AddDays(-4).AddSeconds(4), CompletedAt = utcNow.AddDays(-4).AddSeconds(8) }
            });
        }

        return stages;
    }

    public static List<PipelineTaskEntity> GeneratePipelineTasks(List<PipelineExecution> executions)
    {
        var tasks = new List<PipelineTaskEntity>();
        var utcNow = DateTimeOffset.UtcNow;

        // 1. CVerify (Repository Analysis)
        var cverifyExec = executions.FirstOrDefault(e => e.Id == Guid.Parse("019f12f7-74d4-7d28-9391-da9d81d7c646"));
        if (cverifyExec != null)
        {
            tasks.AddRange(new[]
            {
                new PipelineTaskEntity { Id = Guid.CreateVersion7(), ExecutionId = cverifyExec.Id, TaskIdentifier = "L1-001", TaskName = "Git Ingest", Status = "Completed", Progress = 100.00m, StartedAt = utcNow.AddDays(-2), CompletedAt = utcNow.AddDays(-2).AddMinutes(1), DurationMs = 60000, CreatedAtUtc = utcNow.AddDays(-2) },
                new PipelineTaskEntity { Id = Guid.CreateVersion7(), ExecutionId = cverifyExec.Id, TaskIdentifier = "L1-002", TaskName = "Commit Extractor", Status = "Completed", Progress = 100.00m, StartedAt = utcNow.AddDays(-2), CompletedAt = utcNow.AddDays(-2).AddMinutes(1).AddSeconds(45), DurationMs = 60000, CreatedAtUtc = utcNow.AddDays(-2).AddMinutes(1) },
                new PipelineTaskEntity { Id = Guid.CreateVersion7(), ExecutionId = cverifyExec.Id, TaskIdentifier = "L1-004", TaskName = "Stack Extractor", Status = "Completed", Progress = 100.00m, StartedAt = utcNow.AddDays(-2).AddMinutes(2), CompletedAt = utcNow.AddDays(-2).AddMinutes(3), DurationMs = 60000, CreatedAtUtc = utcNow.AddDays(-2).AddMinutes(2) },
                new PipelineTaskEntity { Id = Guid.CreateVersion7(), ExecutionId = cverifyExec.Id, TaskIdentifier = "L1-018", TaskName = "Trust Score Gen", Status = "Completed", Progress = 100.00m, StartedAt = utcNow.AddDays(-2).AddMinutes(4), CompletedAt = utcNow.AddDays(-2).AddMinutes(5), DurationMs = 60000, CreatedAtUtc = utcNow.AddDays(-2).AddMinutes(4), PromptTokens = 68000, CompletionTokens = 18000, EstimatedCostUsd = 0.455000m, ModelName = "claude-haiku-4-5-20251001" }
            });
        }

        // 2. ExploreWorld (Repository Analysis Failed)
        var exploreWorldExec = executions.FirstOrDefault(e => e.Id == Guid.Parse("019f12f7-74d4-703f-8c76-d64c0212c7df"));
        if (exploreWorldExec != null)
        {
            tasks.AddRange(new[]
            {
                new PipelineTaskEntity { Id = Guid.CreateVersion7(), ExecutionId = exploreWorldExec.Id, TaskIdentifier = "L1-001", TaskName = "Git Ingest", Status = "Completed", Progress = 100.00m, StartedAt = utcNow.AddHours(-4), CompletedAt = utcNow.AddHours(-4).AddMinutes(1), DurationMs = 60000, CreatedAtUtc = utcNow.AddHours(-4) },
                new PipelineTaskEntity { Id = Guid.CreateVersion7(), ExecutionId = exploreWorldExec.Id, TaskIdentifier = "L1-014", TaskName = "AI Code Detect", Status = "Failed", Progress = 50.00m, StartedAt = utcNow.AddHours(-4).AddMinutes(1), CompletedAt = utcNow.AddHours(-4).AddMinutes(2), DurationMs = 60000, CreatedAtUtc = utcNow.AddHours(-4).AddMinutes(1), ErrorMessage = "Rate limit exceeded for provider Google Gemini." }
            });
        }

        // 3. CV Analysis Completed
        var cvExec = executions.FirstOrDefault(e => e.Id == Guid.Parse("019f12f7-74d5-7abc-1234-56789abcdef0"));
        if (cvExec != null)
        {
            tasks.AddRange(new[]
            {
                new PipelineTaskEntity { Id = Guid.CreateVersion7(), ExecutionId = cvExec.Id, TaskIdentifier = "CV-001", TaskName = "Parse PDF", Status = "Completed", Progress = 100.00m, StartedAt = utcNow.AddDays(-3), CompletedAt = utcNow.AddDays(-3).AddSeconds(5), CreatedAtUtc = utcNow.AddDays(-3) },
                new PipelineTaskEntity { Id = Guid.CreateVersion7(), ExecutionId = cvExec.Id, TaskIdentifier = "CV-003", TaskName = "Generate Summary", Status = "Completed", Progress = 100.00m, StartedAt = utcNow.AddDays(-3).AddSeconds(10), CompletedAt = utcNow.AddDays(-3).AddSeconds(15), CreatedAtUtc = utcNow.AddDays(-3).AddSeconds(10), PromptTokens = 8000, CompletionTokens = 2000, EstimatedCostUsd = 0.050000m, ModelName = "gemini-3.5-flash" }
            });
        }

        // 4. CV Analysis Failed
        var cvFailedExec = executions.FirstOrDefault(e => e.Id == Guid.Parse("019f12f7-74d5-7abc-1234-56789abcdef2"));
        if (cvFailedExec != null)
        {
            tasks.AddRange(new[]
            {
                new PipelineTaskEntity { Id = Guid.CreateVersion7(), ExecutionId = cvFailedExec.Id, TaskIdentifier = "CV-001", TaskName = "Parse PDF", Status = "Completed", Progress = 100.00m, StartedAt = utcNow.AddHours(-2), CompletedAt = utcNow.AddHours(-2).AddSeconds(4), CreatedAtUtc = utcNow.AddHours(-2) },
                new PipelineTaskEntity { Id = Guid.CreateVersion7(), ExecutionId = cvFailedExec.Id, TaskIdentifier = "CV-002", TaskName = "Skills Extraction", Status = "Failed", Progress = 50.00m, StartedAt = utcNow.AddHours(-2).AddSeconds(4), CompletedAt = utcNow.AddHours(-2).AddSeconds(8), ErrorMessage = "Context length limit exceeded for Google Gemini on CV document of size 12MB." }
            });
        }

        // 5. JD Generation Completed
        var jdExec = executions.FirstOrDefault(e => e.Id == Guid.Parse("019f12f7-74d5-7abc-5678-56789abcdef0"));
        if (jdExec != null)
        {
            tasks.AddRange(new[]
            {
                new PipelineTaskEntity { Id = Guid.CreateVersion7(), ExecutionId = jdExec.Id, TaskIdentifier = "JD-001", TaskName = "JD Draft Outline", Status = "Completed", Progress = 100.00m, StartedAt = utcNow.AddDays(-4), CompletedAt = utcNow.AddDays(-4).AddSeconds(4), CreatedAtUtc = utcNow.AddDays(-4) },
                new PipelineTaskEntity { Id = Guid.CreateVersion7(), ExecutionId = jdExec.Id, TaskIdentifier = "JD-002", TaskName = "Requirement Enrich", Status = "Completed", Progress = 100.00m, StartedAt = utcNow.AddDays(-4).AddSeconds(4), CompletedAt = utcNow.AddDays(-4).AddSeconds(8), CreatedAtUtc = utcNow.AddDays(-4).AddSeconds(4), PromptTokens = 12000, CompletionTokens = 4000, EstimatedCostUsd = 0.150000m, ModelName = "gpt-4o" }
            });
        }

        return tasks;
    }

    public static List<PipelineEvent> GeneratePipelineEvents(List<PipelineExecution> executions)
    {
        var events = new List<PipelineEvent>();
        var utcNow = DateTimeOffset.UtcNow;

        // 1. CVerify (Repository Analysis)
        var cverifyExec = executions.FirstOrDefault(e => e.Id == Guid.Parse("019f12f7-74d4-7d28-9391-da9d81d7c646"));
        if (cverifyExec != null)
        {
            events.AddRange(new[]
            {
                new PipelineEvent { Id = Guid.CreateVersion7(), ExecutionId = cverifyExec.Id, LogLevel = "Info", Component = "GitIngest", Message = "Started git ingest stage...", Timestamp = utcNow.AddDays(-2) },
                new PipelineEvent { Id = Guid.CreateVersion7(), ExecutionId = cverifyExec.Id, LogLevel = "Success", Component = "GitIngest", Message = "Successfully cloned CVerify repository default branch (main).", Timestamp = utcNow.AddDays(-2).AddSeconds(20) },
                new PipelineEvent { Id = Guid.CreateVersion7(), ExecutionId = cverifyExec.Id, LogLevel = "Info", Component = "CommitExtractor", Message = "Processing 14,281 changesets for blame authorship...", Timestamp = utcNow.AddDays(-2).AddMinutes(1) },
                new PipelineEvent { Id = Guid.CreateVersion7(), ExecutionId = cverifyExec.Id, LogLevel = "Success", Component = "CommitExtractor", Message = "Commit authorship attributed successfully.", Timestamp = utcNow.AddDays(-2).AddMinutes(1).AddSeconds(45) },
                new PipelineEvent { Id = Guid.CreateVersion7(), ExecutionId = cverifyExec.Id, LogLevel = "Info", Component = "StackExtractor", Message = "Analyzing packages, dependencies, and codebases...", Timestamp = utcNow.AddDays(-2).AddMinutes(2) },
                new PipelineEvent { Id = Guid.CreateVersion7(), ExecutionId = cverifyExec.Id, LogLevel = "Info", Component = "TrustScoreGen", Message = "Starting LLM trust validation flow...", Timestamp = utcNow.AddDays(-2).AddMinutes(4) },
                new PipelineEvent { Id = Guid.CreateVersion7(), ExecutionId = cverifyExec.Id, LogLevel = "Success", Component = "TrustScoreGen", Message = "Trust score generated successfully: 0.74", Timestamp = utcNow.AddDays(-2).AddMinutes(5) }
            });
        }

        // 2. ExploreWorld (Repository Analysis Failed)
        var exploreWorldExec = executions.FirstOrDefault(e => e.Id == Guid.Parse("019f12f7-74d4-703f-8c76-d64c0212c7df"));
        if (exploreWorldExec != null)
        {
            events.AddRange(new[]
            {
                new PipelineEvent { Id = Guid.CreateVersion7(), ExecutionId = exploreWorldExec.Id, LogLevel = "Info", Component = "GitIngest", Message = "Started git ingest stage...", Timestamp = utcNow.AddHours(-4) },
                new PipelineEvent { Id = Guid.CreateVersion7(), ExecutionId = exploreWorldExec.Id, LogLevel = "Info", Component = "AICodeDetect", Message = "Detecting external third-party copy-paste clones...", Timestamp = utcNow.AddHours(-4).AddMinutes(1) },
                new PipelineEvent { Id = Guid.CreateVersion7(), ExecutionId = exploreWorldExec.Id, LogLevel = "Error", Component = "AICodeDetect", Message = "Google Gemini provider returned status code 429: Resource exhausted.", Timestamp = utcNow.AddHours(-4).AddMinutes(1).AddSeconds(30) },
                new PipelineEvent { Id = Guid.CreateVersion7(), ExecutionId = exploreWorldExec.Id, LogLevel = "Error", Component = "AICodeDetect", Message = "Rate limit exceeded for provider Google Gemini. Falling back to OpenAI failed due to context length limits.", Timestamp = utcNow.AddHours(-4).AddMinutes(2) }
            });
        }

        // 3. Icicle (Running Repository Analysis)
        var icicleExec = executions.FirstOrDefault(e => e.Id == Guid.Parse("019f12f7-74b5-7b4a-bf6d-e497bfdb1eed"));
        if (icicleExec != null)
        {
            events.AddRange(new[]
            {
                new PipelineEvent { Id = Guid.CreateVersion7(), ExecutionId = icicleExec.Id, LogLevel = "Info", Component = "GitIngest", Message = "Started git ingest stage...", Timestamp = utcNow.AddMinutes(-5) },
                new PipelineEvent { Id = Guid.CreateVersion7(), ExecutionId = icicleExec.Id, LogLevel = "Success", Component = "GitIngest", Message = "Successfully cloned Icicle repository default branch (master).", Timestamp = utcNow.AddMinutes(-3) },
                new PipelineEvent { Id = Guid.CreateVersion7(), ExecutionId = icicleExec.Id, LogLevel = "Info", Component = "StackExtractor", Message = "Analyzing packages, dependencies, and codebases...", Timestamp = utcNow.AddMinutes(-2) }
            });
        }

        // 4. CV Analysis Completed
        var cvExec = executions.FirstOrDefault(e => e.Id == Guid.Parse("019f12f7-74d5-7abc-1234-56789abcdef0"));
        if (cvExec != null)
        {
            events.AddRange(new[]
            {
                new PipelineEvent { Id = Guid.CreateVersion7(), ExecutionId = cvExec.Id, LogLevel = "Info", Component = "PdfParser", Message = "Initiating parsing on CV PDF document...", Timestamp = utcNow.AddDays(-3) },
                new PipelineEvent { Id = Guid.CreateVersion7(), ExecutionId = cvExec.Id, LogLevel = "Info", Component = "SkillExtractor", Message = "Analyzing CV work history for skills matching...", Timestamp = utcNow.AddDays(-3).AddSeconds(5) },
                new PipelineEvent { Id = Guid.CreateVersion7(), ExecutionId = cvExec.Id, LogLevel = "Success", Component = "SummaryGen", Message = "Candidate CV parsed and summarized successfully.", Timestamp = utcNow.AddDays(-3).AddSeconds(15) }
            });
        }

        // 5. CV Analysis Failed
        var cvFailedExec = executions.FirstOrDefault(e => e.Id == Guid.Parse("019f12f7-74d5-7abc-1234-56789abcdef2"));
        if (cvFailedExec != null)
        {
            events.AddRange(new[]
            {
                new PipelineEvent { Id = Guid.CreateVersion7(), ExecutionId = cvFailedExec.Id, LogLevel = "Info", Component = "PdfParser", Message = "Initiating parsing on CV PDF document...", Timestamp = utcNow.AddHours(-2) },
                new PipelineEvent { Id = Guid.CreateVersion7(), ExecutionId = cvFailedExec.Id, LogLevel = "Error", Component = "SkillExtractor", Message = "Google Gemini returned status code 400: Context length limit exceeded.", Timestamp = utcNow.AddHours(-2).AddSeconds(6) },
                new PipelineEvent { Id = Guid.CreateVersion7(), ExecutionId = cvFailedExec.Id, LogLevel = "Error", Component = "SkillExtractor", Message = "Context length limit exceeded for Google Gemini on CV document of size 12MB.", Timestamp = utcNow.AddHours(-2).AddSeconds(8) }
            });
        }

        // 6. CV Analysis Running
        var cvRunningExec = executions.FirstOrDefault(e => e.Id == Guid.Parse("019f12f7-74d5-7abc-1234-56789abcdef3"));
        if (cvRunningExec != null)
        {
            events.AddRange(new[]
            {
                new PipelineEvent { Id = Guid.CreateVersion7(), ExecutionId = cvRunningExec.Id, LogLevel = "Info", Component = "PdfParser", Message = "Initiating parsing on CV PDF document...", Timestamp = utcNow.AddSeconds(-30) },
                new PipelineEvent { Id = Guid.CreateVersion7(), ExecutionId = cvRunningExec.Id, LogLevel = "Success", Component = "PdfParser", Message = "PDF document text extracted successfully.", Timestamp = utcNow.AddSeconds(-15) },
                new PipelineEvent { Id = Guid.CreateVersion7(), ExecutionId = cvRunningExec.Id, LogLevel = "Info", Component = "SkillExtractor", Message = "Analyzing candidate experience history...", Timestamp = utcNow.AddSeconds(-5) }
            });
        }

        // 7. JD Generation Completed
        var jdExec = executions.FirstOrDefault(e => e.Id == Guid.Parse("019f12f7-74d5-7abc-5678-56789abcdef0"));
        if (jdExec != null)
        {
            events.AddRange(new[]
            {
                new PipelineEvent { Id = Guid.CreateVersion7(), ExecutionId = jdExec.Id, LogLevel = "Info", Component = "DraftShell", Message = "Drafting JD requirements draft outline...", Timestamp = utcNow.AddDays(-4) },
                new PipelineEvent { Id = Guid.CreateVersion7(), ExecutionId = jdExec.Id, LogLevel = "Info", Component = "RequirementEnrich", Message = "Enriching technical requirement tags...", Timestamp = utcNow.AddDays(-4).AddSeconds(4) },
                new PipelineEvent { Id = Guid.CreateVersion7(), ExecutionId = jdExec.Id, LogLevel = "Success", Component = "JDGen", Message = "Successfully completed enriched JD generation.", Timestamp = utcNow.AddDays(-4).AddSeconds(8) }
            });
        }

        return events;
    }
}
