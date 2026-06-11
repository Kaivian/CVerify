using System.Threading;
using System.Threading.Tasks;

namespace CVerify.API.Pipelines.Shared.AI;

public interface IPromptRegistry
{
    Task<string> GetPromptAsync(string promptId, CancellationToken cancellationToken = default);
}
