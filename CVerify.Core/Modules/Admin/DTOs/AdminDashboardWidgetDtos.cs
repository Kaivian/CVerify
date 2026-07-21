using System;
using System.Collections.Generic;

namespace CVerify.API.Modules.Admin.DTOs;

public class PlatformHealthWidgetDto
{
    public long TotalUsers { get; set; }
    public long ActiveUsers24h { get; set; }
    public double UsersTrendVsYesterdayPercent { get; set; }

    public long TotalOrganizations { get; set; }
    public double OrganizationsTrendPercent { get; set; }

    public long TotalRepositories { get; set; }
    public double RepositoriesTrendPercent { get; set; }

    public long TotalCandidates { get; set; }
    public double CandidatesTrendPercent { get; set; }

    public long AiJobsToday { get; set; }
    public int RunningPipelines { get; set; }
    public int FailedJobsToday { get; set; }
    public double SuccessRatePercent { get; set; }

    public int PendingReviewsCount { get; set; }
    public double StorageUsageGb { get; set; }
    public double StorageTotalGb { get; set; }
}

public class InfrastructureWidgetDto
{
    public double CpuUsagePercent { get; set; }
    public string CpuStatus { get; set; } = "normal";

    public double RamUsagePercent { get; set; }
    public double RamUsedMb { get; set; }
    public double RamTotalMb { get; set; }

    public double DiskUsagePercent { get; set; }
    public double DiskUsedGb { get; set; }
    public double DiskTotalGb { get; set; }

    public double NetworkUploadKb { get; set; }
    public double NetworkDownloadKb { get; set; }

    public bool DbHealthy { get; set; }
    public double DbQueryLatencyMs { get; set; }
    public int DbActiveConnections { get; set; }

    public bool RedisHealthy { get; set; }
    public double RedisHitRatio { get; set; }
    public int RedisConnectedClients { get; set; }

    public bool AiServiceHealthy { get; set; }
    public double AiAvgLatencyMs { get; set; }

    public List<double> CpuHistory { get; set; } = new();
    public List<double> MemoryHistory { get; set; } = new();
    public DateTime LastUpdated { get; set; } = DateTime.UtcNow;
}

public class AiOpsWidgetDto
{
    public string ServiceStatus { get; set; } = "Healthy";
    public string FastApiStatus { get; set; } = "Healthy";
    public int QueueLength { get; set; }
    public int ActiveWorkers { get; set; }
    public int RunningJobs { get; set; }
    public int CompletedToday { get; set; }
    public int FailedToday { get; set; }
    public double AvgLatencyMs { get; set; }
    public long TotalPromptTokens { get; set; }
    public long TotalCompletionTokens { get; set; }
    public decimal EstimatedCostTodayUsd { get; set; }
    public decimal EstimatedCostMonthUsd { get; set; }
    public Dictionary<string, int> ModelDistribution { get; set; } = new();
    public Dictionary<string, int> ProviderDistribution { get; set; } = new();
}

public class ActivityItemDto
{
    public string Id { get; set; } = string.Empty;
    public string Category { get; set; } = "General"; // User, Repository, CV, Organization, AI, Security
    public string Action { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string ActorName { get; set; } = string.Empty;
    public string Status { get; set; } = "Success"; // Success, Warning, Danger, Info
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

public class AlertItemDto
{
    public string Id { get; set; } = string.Empty;
    public string Severity { get; set; } = "Information"; // Critical, Warning, Information
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string TargetLink { get; set; } = string.Empty;
    public bool Dismissed { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class UserAnalyticsWidgetDto
{
    public long TotalUsers { get; set; }
    public long ActiveUsers24h { get; set; }
    public long RecruitersCount { get; set; }
    public long CandidatesCount { get; set; }
    public long DevelopersCount { get; set; }
    public long GithubLinkedAccounts { get; set; }
    public long GitlabLinkedAccounts { get; set; }
    public List<DailyTrendMetricDto> RegistrationTrend { get; set; } = new();
    public List<DailyTrendMetricDto> DauTrend { get; set; } = new();
}

public class RepositoryAnalyticsWidgetDto
{
    public long TotalRepositories { get; set; }
    public long SuccessfullyAnalyzed { get; set; }
    public long FailedAnalyses { get; set; }
    public double AvgAnalysisDurationSeconds { get; set; }
    public List<CategoryCountDto> TopLanguages { get; set; } = new();
    public List<CategoryCountDto> TopFrameworks { get; set; } = new();
    public List<DailyTrendMetricDto> AnalysisTrend { get; set; } = new();
}

public class CvAnalyticsWidgetDto
{
    public long TotalCvDocuments { get; set; }
    public long CompletedAnalyses { get; set; }
    public long FailedAnalyses { get; set; }
    public long PendingAnalyses { get; set; }
    public double AvgProcessingTimeSeconds { get; set; }
    public List<DailyTrendMetricDto> ProcessingTrend { get; set; } = new();
    public List<CategoryCountDto> SkillDistribution { get; set; } = new();
}

public class OrganizationAnalyticsWidgetDto
{
    public long TotalOrganizations { get; set; }
    public long ActiveOrganizations { get; set; }
    public long PremiumOrganizations { get; set; }
    public long OpenJobVacancies { get; set; }
    public long ActiveRecruiters { get; set; }
}

public class AiCostDashboardWidgetDto
{
    public decimal DailyCostUsd { get; set; }
    public decimal WeeklyCostUsd { get; set; }
    public decimal MonthlyCostUsd { get; set; }
    public long TotalTokenConsumption { get; set; }
    public Dictionary<string, decimal> ProviderBreakdownUsd { get; set; } = new();
    public Dictionary<string, decimal> ModelBreakdownUsd { get; set; } = new();
    public Dictionary<string, decimal> PipelineBreakdownUsd { get; set; } = new();
}

public class PendingTasksWidgetDto
{
    public int OrgsAwaitingApproval { get; set; }
    public int FlaggedHighRiskUsers { get; set; }
    public int FailedAiJobsNeedingRetry { get; set; }
    public int RepoReAnalysisRequests { get; set; }
    public int ManualModerationRequests { get; set; }
    public int OpenSupportTickets { get; set; }
    public List<PendingTaskItemDto> Items { get; set; } = new();
}

public class PendingTaskItemDto
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Priority { get; set; } = "Medium";
    public string TargetUrl { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class RecentDeploymentsWidgetDto
{
    public string CurrentVersion { get; set; } = "v2.4.0";
    public string PreviousVersion { get; set; } = "v2.3.9";
    public DateTime DeploymentTime { get; set; } = DateTime.UtcNow.AddDays(-1);
    public string Environment { get; set; } = "Production";
    public string GitCommitHash { get; set; } = "a7f82b1";
    public string GitBranch { get; set; } = "main";
    public string DeploymentStatus { get; set; } = "Healthy";
}

public class AuditSummaryWidgetDto
{
    public int TotalEvents24h { get; set; }
    public int SecurityEventsCount { get; set; }
    public List<AuditLogItemSummaryDto> RecentLogs { get; set; } = new();
}

public class AuditLogItemSummaryDto
{
    public string Id { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string EventType { get; set; } = string.Empty;
    public string ActorEmail { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string IpAddress { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class DailyTrendMetricDto
{
    public string Date { get; set; } = string.Empty; // YYYY-MM-DD
    public long Value { get; set; }
}

public class CategoryCountDto
{
    public string Name { get; set; } = string.Empty;
    public long Count { get; set; }
    public double Percentage { get; set; }
}

public class AdminDashboardOverviewDto
{
    public PlatformHealthWidgetDto Health { get; set; } = new();
    public InfrastructureWidgetDto Infrastructure { get; set; } = new();
    public AiOpsWidgetDto AiOperations { get; set; } = new();
    public List<ActivityItemDto> RecentActivity { get; set; } = new();
    public List<AlertItemDto> SystemAlerts { get; set; } = new();
    public UserAnalyticsWidgetDto UserAnalytics { get; set; } = new();
    public RepositoryAnalyticsWidgetDto RepositoryAnalytics { get; set; } = new();
    public CvAnalyticsWidgetDto CvAnalytics { get; set; } = new();
    public OrganizationAnalyticsWidgetDto OrganizationAnalytics { get; set; } = new();
    public AiCostDashboardWidgetDto AiCost { get; set; } = new();
    public PendingTasksWidgetDto PendingTasks { get; set; } = new();
    public RecentDeploymentsWidgetDto Deployments { get; set; } = new();
    public AuditSummaryWidgetDto AuditSummary { get; set; } = new();
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}
