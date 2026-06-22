using System;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Intelligence.Services;

public interface ICandidateRankingCalculator
{
    Task<CandidateRankingProjection> CalculateCandidateRankingAsync(Guid candidateId, CancellationToken cancellationToken = default);
}
