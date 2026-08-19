using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using CVerify.API.Modules.Admin.DTOs;
using CVerify.API.Modules.Admin.Services;

namespace CVerify.API.Modules.Admin.Controllers;

[ApiController]
[Route("api/admin/dashboard")]
[Authorize(Roles = "ADMIN,SUPER_ADMIN")]
public class AdminDashboardController : ControllerBase
{
    private readonly IAdminDashboardFacade _dashboardFacade;

    public AdminDashboardController(IAdminDashboardFacade dashboardFacade)
    {
        _dashboardFacade = dashboardFacade;
    }

    [HttpGet("overview")]
    public async Task<IActionResult> GetOverview([FromQuery] DashboardFilterQueryDto query)
    {
        var overview = await _dashboardFacade.GetOverviewAsync(query);
        return Ok(overview);
    }

    [HttpGet("widgets/health")]
    public async Task<IActionResult> GetHealthWidget([FromQuery] DashboardFilterQueryDto query)
    {
        var widget = await _dashboardFacade.GetPlatformHealthWidgetAsync(query);
        return Ok(widget);
    }

    [HttpGet("widgets/infrastructure")]
    public async Task<IActionResult> GetInfrastructureWidget([FromQuery] DashboardFilterQueryDto query)
    {
        var widget = await _dashboardFacade.GetInfrastructureWidgetAsync(query);
        return Ok(widget);
    }

    [HttpGet("widgets/ai-ops")]
    public async Task<IActionResult> GetAiOpsWidget([FromQuery] DashboardFilterQueryDto query)
    {
        var widget = await _dashboardFacade.GetAiOpsWidgetAsync(query);
        return Ok(widget);
    }

    [HttpGet("widgets/activity")]
    public async Task<IActionResult> GetActivityWidget([FromQuery] int count = 20, [FromQuery] string? category = null, [FromQuery] DashboardFilterQueryDto query = null!)
    {
        var widget = await _dashboardFacade.GetActivityTimelineWidgetAsync(count, category, query);
        return Ok(widget);
    }

    [HttpGet("widgets/alerts")]
    public async Task<IActionResult> GetAlertsWidget([FromQuery] DashboardFilterQueryDto query)
    {
        var widget = await _dashboardFacade.GetSystemAlertsWidgetAsync(query);
        return Ok(widget);
    }

    [HttpGet("widgets/user-analytics")]
    public async Task<IActionResult> GetUserAnalyticsWidget([FromQuery] DashboardFilterQueryDto query)
    {
        var widget = await _dashboardFacade.GetUserAnalyticsWidgetAsync(query);
        return Ok(widget);
    }

    [HttpGet("widgets/repo-analytics")]
    public async Task<IActionResult> GetRepositoryAnalyticsWidget([FromQuery] DashboardFilterQueryDto query)
    {
        var widget = await _dashboardFacade.GetRepositoryAnalyticsWidgetAsync(query);
        return Ok(widget);
    }

    [HttpGet("widgets/cv-analytics")]
    public async Task<IActionResult> GetCvAnalyticsWidget([FromQuery] DashboardFilterQueryDto query)
    {
        var widget = await _dashboardFacade.GetCvAnalyticsWidgetAsync(query);
        return Ok(widget);
    }

    [HttpGet("widgets/org-analytics")]
    public async Task<IActionResult> GetOrganizationAnalyticsWidget([FromQuery] DashboardFilterQueryDto query)
    {
        var widget = await _dashboardFacade.GetOrganizationAnalyticsWidgetAsync(query);
        return Ok(widget);
    }

    [HttpGet("widgets/ai-cost")]
    public async Task<IActionResult> GetAiCostWidget([FromQuery] DashboardFilterQueryDto query)
    {
        var widget = await _dashboardFacade.GetAiCostWidgetAsync(query);
        return Ok(widget);
    }

    [HttpGet("widgets/pending-tasks")]
    public async Task<IActionResult> GetPendingTasksWidget([FromQuery] DashboardFilterQueryDto query)
    {
        var widget = await _dashboardFacade.GetPendingTasksWidgetAsync(query);
        return Ok(widget);
    }

    [HttpGet("widgets/deployments")]
    public async Task<IActionResult> GetDeploymentsWidget([FromQuery] DashboardFilterQueryDto query)
    {
        var widget = await _dashboardFacade.GetRecentDeploymentsWidgetAsync(query);
        return Ok(widget);
    }

    [HttpGet("widgets/audit-summary")]
    public async Task<IActionResult> GetAuditSummaryWidget([FromQuery] DashboardFilterQueryDto query)
    {
        var widget = await _dashboardFacade.GetAuditSummaryWidgetAsync(query);
        return Ok(widget);
    }

    [HttpPost("quick-action/toggle-api-lock")]
    public async Task<IActionResult> ToggleApiEmergencyLock()
    {
        var isLocked = await _dashboardFacade.ToggleApiEmergencyLockAsync();
        return Ok(new { success = true, isLocked, message = isLocked ? "API emergency lock engaged." : "API emergency lock released." });
    }

    [HttpPost("quick-action/dismiss-alert/{alertId}")]
    public async Task<IActionResult> DismissAlert(string alertId)
    {
        var success = await _dashboardFacade.DismissAlertAsync(alertId);
        return Ok(new { success });
    }
}
