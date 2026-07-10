using System;
using System.Collections.Generic;
using System.Linq;

namespace CVerify.API.Modules.Shared.Security.Authorization;

public record ScopedPermission
{
    public string PermissionName { get; init; } = string.Empty;
    public string ScopeType { get; init; } = string.Empty;
    public string ScopeId { get; init; } = string.Empty;

    public static ScopedPermission Parse(string permissionString)
    {
        if (string.IsNullOrWhiteSpace(permissionString))
        {
            return new ScopedPermission();
        }

        if (permissionString == "*" || permissionString == "*:*:*")
        {
            return new ScopedPermission
            {
                PermissionName = "*",
                ScopeType = "*",
                ScopeId = "*"
            };
        }

        var lastColon = permissionString.LastIndexOf(':');
        if (lastColon == -1)
        {
            return new ScopedPermission { PermissionName = permissionString };
        }

        var secondLastColon = permissionString.LastIndexOf(':', lastColon - 1);
        if (secondLastColon == -1)
        {
            return new ScopedPermission { PermissionName = permissionString };
        }

        var scopeId = permissionString.Substring(lastColon + 1);
        var scopeType = permissionString.Substring(secondLastColon + 1, lastColon - secondLastColon - 1);
        var permissionName = permissionString.Substring(0, secondLastColon);

        return new ScopedPermission
        {
            PermissionName = permissionName,
            ScopeType = scopeType,
            ScopeId = scopeId
        };
    }
}

public static class PermissionEvaluator
{
    public static bool HasPermission(
        IEnumerable<string> userPermissionStrings,
        string requiredPermissionName,
        Guid organizationId,
        string targetScopeType = "ORGANIZATION",
        Guid? targetScopeId = null)
    {
        if (userPermissionStrings == null) return false;

        var reqPermLower = requiredPermissionName.ToLowerInvariant();
        var targetScopeTypeLower = targetScopeType.ToLowerInvariant();
        var scopeId = targetScopeId ?? organizationId;
        var scopeIdStrLower = scopeId.ToString().ToLowerInvariant();
        var orgIdStrLower = organizationId.ToString().ToLowerInvariant();

        foreach (var rawPerm in userPermissionStrings)
        {
            var parsed = ScopedPermission.Parse(rawPerm);
            var parsedPermNameLower = parsed.PermissionName.ToLowerInvariant();
            var parsedScopeTypeLower = parsed.ScopeType.ToLowerInvariant();
            var parsedScopeIdLower = parsed.ScopeId.ToLowerInvariant();

            // 1. Wildcard check
            if (parsedPermNameLower == "*")
            {
                // Global super admin wildcard (*:*:*)
                if (parsedScopeTypeLower == "*" && parsedScopeIdLower == "*")
                {
                    return true;
                }

                // Scope-specific wildcard (e.g. *:ORGANIZATION:orgId or *:WORKSPACE:wsId)
                if (parsedScopeTypeLower == targetScopeTypeLower && parsedScopeIdLower == scopeIdStrLower)
                {
                    return true;
                }

                // Organization-level wildcard covers any child workspace scope
                if (parsedScopeTypeLower == "organization" && parsedScopeIdLower == orgIdStrLower)
                {
                    return true;
                }
            }

            // 2. Explicit permission match with segment wildcard mapping
            if (EvaluatePermissionNameMatch(parsedPermNameLower, reqPermLower))
            {
                // Target scope matches exactly
                if (parsedScopeTypeLower == targetScopeTypeLower && parsedScopeIdLower == scopeIdStrLower)
                {
                    return true;
                }

                // Organization-level permission covers child workspace scope
                if (parsedScopeTypeLower == "organization" && parsedScopeIdLower == orgIdStrLower)
                {
                    return true;
                }
            }
        }

        return false;
    }

    private static bool EvaluatePermissionNameMatch(string userPermName, string reqPermName)
    {
        if (userPermName == reqPermName) return true;

        var userParts = userPermName.Split(':');
        var reqParts = reqPermName.Split(':');
        bool isMatch = true;

        for (int i = 0; i < userParts.Length; i++)
        {
            if (userParts[i] == "*")
            {
                if (i == userParts.Length - 1)
                {
                    if (reqParts.Length >= i)
                    {
                        return true;
                    }
                }

                if (i >= reqParts.Length)
                {
                    isMatch = false;
                    break;
                }

                continue;
            }

            if (i >= reqParts.Length || userParts[i] != reqParts[i])
            {
                isMatch = false;
                break;
            }
        }

        return isMatch && userParts.Length == reqParts.Length;
    }
}
