using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.System.DTOs;

namespace CVerify.API.Modules.Shared.System.Services;

public class CapabilityCatalogService : ICapabilityCatalogService
{
    private readonly ApplicationDbContext _context;

    public CapabilityCatalogService(ApplicationDbContext context)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
    }

    public IEnumerable<CapabilityCatalogDto> GetCatalog(Guid? workspaceId = null)
    {
        return _context.CapabilityCatalogItems
            .AsNoTracking()
            .Where(c => (c.WorkspaceId == null || c.WorkspaceId == workspaceId) && c.Status == "Active")
            .Select(c => new CapabilityCatalogDto(
                c.CapabilityId,
                c.DisplayName,
                c.Category,
                c.Description,
                c.Skills,
                c.ExpectedEvidence
            ))
            .ToList();
    }

    public bool ValidateCapability(string capabilityId, Guid? workspaceId = null)
    {
        return _context.CapabilityCatalogItems
            .Any(c => c.CapabilityId == capabilityId && (c.WorkspaceId == null || c.WorkspaceId == workspaceId) && c.Status == "Active");
    }

    public CapabilityCatalogDto? GetCapability(string capabilityId, Guid? workspaceId = null)
    {
        var item = _context.CapabilityCatalogItems
            .AsNoTracking()
            .FirstOrDefault(c => c.CapabilityId == capabilityId && (c.WorkspaceId == null || c.WorkspaceId == workspaceId) && c.Status == "Active");

        if (item == null) return null;

        return new CapabilityCatalogDto(
            item.CapabilityId,
            item.DisplayName,
            item.Category,
            item.Description,
            item.Skills,
            item.ExpectedEvidence
        );
    }
}
