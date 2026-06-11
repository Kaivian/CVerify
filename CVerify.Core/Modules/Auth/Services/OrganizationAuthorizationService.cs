using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.System.Services;
using CVerify.API.Modules.Shared.Domain.Enums;
using CVerify.API.Modules.Shared.Security.Authorization;
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

    public async Task<List<string>> GetPermissionsAsync(Guid userId, Guid organizationId, CancellationToken cancellationToken = default)
    {
        var cacheKey = $"auth:org:{organizationId}:user:{userId}:scoped_perms";
        var cachedSet = await _cacheService.GetSetAsync(cacheKey);
        List<string> cachedPerms;

        if (cachedSet == null || !cachedSet.Any())
        {
            cachedPerms = await FetchHierarchicalPermissionsFromDbAsync(userId, organizationId, cancellationToken);
            
            if (cachedPerms.Any())
            {
                foreach (var perm in cachedPerms)
                {
                    await _cacheService.AddToSetAsync(cacheKey, perm);
                }
                await _cacheService.SetExpireAsync(cacheKey, TimeSpan.FromHours(4));
            }
        }
        else
        {
            cachedPerms = cachedSet.ToList();
        }

        return cachedPerms;
    }

    public async Task<bool> AuthorizeAsync(
        Guid userId, 
        Guid organizationId, 
        string requiredPermission, 
        string scopeType = "ORGANIZATION", 
        Guid? scopeId = null, 
        CancellationToken cancellationToken = default)
    {
        var cachedPerms = await GetPermissionsAsync(userId, organizationId, cancellationToken);
        return PermissionEvaluator.HasPermission(cachedPerms, requiredPermission, organizationId, scopeType, scopeId);
    }

    public async Task<bool> IsMemberAsync(Guid userId, Guid organizationId, CancellationToken cancellationToken = default)
    {
        return await _context.OrganizationMemberships
            .AnyAsync(om => om.OrganizationId == organizationId && om.UserId == userId && om.Status == "active", cancellationToken);
    }

    private async Task<List<string>> FetchHierarchicalPermissionsFromDbAsync(Guid userId, Guid organizationId, CancellationToken cancellationToken)
    {
        // Validate active membership
        var isActiveMember = await _context.OrganizationMemberships
            .AnyAsync(om => om.OrganizationId == organizationId && om.UserId == userId && om.Status == "active", cancellationToken);

        if (!isActiveMember)
        {
            return new List<string>();
        }

        // Query new hierarchical assignments
        const string sql = @"
            WITH RECURSIVE recursive_hierarchy AS (
                -- Anchor: Get directly assigned roles
                SELECT ra.role_id, ra.scope_type, ra.scope_id
                FROM role_assignments ra
                LEFT JOIN workspaces w ON ra.scope_type = 'WORKSPACE' AND ra.scope_id = w.id
                WHERE ra.user_id = @UserId 
                  AND (
                    (ra.scope_type = 'ORGANIZATION' AND ra.scope_id = @OrganizationId)
                    OR (ra.scope_type = 'WORKSPACE' AND w.organization_id = @OrganizationId)
                  )

                UNION ALL

                -- Recursive step: Follow parent relationships
                SELECT r.parent_role_id, rh.scope_type, rh.scope_id
                FROM roles r
                JOIN recursive_hierarchy rh ON r.id = rh.role_id
                WHERE r.parent_role_id IS NOT NULL
            )
            SELECT DISTINCT CONCAT(p.name, ':', rh.scope_type, ':', rh.scope_id)
            FROM recursive_hierarchy rh
            JOIN role_permissions rp ON rh.role_id = rp.role_id
            JOIN permissions p ON rp.permission_id = p.id";

        var db = _context.Database.GetDbConnection();
        var result = await db.QueryAsync<string>(sql, new { UserId = userId, OrganizationId = organizationId });
        
        return result.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
    }
}
