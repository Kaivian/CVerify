using System.Collections.Generic;
using CVerify.API.Modules.Shared.System.DTOs;

namespace CVerify.API.Modules.Shared.System.Services;

public interface ICapabilityCatalogService
{
    IEnumerable<CapabilityCatalogDto> GetCatalog(Guid? workspaceId = null);
    bool ValidateCapability(string capabilityId, Guid? workspaceId = null);
    CapabilityCatalogDto? GetCapability(string capabilityId, Guid? workspaceId = null);
}
