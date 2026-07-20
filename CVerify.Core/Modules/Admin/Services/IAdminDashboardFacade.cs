using System.Collections.Generic;
using System.Threading.Tasks;
using CVerify.API.Modules.Admin.DTOs;

namespace CVerify.API.Modules.Admin.Services;

public interface IAdminDashboardFacade
{
    Task<PlatformHealthWidgetDto> GetPlatformHealthWidgetAsync();
    Task<InfrastructureWidgetDto> GetInfrastructureWidgetAsync();
    Task<AiOpsWidgetDto> GetAiOpsWidgetAsync();
    Task<List<ActivityItemDto>> GetActivityTimelineWidgetAsync(int count = 20, string? category = null);
    Task<List<AlertItemDto>> GetSystemAlertsWidgetAsync();
    Task<UserAnalyticsWidgetDto> GetUserAnalyticsWidgetAsync();
    Task<RepositoryAnalyticsWidgetDto> GetRepositoryAnalyticsWidgetAsync();
    Task<CvAnalyticsWidgetDto> GetCvAnalyticsWidgetAsync();
    Task<OrganizationAnalyticsWidgetDto> GetOrganizationAnalyticsWidgetAsync();
    Task<AiCostDashboardWidgetDto> GetAiCostWidgetAsync();
    Task<PendingTasksWidgetDto> GetPendingTasksWidgetAsync();
    Task<RecentDeploymentsWidgetDto> GetRecentDeploymentsWidgetAsync();
    Task<AuditSummaryWidgetDto> GetAuditSummaryWidgetAsync();
    Task<AdminDashboardOverviewDto> GetOverviewAsync();
    Task<bool> ToggleApiEmergencyLockAsync();
    Task<bool> DismissAlertAsync(string alertId);
}
