using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Modules.Shared.Domain.Entities;
using CVerify.API.Modules.Shared.System.DTOs;

namespace CVerify.API.Modules.Shared.System.Services;

public interface IHiringRequirementService
{
    Task<HiringRequirement> CreateDraftAsync(CreateHiringRequirementRequestDto request, Guid userId, CancellationToken cancellationToken);
    Task<HiringRequirement> UpdateDraftAsync(Guid id, UpdateHiringRequirementRequestDto request, CancellationToken cancellationToken);
    Task<HiringRequirement> GetByIdAsync(Guid id, CancellationToken cancellationToken);
    Task<RequirementSnapshot> PublishAsync(Guid id, CancellationToken cancellationToken);
    Task<PaginatedListDto<HiringRequirement>> GetByWorkspaceIdAsync(
        Guid workspaceId,
        string? search,
        string? department,
        string? status,
        string? sortBy,
        string? sortOrder,
        int page,
        int pageSize,
        CancellationToken cancellationToken);
    Task GenerateArtifactsAsync(Guid id, CancellationToken cancellationToken);
    Task GenerateArtifactAsync(Guid id, string artifactType, CancellationToken cancellationToken);
    Task CancelGenerationAsync(Guid id, string artifactType);
    Dictionary<string, float> CalculateWeights(HiringRequirement req);
    float[] CalculateRequirementVector(HiringRequirement req, Dictionary<string, float> normalizedWeights);
    Task<CapabilityCatalogItem> CreateCustomCapabilityAsync(CreateCapabilityCatalogItemDto request, CancellationToken cancellationToken);
    Task<CapabilityCatalogItem> UpdateCustomCapabilityAsync(string capabilityId, UpdateCapabilityCatalogItemDto request, CancellationToken cancellationToken);
    Task DeleteCustomCapabilityAsync(string capabilityId, CancellationToken cancellationToken);
    Task DeleteAsync(Guid id, CancellationToken cancellationToken);
    Task BulkDeleteAsync(List<Guid> ids, CancellationToken cancellationToken);
    Task BulkArchiveAsync(List<Guid> ids, CancellationToken cancellationToken);
}
