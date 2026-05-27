using System.Threading;
using System.Threading.Tasks;

namespace CVerify.API.Modules.Intelligence.Services;

public interface IUnifiedMatchingEngine
{
    Task<UnifiedMatchResult> EvaluateMatchAsync(
        CandidateCapabilityIntelligence candidateIntelligence,
        UnifiedJobRequirement jobRequirement,
        CancellationToken cancellationToken = default);
}
