using System;
using System.Threading.Tasks;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Shared.System.Services;

public interface IAiStreamingSessionService
{
    Task<AiStreamingSession> CreateSessionAsync(Guid sessionId, string pipelineId, Guid userId, Guid? workspaceId, string modelName, string provider, string pipelineVersion, string? expectedOutputsJson = null);
    Task UpdateSessionStatusAsync(Guid sessionId, string status, string? errorMessage = null, string? summaryData = null);
    Task UpdateSessionProgressAsync(Guid sessionId, double progress, string currentStep);
    Task<AiStreamingStage> UpsertStageAsync(Guid sessionId, string stageId, string stageName, string status, double progress, string? description = null, string? parentStageId = null, string? detailsJson = null, int retryCount = 0, long? durationMs = null);
    Task AddLogAsync(Guid sessionId, string? stageId, string logLevel, string? component, string message);
    Task AddMetricAsync(Guid sessionId, string? stageId, string metricName, double metricValue);
    Task StreamTextChunkAsync(Guid sessionId, string stageId, string chunk);
    Task<(global::System.Collections.Generic.List<string> Events, DateTimeOffset LatestTimestamp, string SessionStatus)> GetFormattedHistoryAsync(Guid sessionId);
}
