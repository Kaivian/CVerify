using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Modules.Shared.System.DTOs;

namespace CVerify.API.Modules.Shared.System.Services;

public interface ICandidateMatchService
{
    Task<List<CandidateMatchDto>> GetCandidateMatchesAsync(Guid requirementId, CancellationToken cancellationToken);
}
