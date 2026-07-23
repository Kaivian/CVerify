using System.Collections.Generic;
using System.Threading.Tasks;
using CVerify.API.Modules.Admin.DTOs;

namespace CVerify.API.Modules.Admin.Services;

public interface IAdminDashboardFacade
{
    Task<PlatformHealthWidgetDto> GetPlatformHealthWidgetAsync(DashboardFilterQueryDto? filter = null);
    Task<InfrastructureWidgetDto> GetInfrastructureWidgetAsync(DashboardFilterQueryDto? filter = null);
    Task<AiOpsWidgetDto> GetAiOpsWidgetAsync(DashboardFilterQueryDto? filter = null);
    Task<List<ActivityItemDto>> GetActivityTimelineWidgetAsync(int count = 20, string? category = null, DashboardFilterQueryDto? filter = null);
    Task<List<AlertItemDto>> GetSystemAlertsWidgetAsync(DashboardFilterQueryDto? filter = null);
    Task<UserAnalyticsWidgetDto> GetUserAnalyticsWidgetAsync(DashboardFilterQueryDto? filter = null);
    Task<RepositoryAnalyticsWidgetDto> GetRepositoryAnalyticsWidgetAsync(DashboardFilterQueryDto? filter = null);
    Task<CvAnalyticsWidgetDto> GetCvAnalyticsWidgetAsync(DashboardFilterQueryDto? filter = null);
    Task<OrganizationAnalyticsWidgetDto> GetOrganizationAnalyticsWidgetAsync(DashboardFilterQueryDto? filter = null);
    Task<AiCostDashboardWidgetDto> GetAiCostWidgetAsync(DashboardFilterQueryDto? filter = null);
    Task<PendingTasksWidgetDto> GetPendingTasksWidgetAsync(DashboardFilterQueryDto? filter = null);
    Task<RecentDeploymentsWidgetDto> GetRecentDeploymentsWidgetAsync(DashboardFilterQueryDto? filter = null);
    Task<AuditSummaryWidgetDto> GetAuditSummaryWidgetAsync(DashboardFilterQueryDto? filter = null);
    Task<AdminDashboardOverviewDto> GetOverviewAsync(DashboardFilterQueryDto? filter = null);
    Task<bool> ToggleApiEmergencyLockAsync();
    Task<bool> DismissAlertAsync(string alertId);
}
