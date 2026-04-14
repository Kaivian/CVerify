using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Modules.Profiles.DTOs;

namespace CVerify.API.Modules.Profiles.Services;

public interface IWorkExperienceService
{
    Task<List<WorkExperienceResponse>> GetWorkExperiencesAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<WorkExperienceResponse> CreateWorkExperienceAsync(Guid userId, WorkExperienceRequest request, CancellationToken cancellationToken = default);
    Task<WorkExperienceResponse> UpdateWorkExperienceAsync(Guid userId, Guid id, WorkExperienceRequest request, CancellationToken cancellationToken = default);
    Task DeleteWorkExperienceAsync(Guid userId, Guid id, CancellationToken cancellationToken = default);
    Task ReorderWorkExperiencesAsync(Guid userId, List<Guid> orderedIds, CancellationToken cancellationToken = default);
}
