using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.System.Services;
using CVerify.API.Modules.Shared.Domain.Enums;
using Dapper;

namespace CVerify.API.Modules.Auth.Services;

public class OrganizationAuthorizationService : IOrganizationAuthorizationService
{
    private readonly ApplicationDbContext _context;
    private readonly ICacheService _cacheService;

    public OrganizationAuthorizationService(ApplicationDbContext context, ICacheService cacheService)
    {
        _context = context;
        _cacheService = cacheService;
    }

    public async Task<bool> AuthorizeAsync(
        Guid userId, 
        Guid organizationId, 
        string requiredPermission, 
        string scopeType = "ORGANIZATION", 
        Guid? scopeId = null, 
        CancellationToken cancellationToken = default)
    {
        // 1. Fetch from Cache
        var cacheKey = $"auth:org:{organizationId}:user:{userId}:scoped_perms";
        var cachedPerms = await _cacheService.GetSetAsync(cacheKey);

        if (cachedPerms == null || !cachedPerms.Any())
        {
            // Cache Miss: Query Database using Recursive CTE
            cachedPerms = await FetchHierarchicalPermissionsFromDbAsync(userId, organizationId, cancellationToken);
            
            // Re-populate Cache
            foreach (var perm in cachedPerms)
            {
                await _cacheService.AddToSetAsync(cacheKey, perm);
            }
            await _cacheService.SetExpireAsync(cacheKey, TimeSpan.FromHours(4));
        }

        // Check for Super Admin wildcard or direct match
        if (cachedPerms.Contains("*:*:*"))
        {
            return true;
        }

        // Match format "permission:ScopeType:ScopeId" or "permission:ORGANIZATION:OrgId" for global scope
        var targetScopeId = scopeId ?? organizationId;
        var expectedMatch = $"{requiredPermission}:{scopeType.ToUpperInvariant()}:{targetScopeId}".ToLowerInvariant();
        var globalMatch = $"{requiredPermission}:ORGANIZATION:{organizationId}".ToLowerInvariant();

        return cachedPerms.Any(p => p.ToLowerInvariant() == expectedMatch || p.ToLowerInvariant() == globalMatch);
    }

    public async Task<bool> IsMemberAsync(Guid userId, Guid organizationId, CancellationToken cancellationToken = default)
    {
        return await _context.OrganizationMemberships
            .AnyAsync(om => om.OrganizationId == organizationId && om.UserId == userId && om.Status == "active", cancellationToken);
    }

    private async Task<List<string>> FetchHierarchicalPermissionsFromDbAsync(Guid userId, Guid organizationId, CancellationToken cancellationToken)
    {
        // 1. Fetch legacy membership role
        var membership = await _context.OrganizationMemberships
            .FirstOrDefaultAsync(om => om.OrganizationId == organizationId && om.UserId == userId && om.Status == "active", cancellationToken);

        var legacyPermissions = new List<string>();
        if (membership != null && Enum.TryParse<OrganizationRole>(membership.Role, out var orgRole))
        {
            var staticPerms = OrganizationPermissions.GetPermissionsForRole(orgRole);
            legacyPermissions.AddRange(staticPerms.Select(p => $"{p}:ORGANIZATION:{organizationId}"));
        }

        // 2. Query new hierarchical assignments
        const string sql = @"
            WITH RECURSIVE recursive_hierarchy AS (
                -- Anchor: Get directly assigned roles
                SELECT ra.role_id, ra.scope_type, ra.scope_id
                FROM organization_role_assignments ra
                WHERE ra.user_id = @UserId AND ra.organization_id = @OrganizationId

                UNION ALL

                -- Recursive step: Follow parent relationships
                SELECT r.parent_role_id, rh.scope_type, rh.scope_id
                FROM organization_business_roles r
                JOIN recursive_hierarchy rh ON r.id = rh.role_id
                WHERE r.parent_role_id IS NOT NULL
            )
            SELECT DISTINCT CONCAT(p.name, ':', rh.scope_type, ':', rh.scope_id)
            FROM recursive_hierarchy rh
            JOIN organization_role_permissions rp ON rh.role_id = rp.role_id
            JOIN business_permissions p ON rp.permission_id = p.id";

        var db = _context.Database.GetDbConnection();
        var result = await db.QueryAsync<string>(sql, new { UserId = userId, OrganizationId = organizationId });
        
        return legacyPermissions.Concat(result).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
    }
}
