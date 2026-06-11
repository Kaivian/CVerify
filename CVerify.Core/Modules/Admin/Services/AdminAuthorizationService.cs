using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using CVerify.API.Modules.Shared.Persistence;
using CVerify.API.Modules.Shared.System.Services;
using Dapper;

namespace CVerify.API.Modules.Admin.Services;

public class AdminAuthorizationService : IAdminAuthorizationService
{
    private readonly ApplicationDbContext _context;
    private readonly ICacheService _cacheService;

    public AdminAuthorizationService(ApplicationDbContext context, ICacheService cacheService)
    {
        _context = context;
        _cacheService = cacheService;
    }

    public async Task<bool> AuthorizeAsync(Guid userId, string requiredPermission, CancellationToken cancellationToken = default)
    {
        // 1. Fetch from Cache
        var cacheKey = $"auth:admin:user:{userId}:perms";
        var cachedPerms = await _cacheService.GetSetAsync(cacheKey);

        if (cachedPerms == null || !cachedPerms.Any())
        {
            // Cache Miss: Query Database using Recursive CTE capped at depth 1
            var dbPerms = await FetchHierarchicalPermissionsFromDbAsync(userId, cancellationToken);
            
            // Re-populate Cache
            foreach (var perm in dbPerms)
            {
                await _cacheService.AddToSetAsync(cacheKey, perm);
            }
            await _cacheService.SetExpireAsync(cacheKey, TimeSpan.FromHours(4));
            cachedPerms = dbPerms;
        }

        // Check for Super Admin wildcard or direct match
        if (cachedPerms.Contains("*:*:*") || cachedPerms.Contains("*"))
        {
            return true;
        }

        // Match wildcard or exact match
        return cachedPerms.Any(p => p.Equals(requiredPermission, StringComparison.OrdinalIgnoreCase));
    }

    public async Task<int> GetSessionVersionAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var cacheKey = $"auth:admin:user:{userId}:session_version";
        var cachedVersionStr = await _cacheService.GetAsync<string>(cacheKey);

        if (int.TryParse(cachedVersionStr, out var version))
        {
            return version;
        }

        // Cache miss: Load from DB
        var dbVersion = await _context.AdminMembers
            .Where(am => am.UserId == userId && am.Status == "Active")
            .Select(am => am.SessionVersion)
            .FirstOrDefaultAsync(cancellationToken);

        if (dbVersion > 0)
        {
            await _cacheService.SetAsync(cacheKey, dbVersion.ToString(), TimeSpan.FromHours(4));
        }

        return dbVersion;
    }

    public async Task InvalidateCacheAsync(Guid userId)
    {
        var permsKey = $"auth:admin:user:{userId}:perms";
        var versionKey = $"auth:admin:user:{userId}:session_version";
        await _cacheService.DeleteAsync(permsKey);
        await _cacheService.DeleteAsync(versionKey);
    }

    private async Task<List<string>> FetchHierarchicalPermissionsFromDbAsync(Guid userId, CancellationToken cancellationToken)
    {
        // Validate active admin membership
        var isActiveAdmin = await _context.AdminMembers
            .AnyAsync(am => am.UserId == userId && am.Status == "Active", cancellationToken);

        if (!isActiveAdmin)
        {
            return new List<string>();
        }

        // Query hierarchical assignments with max inheritance depth of 1
        const string sql = @"
            WITH RECURSIVE recursive_hierarchy AS (
                -- Anchor: Get directly assigned roles
                SELECT ra.role_id, 0 AS depth
                FROM role_assignments ra
                WHERE ra.user_id = @UserId AND ra.scope_type = 'SYSTEM'

                UNION ALL

                -- Recursive step: Follow parent relationships (capped at depth 1)
                SELECT r.parent_role_id, rh.depth + 1
                FROM roles r
                JOIN recursive_hierarchy rh ON r.id = rh.role_id
                WHERE r.parent_role_id IS NOT NULL AND rh.depth < 1
            )
            SELECT DISTINCT p.name
            FROM recursive_hierarchy rh
            JOIN role_permissions rp ON rh.role_id = rp.role_id
            JOIN permissions p ON rp.permission_id = p.id";

        var db = _context.Database.GetDbConnection();
        var result = await db.QueryAsync<string>(sql, new { UserId = userId });
        
        return result.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
    }
}
