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
    public async Task<IActionResult> GetOverview()
    {
        var overview = await _dashboardFacade.GetOverviewAsync();
        return Ok(overview);
    }

    [HttpGet("widgets/health")]
    public async Task<IActionResult> GetHealthWidget()
    {
        var widget = await _dashboardFacade.GetPlatformHealthWidgetAsync();
        return Ok(widget);
    }

    [HttpGet("widgets/infrastructure")]
    public async Task<IActionResult> GetInfrastructureWidget()
    {
        var widget = await _dashboardFacade.GetInfrastructureWidgetAsync();
        return Ok(widget);
    }

    [HttpGet("widgets/ai-ops")]
    public async Task<IActionResult> GetAiOpsWidget()
    {
        var widget = await _dashboardFacade.GetAiOpsWidgetAsync();
        return Ok(widget);
    }

    [HttpGet("widgets/activity")]
    public async Task<IActionResult> GetActivityWidget([FromQuery] int count = 20, [FromQuery] string? category = null)
    {
        var widget = await _dashboardFacade.GetActivityTimelineWidgetAsync(count, category);
        return Ok(widget);
    }

    [HttpGet("widgets/alerts")]
    public async Task<IActionResult> GetAlertsWidget()
    {
        var widget = await _dashboardFacade.GetSystemAlertsWidgetAsync();
        return Ok(widget);
    }

    [HttpGet("widgets/user-analytics")]
    public async Task<IActionResult> GetUserAnalyticsWidget()
    {
        var widget = await _dashboardFacade.GetUserAnalyticsWidgetAsync();
        return Ok(widget);
    }

    [HttpGet("widgets/repo-analytics")]
    public async Task<IActionResult> GetRepositoryAnalyticsWidget()
    {
        var widget = await _dashboardFacade.GetRepositoryAnalyticsWidgetAsync();
        return Ok(widget);
    }

    [HttpGet("widgets/cv-analytics")]
    public async Task<IActionResult> GetCvAnalyticsWidget()
    {
        var widget = await _dashboardFacade.GetCvAnalyticsWidgetAsync();
        return Ok(widget);
    }

    [HttpGet("widgets/org-analytics")]
    public async Task<IActionResult> GetOrganizationAnalyticsWidget()
    {
        var widget = await _dashboardFacade.GetOrganizationAnalyticsWidgetAsync();
        return Ok(widget);
    }

    [HttpGet("widgets/ai-cost")]
    public async Task<IActionResult> GetAiCostWidget()
    {
        var widget = await _dashboardFacade.GetAiCostWidgetAsync();
        return Ok(widget);
    }

    [HttpGet("widgets/pending-tasks")]
    public async Task<IActionResult> GetPendingTasksWidget()
    {
        var widget = await _dashboardFacade.GetPendingTasksWidgetAsync();
        return Ok(widget);
    }

    [HttpGet("widgets/deployments")]
    public async Task<IActionResult> GetDeploymentsWidget()
    {
        var widget = await _dashboardFacade.GetRecentDeploymentsWidgetAsync();
        return Ok(widget);
    }

    [HttpGet("widgets/audit-summary")]
    public async Task<IActionResult> GetAuditSummaryWidget()
    {
        var widget = await _dashboardFacade.GetAuditSummaryWidgetAsync();
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
