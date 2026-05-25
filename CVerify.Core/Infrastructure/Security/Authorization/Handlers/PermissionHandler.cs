using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using CVerify.API.Application.Interfaces;
using CVerify.API.Infrastructure.Security.Authorization.Requirements;

namespace CVerify.API.Infrastructure.Security.Authorization.Handlers;

public class PermissionHandler : AuthorizationHandler<PermissionRequirement>
{
    private readonly ICacheService _cacheService;
    private readonly IIdentityRepository _identityRepository;

    public PermissionHandler(ICacheService cacheService, IIdentityRepository identityRepository)
    {
        _cacheService = cacheService;
        _identityRepository = identityRepository;
    }

    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context, 
        PermissionRequirement requirement)
    {
        var userIdClaim = context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return;
        }

        // 1. Get permissions from Redis cache
        var permsKey = $"auth:user:{userId}:permissions";
        var permissions = await _cacheService.GetSetAsync(permsKey);

        if (permissions == null || !permissions.Any())
        {
            // Cache miss: Load from IdentityRepository
            var dbPermissions = await _identityRepository.GetUserPermissionsAsync(userId);
            if (dbPermissions.Any())
            {
                // Re-populate cache
                foreach (var perm in dbPermissions)
                {
                    await _cacheService.AddToSetAsync(permsKey, perm);
                }
                permissions = dbPermissions.ToList();
            }
            else
            {
                permissions = new List<string>();
            }
        }

        // 2. Check if user is Super Admin (has *:*:* or * in their permissions)
        if (permissions.Contains("*:*:*") || permissions.Contains("*"))
        {
            context.Succeed(requirement);
            return;
        }

        // 3. Evaluate Wildcard permission match
        if (EvaluatePermission(permissions, requirement.Permission))
        {
            context.Succeed(requirement);
        }
    }

    /// <summary>
    /// Evaluates if the user's permissions satisfy the required permission.
    /// Supports wildcard matching (e.g., 'identity:*' matches 'identity:user:delete').
    /// </summary>
    /// <param name="userPermissions">List of permissions assigned to the user.</param>
    /// <param name="requiredPermission">The permission required by the resource.</param>
    /// <returns>True if access is granted; otherwise, false.</returns>
    private static bool EvaluatePermission(IEnumerable<string> userPermissions, string requiredPermission)
    {
        // Optimization: Exact match check
        if (userPermissions.Contains(requiredPermission)) return true;

        var requiredParts = requiredPermission.Split(':');

        foreach (var userPerm in userPermissions)
        {
            if (userPerm == "*:*:*") return true;

            var userParts = userPerm.Split(':');
            bool isMatch = true;

            // Iterate over user parts
            for (int i = 0; i < userParts.Length; i++)
            {
                // If user segment is "*":
                if (userParts[i] == "*")
                {
                    // If it is the last segment (trailing wildcard), it matches everything from here onwards
                    if (i == userParts.Length - 1)
                    {
                        if (requiredParts.Length >= i)
                        {
                            return true;
                        }
                    }
                    
                    // If it's an intermediate wildcard, it matches exactly one segment
                    if (i >= requiredParts.Length)
                    {
                        isMatch = false;
                        break;
                    }
                    
                    // Match single segment and continue
                    continue;
                }

                // If user segment is not a wildcard, it must match the required segment exactly
                if (i >= requiredParts.Length || userParts[i] != requiredParts[i])
                {
                    isMatch = false;
                    break;
                }
            }

            // For non-trailing wildcards, they must match in total length
            if (isMatch && userParts.Length == requiredParts.Length)
            {
                return true;
            }
        }

        return false;
    }
}

