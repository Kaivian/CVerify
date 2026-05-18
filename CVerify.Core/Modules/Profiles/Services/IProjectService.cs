using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Modules.Profiles.DTOs;

namespace CVerify.API.Modules.Profiles.Services;

public interface IProjectService
{
    Task<List<ProjectEntryResponse>> GetProjectsAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<ProjectEntryResponse> CreateProjectAsync(Guid userId, ProjectEntryRequest request, CancellationToken cancellationToken = default);
    Task<ProjectEntryResponse> UpdateProjectAsync(Guid userId, Guid id, ProjectEntryRequest request, CancellationToken cancellationToken = default);
    Task DeleteProjectAsync(Guid userId, Guid id, CancellationToken cancellationToken = default);
    Task ReorderProjectsAsync(Guid userId, List<Guid> orderedIds, CancellationToken cancellationToken = default);
    Task UpgradeRepositoryLinkedProjectsAsync(Guid userId, CancellationToken cancellationToken = default);
}
