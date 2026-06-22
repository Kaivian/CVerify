using System.Threading;
using System.Threading.Tasks;

namespace CVerify.API.Modules.Intelligence.Services;

public interface ICandidateRankingProjectionService
{
    Task RebuildRankingProjectionsAsync(CancellationToken cancellationToken = default);
}
