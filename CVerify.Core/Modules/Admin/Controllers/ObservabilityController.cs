using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using CVerify.API.Modules.Admin.DTOs;
using CVerify.API.Modules.Admin.Services;

namespace CVerify.API.Modules.Admin.Controllers;

[ApiController]
[Route("api/v1/admin/observability")]
[Authorize(Roles = "ADMIN,SUPER_ADMIN")]
public class ObservabilityController : ControllerBase
{
    private readonly IObservabilityMetricsCollector _metricsCollector;
    private readonly IObservabilityLogSink _logSink;

    public ObservabilityController(
        IObservabilityMetricsCollector metricsCollector,
        IObservabilityLogSink logSink)
    {
        _metricsCollector = metricsCollector;
        _logSink = logSink;
    }

    [HttpGet("metrics")]
    public async Task<IActionResult> GetMetrics()
    {
        var metrics = await _metricsCollector.CollectMetricsAsync();
        return Ok(metrics);
    }

    [HttpGet("logs")]
    public IActionResult GetLogs([FromQuery] string service = "ALL", [FromQuery] int count = 200)
    {
        var logs = _logSink.GetRecentLogs(service, count);
        return Ok(logs);
    }

    [HttpPost("logs/frontend")]
    [AllowAnonymous] // Allow client log shipping with sanitization
    public async Task<IActionResult> SubmitFrontendLog([FromBody] ObservabilityLogEntryDto entry)
    {
        if (entry == null) return BadRequest("Invalid log payload.");
        entry.Service = "Frontend";
        entry.Timestamp = DateTime.UtcNow;
        await _logSink.AddLogEntryAsync(entry);
        return Ok(new { success = true });
    }

    [HttpPost("logs/ai")]
    [AllowAnonymous] // Internal microservice webhook endpoint
    public async Task<IActionResult> SubmitAiLog([FromBody] ObservabilityLogEntryDto entry)
    {
        if (entry == null) return BadRequest("Invalid log payload.");
        entry.Service = "AI Backend";
        entry.Timestamp = DateTime.UtcNow;
        await _logSink.AddLogEntryAsync(entry);
        return Ok(new { success = true });
    }

    [HttpDelete("logs")]
    public IActionResult ClearLogs([FromQuery] string service = "ALL")
    {
        _logSink.ClearLogs(service);
        return Ok(new { success = true, message = $"Cleared logs for {service}" });
    }
}
