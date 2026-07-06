using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace CVerify.API.Modules.Shared.System.Pipelines;

public class PipelineDispatcher : IPipelineDispatcher
{
    private readonly IEnumerable<IPipelineOrchestrator> _orchestrators;

    public PipelineDispatcher(IEnumerable<IPipelineOrchestrator> orchestrators)
    {
        _orchestrators = orchestrators;
    }

    private IPipelineOrchestrator GetOrchestrator(string pipelineType)
    {
        var orchestrator = _orchestrators.FirstOrDefault(o => o.PipelineType.Equals(pipelineType, StringComparison.OrdinalIgnoreCase));
        if (orchestrator == null)
        {
            throw new NotSupportedException($"AI Pipeline of type '{pipelineType}' is not supported.");
        }
        return orchestrator;
    }

    public async Task<bool> CancelAsync(string pipelineType, Guid executionId, CancellationToken cancellationToken = default)
    {
        var orchestrator = GetOrchestrator(pipelineType);
        return await orchestrator.CancelAsync(executionId, cancellationToken);
    }

    public async Task<bool> RetryAsync(string pipelineType, Guid executionId, Guid? taskId = null, CancellationToken cancellationToken = default)
    {
        var orchestrator = GetOrchestrator(pipelineType);
        return await orchestrator.RetryAsync(executionId, taskId, cancellationToken);
    }

    public async Task<bool> PauseAsync(string pipelineType, Guid executionId, CancellationToken cancellationToken = default)
    {
        var orchestrator = GetOrchestrator(pipelineType);
        return await orchestrator.PauseAsync(executionId, cancellationToken);
    }

    public async Task<bool> ResumeAsync(string pipelineType, Guid executionId, CancellationToken cancellationToken = default)
    {
        var orchestrator = GetOrchestrator(pipelineType);
        return await orchestrator.ResumeAsync(executionId, cancellationToken);
    }
}
