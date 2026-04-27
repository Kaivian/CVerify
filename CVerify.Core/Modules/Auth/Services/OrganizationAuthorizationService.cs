using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.Domain.Enums;

namespace CVerify.API.Modules.Auth.Services;

public class OrganizationAuthorizationService : IOrganizationAuthorizationService
{
    private readonly ApplicationDbContext _context;

    public OrganizationAuthorizationService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<bool> AuthorizeAsync(Guid userId, Guid organizationId, string requiredPermission, CancellationToken cancellationToken = default)
    {
        var membership = await _context.OrganizationMemberships
            .FirstOrDefaultAsync(om => om.OrganizationId == organizationId && om.UserId == userId, cancellationToken);

        if (membership == null || membership.Status != "active")
        {
            return false;
        }

        if (Enum.TryParse<OrganizationRole>(membership.Role, out var role))
        {
            return OrganizationPermissions.HasPermission(role, requiredPermission);
        }

        return false;
    }

    public async Task<bool> IsMemberAsync(Guid userId, Guid organizationId, CancellationToken cancellationToken = default)
    {
        return await _context.OrganizationMemberships
            .AnyAsync(om => om.OrganizationId == organizationId && om.UserId == userId && om.Status == "active", cancellationToken);
    }
}
