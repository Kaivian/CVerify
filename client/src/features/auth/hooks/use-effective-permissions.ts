"use client";

import { useMemo } from "react";
import { useAuth } from "./use-auth";
import { useWorkspaceStore } from "../../workspace/store/use-workspace-store";
import { type ResourceActionPermission } from "../../../types/auth.types";

export interface EffectivePermissionsResult {
  hasEffectivePermission: (permission: ResourceActionPermission | string) => boolean;
  hasAnyPermission: (permissions: (ResourceActionPermission | string)[]) => boolean;
  hasAllPermissions: (permissions: (ResourceActionPermission | string)[]) => boolean;
  hasRole: (roles: string[]) => boolean;
  userRole: string;
  workspaceUserRole: string | null;
  workspacePermissions: string[];
  isMember: boolean;
}

/**
 * Single Source of Truth for frontend permission evaluation.
 * Aggregates global platform permissions (user.permissions) and
 * active enterprise/workspace scoped permissions (workspaceDetails.permissions).
 */
export const useEffectivePermissions = (orgSlug?: string): EffectivePermissionsResult => {
  const { user, hasPermission: hasGlobalPermission } = useAuth();
  const globalUserRole = user?.role || "USER";

  const workspacesStore = useWorkspaceStore((s) => s.workspaces);
  const myOrganizations = useWorkspaceStore((s) => s.myOrganizations);

  const activeOrgSlug = orgSlug || "";

  const workspaceDetails = useMemo(() => {
    return activeOrgSlug ? workspacesStore[activeOrgSlug] : null;
  }, [activeOrgSlug, workspacesStore]);

  const workspacePermissions = useMemo(() => {
    return workspaceDetails?.permissions || [];
  }, [workspaceDetails]);

  const workspaceUserRole = useMemo(() => {
    return workspaceDetails?.userRole || null;
  }, [workspaceDetails]);

  const isMember = useMemo(() => {
    if (workspaceUserRole !== null) return true;
    if (!activeOrgSlug || !myOrganizations) return false;
    return myOrganizations.some((o) => o.slug.toLowerCase() === activeOrgSlug.toLowerCase());
  }, [workspaceUserRole, activeOrgSlug, myOrganizations]);

  const hasEffectivePermission = (permission: ResourceActionPermission | string): boolean => {
    if (!permission) return true;

    // 1. Platform Admin bypass
    if (globalUserRole === "ADMIN") {
      return true;
    }

    // 2. Organization Owner bypass
    if (workspaceUserRole === "OWNER") {
      return true;
    }

    // 3. Global permission check (e.g., wildcards '*' or exact match)
    if (hasGlobalPermission(permission as ResourceActionPermission)) {
      return true;
    }

    // 4. Scoped enterprise permission check
    if (workspacePermissions.length > 0) {
      if (workspacePermissions.includes(permission)) {
        return true;
      }
      if (workspacePermissions.includes("*")) {
        return true;
      }
      // Check prefix/namespace wildcard (e.g. 'organization:workspaces:*')
      const targetNamespace = permission.split(":")[0];
      if (targetNamespace && workspacePermissions.includes(`${targetNamespace}:*`)) {
        return true;
      }
    }

    return false;
  };

  const hasAnyPermission = (permissions: (ResourceActionPermission | string)[]): boolean => {
    if (!permissions || permissions.length === 0) return true;
    return permissions.some((p) => hasEffectivePermission(p));
  };

  const hasAllPermissions = (permissions: (ResourceActionPermission | string)[]): boolean => {
    if (!permissions || permissions.length === 0) return true;
    return permissions.every((p) => hasEffectivePermission(p));
  };

  const hasRole = (roles: string[]): boolean => {
    if (!roles || roles.length === 0) return true;
    if (roles.includes(globalUserRole)) return true;
    if (workspaceUserRole && roles.includes(workspaceUserRole)) return true;
    return false;
  };

  return {
    hasEffectivePermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    userRole: globalUserRole,
    workspaceUserRole,
    workspacePermissions,
    isMember,
  };
};

export default useEffectivePermissions;
