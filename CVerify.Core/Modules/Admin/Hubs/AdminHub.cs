using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using CVerify.API.Modules.Admin.DTOs;
using CVerify.API.Modules.Admin.Services;

namespace CVerify.API.Modules.Admin.Hubs;

[Authorize]
public class AdminHub : Hub
{
    private readonly IObservabilityMetricsCollector _metricsCollector;
    private readonly IObservabilityLogSink _logSink;

    public AdminHub(
        IObservabilityMetricsCollector metricsCollector,
        IObservabilityLogSink logSink)
    {
        _metricsCollector = metricsCollector;
        _logSink = logSink;
    }

    public override async Task OnConnectedAsync()
    {
        // Add all authenticated connections on AdminHub to 'admins' group to ensure zero dropped log events
        await Groups.AddToGroupAsync(Context.ConnectionId, "admins");
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, "admins");
        await base.OnDisconnectedAsync(exception);
    }

    public async Task<SystemMetricsResponseDto> GetInitialMetrics()
    {
        return await _metricsCollector.CollectMetricsAsync();
    }

    public IEnumerable<ObservabilityLogEntryDto> GetRecentLogs(string service = "ALL", int count = 200)
    {
        return _logSink.GetRecentLogs(service, count);
    }

    public async Task SubmitFrontendLog(ObservabilityLogEntryDto entry)
    {
        if (entry == null) return;
        entry.Service = "Frontend";
        if (entry.Timestamp == default) entry.Timestamp = DateTime.UtcNow;
        await _logSink.AddLogEntryAsync(entry);
    }

    public async Task SubmitAiLog(ObservabilityLogEntryDto entry)
    {
        if (entry == null) return;
        entry.Service = "AI Backend";
        if (entry.Timestamp == default) entry.Timestamp = DateTime.UtcNow;
        await _logSink.AddLogEntryAsync(entry);
    }

    public void ClearLogs(string service = "ALL")
    {
        _logSink.ClearLogs(service);
    }
}
